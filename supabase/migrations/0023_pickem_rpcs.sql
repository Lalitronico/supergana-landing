-- Pick'em: every write, and the one read that crosses row ownership.
--
-- Same shape as the rest of the platform: `security definer` functions that
-- resolve the caller from auth.uid(), so no argument ever says whose points to
-- touch. Errors are raised as stable machine codes, like tickets_approve_receipt,
-- for the route to translate rather than a sentence for it to forward.
--
-- ONE PLACE COMPUTES A SCORE.
--
-- The handoff asked for scoring as a pure TypeScript module, testable without a
-- database. This does it in SQL instead, and the reason is worth writing down:
-- the week's points are born inside the transaction that settles it (0011's
-- rule — "a second write path would eventually disagree"), so SQL has to be able
-- to score. A TypeScript copy would then exist only to show the player a
-- preview, and two implementations of a scoring rule are two implementations
-- that drift, silently, until somebody's ranking is wrong in a way nobody can
-- reproduce. The preview reads pickem_score_entry too. TypeScript renders the
-- breakdown; it never computes one.

-- ===========================================================================
-- Reading the calendar
-- ===========================================================================

-- When a week's picks lock: its first kickoff. Never a weekday — the deck said
-- "picks close Thursday" and week 1 of 2026 opens on a Wednesday, 9 September
-- at 6:20 PM Juárez. The lock is read from the schedule or it is wrong.
create or replace function public.pickem_week_lock(p_season uuid, p_week int)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select min(kickoff_at)
  from public.sport_games
  where season_id = p_season and week = p_week and not voided;
$$;

-- The game whose total points the tiebreak predicts: the last one to kick off.
create or replace function public.pickem_closing_game(p_season uuid, p_week int)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select id
  from public.sport_games
  where season_id = p_season and week = p_week and not voided
  order by kickoff_at desc, id
  limit 1;
$$;

-- ===========================================================================
-- Who is calling
-- ===========================================================================

-- A device that proved the number. Resolved through participant_devices, not
-- participants.auth_user_id: the same player may hold the identity on a phone
-- and a tablet, and 0021 explains why that is a person rather than an attack.
create or replace function public.pickem_participant(p_campaign uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.participant_id
  from public.participant_devices d
  where d.campaign_id = p_campaign and d.auth_user_id = auth.uid();
$$;

-- ===========================================================================
-- Scoring
-- ===========================================================================

-- The whole breakdown, not just the total. Every screen that shows a score has
-- to be able to say where it came from — a player who cannot follow the
-- arithmetic stops trusting the ranking, and the ranking is the product.
--
-- Returns null for an entry whose week has an uncaptured score, so callers can
-- tell "not scorable yet" from "scored zero".
create or replace function public.pickem_score_entry(p_entry uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry public.pickem_entries;
  v_program public.pickem_programs;
  v_m jsonb;
  v_hits int := 0;
  v_of int := 0;
  v_pending int := 0;
  v_closing uuid;
  v_closing_total int;
  v_tb_bonus int := 0;
  v_early_bonus int := 0;
  v_lock timestamptz;
  v_streak int := 0;
  v_streak_pts int := 0;
  v_probe int;
  v_checked_in boolean;
  v_promo boolean;
  v_mult int;
  v_base int;
  v_subtotal int;
begin
  select * into v_entry from public.pickem_entries where id = p_entry;
  if not found then
    return null;
  end if;

  select * into v_program from public.pickem_programs where campaign_id = v_entry.campaign_id;
  if not found then
    return null;
  end if;
  v_m := v_program.mechanics;

  -- Hits. A voided game scores for nobody, which is what annulling means: it is
  -- excluded from the count AND from the denominator, so "11 de 15" stays an
  -- honest sentence instead of quietly costing everyone one pick.
  --
  -- A drawn game scores for nobody either — the CASE yields null, and `choice =
  -- null` is null rather than true. The NFL still ties about once a season, and
  -- "you picked the winner" has no answer when there wasn't one.
  select
    count(*) filter (
      where g.away_score is not null
        and p.choice = case when g.home_score > g.away_score then 'home'
                            when g.away_score > g.home_score then 'away'
                            else null end
    ),
    count(*),
    count(*) filter (where g.away_score is null)
  into v_hits, v_of, v_pending
  from public.pickem_picks p
  join public.sport_games g on g.id = p.game_id
  where p.entry_id = v_entry.id and not g.voided;

  -- A tie scores for nobody. The NFL still plays them, roughly once a season,
  -- and "you picked the winner" has no answer when there wasn't one.
  -- Not scorable yet, which callers must be able to tell apart from "scored
  -- zero". A week with an uncaptured score shows dashes, never a 0 — a zero in
  -- a ranking reads as "you came last", and that is a different sentence.
  if v_pending > 0 then
    return null;
  end if;

  -- Tiebreak: total points of the closing game, within the configured margin.
  v_closing := public.pickem_closing_game(v_program.season_id, v_entry.week);
  if v_entry.tiebreak is not null and v_closing is not null then
    select away_score + home_score into v_closing_total
    from public.sport_games where id = v_closing;
    if v_closing_total is not null
       and abs(v_entry.tiebreak - v_closing_total) <= coalesce((v_m ->> 'tiebreakMargin')::int, 3)
    then
      v_tb_bonus := coalesce((v_m ->> 'tiebreak')::int, 15);
    end if;
  end if;

  -- Early bird: decided at least N hours before the lock. Measured against
  -- `submitted_at`, which later edits do not move — changing one pick is not
  -- un-deciding, and re-opening the screen on Saturday should not cost the
  -- bonus somebody earned on Wednesday.
  v_lock := public.pickem_week_lock(v_program.season_id, v_entry.week);
  if v_lock is not null
     and v_entry.submitted_at <= v_lock - make_interval(hours => coalesce((v_m ->> 'earlyHours')::int, 24))
  then
    v_early_bonus := coalesce((v_m ->> 'early')::int, 5);
  end if;

  -- Streak: consecutive weeks played, counting back from and including this
  -- one. Counting forward from the current week was the first version's bug —
  -- it told somebody on a ten-week run that their streak was 0, because they
  -- had not yet touched the week in progress.
  v_probe := v_entry.week;
  while v_probe >= 1 loop
    exit when not exists (
      select 1 from public.pickem_entries e
      where e.campaign_id = v_entry.campaign_id
        and e.participant_id = v_entry.participant_id
        and e.week = v_probe
        and exists (select 1 from public.pickem_picks pk where pk.entry_id = e.id)
    );
    v_streak := v_streak + 1;
    v_probe := v_probe - 1;
  end loop;

  if v_streak >= 6 then
    v_streak_pts := coalesce((v_m ->> 'streak6')::int, 50);
  elsif v_streak >= 3 then
    v_streak_pts := coalesce((v_m ->> 'streak3')::int, 20);
  end if;

  -- Multipliers ADD to the multiplier, they do not multiply each other:
  -- check-in and a double week give ×3, not ×4. A ×4 on top of a long streak
  -- produces a number nobody can follow, and a score nobody can follow is a
  -- leaderboard nobody believes.
  v_checked_in := exists (
    select 1 from public.pickem_checkins c
    where c.campaign_id = v_entry.campaign_id
      and c.participant_id = v_entry.participant_id
      and c.week = v_entry.week
  );
  v_promo := v_entry.week = any (v_program.promo_weeks);
  v_mult := 1
          + case when v_checked_in then coalesce((v_m ->> 'checkinMult')::int, 1) else 0 end
          + case when v_promo then coalesce((v_m ->> 'promoMult')::int, 1) else 0 end;

  v_base := v_hits * coalesce((v_m ->> 'hit')::int, 10);
  v_subtotal := v_base + v_tb_bonus + v_early_bonus + v_streak_pts;

  return jsonb_build_object(
    'hits', v_hits,
    'of', v_of,
    'base', v_base,
    'tiebreakBonus', v_tb_bonus,
    'earlyBonus', v_early_bonus,
    'streak', v_streak,
    'streakBonus', v_streak_pts,
    'checkedIn', v_checked_in,
    'promo', v_promo,
    'mult', v_mult,
    'subtotal', v_subtotal,
    'points', v_subtotal * v_mult
  );
end;
$$;

-- ===========================================================================
-- Saving picks
-- ===========================================================================
--
--   campaign_not_found | not_a_participant | not_verified | week_not_open
--   week_locked | incomplete_picks | unknown_game
--
-- Idempotent: sending again replaces the entry's picks. The screen lets a
-- player change their mind until kickoff, so "save" is the only verb there is.
create or replace function public.pickem_save_picks(
  p_campaign_slug text,
  p_week int,
  p_picks jsonb,
  p_tiebreak int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_program public.pickem_programs;
  v_participant public.participants;
  v_participant_id uuid;
  v_lock timestamptz;
  v_expected int;
  v_given int;
  v_entry public.pickem_entries;
  v_venue text;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  select * into v_program from public.pickem_programs where campaign_id = v_campaign.id;
  if not found then
    raise exception 'campaign_not_found';
  end if;

  v_participant_id := public.pickem_participant(v_campaign.id);
  if v_participant_id is null then
    raise exception 'not_a_participant';
  end if;

  select * into v_participant from public.participants where id = v_participant_id for update;

  -- Unverified numbers do not play. Without this, one person opens five
  -- accounts on five numbers they do not own and the leaderboard stops being
  -- worth reading — which costs more than the prizes do.
  if v_participant.phone_verified_at is null then
    raise exception 'not_verified';
  end if;

  if p_week <> v_program.open_week then
    raise exception 'week_not_open';
  end if;

  v_lock := public.pickem_week_lock(v_program.season_id, p_week);
  if v_lock is null or now() >= v_lock then
    raise exception 'week_locked';
  end if;

  -- All of the week or none of it. A partial submission looks identical to
  -- picks that got lost, and a player who thinks the system ate their picks is
  -- a player who stops playing.
  select count(*) into v_expected
  from public.sport_games
  where season_id = v_program.season_id and week = p_week and not voided;

  select count(*) into v_given
  from jsonb_each_text(p_picks);

  if v_given <> v_expected then
    raise exception 'incomplete_picks';
  end if;

  -- The venue this week was played from, taken from the check-in if there is
  -- one. See the column comment: it records where they were, not where they
  -- signed up.
  select venue into v_venue
  from public.pickem_checkins
  where campaign_id = v_campaign.id and participant_id = v_participant_id and week = p_week;

  insert into public.pickem_entries (campaign_id, participant_id, week, tiebreak, venue)
  values (v_campaign.id, v_participant_id, p_week, p_tiebreak, v_venue)
  on conflict (campaign_id, participant_id, week) do update
    set tiebreak = excluded.tiebreak,
        venue = coalesce(excluded.venue, public.pickem_entries.venue),
        updated_at = now()
  returning * into v_entry;

  -- A settled week is history. Re-scoring it because somebody re-posted an old
  -- payload would move a ranking that has already been published and, in this
  -- product, paid out.
  if v_entry.settled_at is not null then
    raise exception 'week_locked';
  end if;

  delete from public.pickem_picks where entry_id = v_entry.id;

  insert into public.pickem_picks (entry_id, game_id, choice)
  select v_entry.id, (k)::uuid, v
  from jsonb_each_text(p_picks) as t(k, v)
  where v in ('away', 'home');

  -- Every key had to name a real game of this week, and every value had to be
  -- a side. Checking after the insert costs one count and catches both at once;
  -- the transaction unwinds, so nothing half-written survives.
  if (select count(*) from public.pickem_picks pk
      join public.sport_games g on g.id = pk.game_id
      where pk.entry_id = v_entry.id
        and g.season_id = v_program.season_id
        and g.week = p_week
        and not g.voided) <> v_expected
  then
    raise exception 'unknown_game';
  end if;

  return jsonb_build_object(
    'entryId', v_entry.id,
    'week', p_week,
    'picks', v_expected,
    'locksAt', v_lock
  );
end;
$$;

-- ===========================================================================
-- Check-in
-- ===========================================================================
--
--   campaign_not_found | not_a_participant | not_verified | unknown_venue
--   outside_window | already_checked_in
--
-- Free by design. It doubles the week and requires spending nothing — see the
-- table comment in 0022 for why that is load-bearing rather than generous.
create or replace function public.pickem_checkin(
  p_campaign_slug text,
  p_week int,
  p_venue text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_program public.pickem_programs;
  v_participant public.participants;
  v_participant_id uuid;
  v_tz text;
  v_first timestamptz;
  v_last timestamptz;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  select * into v_program from public.pickem_programs where campaign_id = v_campaign.id;
  if not found then
    raise exception 'campaign_not_found';
  end if;

  v_participant_id := public.pickem_participant(v_campaign.id);
  if v_participant_id is null then
    raise exception 'not_a_participant';
  end if;

  select * into v_participant from public.participants where id = v_participant_id;
  if v_participant.phone_verified_at is null then
    raise exception 'not_verified';
  end if;

  if not (p_venue = any (v_program.venues)) then
    raise exception 'unknown_venue';
  end if;

  -- The window is the week's own game days, read in the tenant's clock. Not a
  -- weekday and not a fixed span: week 1 opens on a Wednesday, five Sundays are
  -- 7:30 AM London games, and Thanksgiving is a Thursday lunch.
  v_tz := coalesce(v_campaign.config ->> 'timezone', 'America/Ciudad_Juarez');
  select min(kickoff_at), max(kickoff_at) into v_first, v_last
  from public.sport_games
  where season_id = v_program.season_id and week = p_week and not voided;

  if v_first is null then
    raise exception 'outside_window';
  end if;

  -- From midnight of the first game's local day to the end of the last game's
  -- local day. Generous on purpose: somebody who arrives for lunch before a
  -- 2:25 PM game is exactly the traffic this mechanic exists to create.
  if now() < date_trunc('day', v_first at time zone v_tz) at time zone v_tz
     or now() >= (date_trunc('day', v_last at time zone v_tz) + interval '1 day') at time zone v_tz
  then
    raise exception 'outside_window';
  end if;

  begin
    insert into public.pickem_checkins (campaign_id, participant_id, week, venue)
    values (v_campaign.id, v_participant_id, p_week, p_venue);
  exception when unique_violation then
    raise exception 'already_checked_in';
  end;

  -- The entry may not exist yet — a player can walk in and scan before making
  -- picks. When it does, this is where the week learns which venue it was
  -- played from.
  update public.pickem_entries
     set venue = p_venue, updated_at = now()
   where campaign_id = v_campaign.id
     and participant_id = v_participant_id
     and week = p_week
     and settled_at is null;

  return jsonb_build_object('week', p_week, 'venue', p_venue);
end;
$$;

-- ===========================================================================
-- Settling a week
-- ===========================================================================
--
--   campaign_not_found | week_incomplete | week_already_settled
--
-- All of it or none of it. A partial settle hands out the wrong prizes, and
-- that is not something that undoes cleanly across a restaurant counter.
--
-- Callable by service_role from the cron, and by a supervisor from the console.
-- The cron cannot be the only way: over eighteen weeks ESPN will fail, a game
-- will be postponed, and a score will be typed wrong and need correcting after
-- the fact.
create or replace function public.pickem_settle_week(
  p_campaign_slug text,
  p_week int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_program public.pickem_programs;
  v_missing int;
  v_entry record;
  v_score jsonb;
  v_settled int := 0;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  select * into v_program
  from public.pickem_programs where campaign_id = v_campaign.id
  for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;

  -- Every game scored, or nothing happens. A void counts as resolved: that is
  -- what voiding is for, and it is the only way a postponed game lets the rest
  -- of the week close.
  select count(*) into v_missing
  from public.sport_games
  where season_id = v_program.season_id
    and week = p_week
    and not voided
    and away_score is null;

  if v_missing > 0 then
    raise exception 'week_incomplete';
  end if;

  for v_entry in
    select * from public.pickem_entries
    where campaign_id = v_campaign.id and week = p_week and settled_at is null
    for update
  loop
    v_score := public.pickem_score_entry(v_entry.id);
    continue when v_score is null;

    update public.pickem_entries
       set hits = (v_score ->> 'hits')::int,
           points = (v_score ->> 'points')::int,
           breakdown = v_score,
           settled_at = now()
     where id = v_entry.id;

    -- Points are born here, in the same transaction that settles the week —
    -- 0011's rule, and the reason there is no second write path that could
    -- eventually disagree with this one.
    insert into public.points_entries
      (campaign_id, participant_id, kind, currency, points, note, pickem_entry_id)
    values
      (v_campaign.id, v_entry.participant_id, 'pickem_week', 'points',
       (v_score ->> 'points')::int,
       'Jornada ' || p_week, v_entry.id)
    on conflict (pickem_entry_id) where kind = 'pickem_week' do nothing;

    v_settled := v_settled + 1;
  end loop;

  -- The next appointment. Guarded so that re-running a settled week cannot
  -- skip a week nobody has played yet.
  if v_program.open_week = p_week then
    update public.pickem_programs
       set open_week = p_week + 1
     where campaign_id = v_campaign.id;
  end if;

  return jsonb_build_object('week', p_week, 'settled', v_settled);
end;
$$;

-- ===========================================================================
-- The leaderboard
-- ===========================================================================
--
-- The scoped read 0011 anticipated: "the leaderboard will need a wider read
-- some day; per the v2 brief that will be its own scoped view, not a loosening
-- of this policy." This is that view.
--
-- What it exposes is the alias, the venue and a number. Never a phone, never an
-- email, never a real name — the profile screen is looked at across a
-- restaurant table with somebody else sitting there.
--
-- p_scope: 'week' ranks one jornada, 'season' the accumulated total.
create or replace function public.pickem_leaderboard(
  p_campaign_slug text,
  p_week int default null,
  p_scope text default 'week',
  p_limit int default 50
)
returns table (
  rank bigint,
  alias text,
  venue text,
  points bigint,
  participant_id uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  if p_scope = 'season' then
    -- The season total is a SUM of the ledger, never a stored column — 0011's
    -- rule, and the reason it is safe to correct a week with an `adjustment`
    -- entry instead of editing history.
    --
    -- `currency = 'points'` is the legal frame, not an optimisation: loyalty
    -- tokens earned by spending must never reach this sum. See the column
    -- comment in 0022.
    return query
      select
        rank() over (order by t.total desc),
        t.alias,
        t.venue,
        t.total,
        t.id
      from (
        select
          p.id,
          p.alias,
          -- Where they played most recently, not where they registered. Over
          -- eighteen weeks people move between branches, and the venue column
          -- on the season table is answering "who is in the room" for the
          -- tenant's per-branch report.
          (select e.venue from public.pickem_entries e
            where e.participant_id = p.id and e.venue is not null
            order by e.week desc limit 1) as venue,
          coalesce(sum(pe.points), 0)::bigint as total
        from public.participants p
        left join public.points_entries pe
          on pe.participant_id = p.id and pe.currency = 'points'
        where p.campaign_id = v_campaign.id and p.phone_verified_at is not null
        group by p.id, p.alias
      ) t
      order by t.total desc
      limit p_limit;
  else
    return query
      select
        rank() over (order by e.points desc nulls last),
        p.alias,
        e.venue,
        coalesce(e.points, 0)::bigint,
        p.id
      from public.pickem_entries e
      join public.participants p on p.id = e.participant_id
      where e.campaign_id = v_campaign.id and e.week = p_week
      order by e.points desc nulls last
      limit p_limit;
  end if;
end;
$$;

-- ===========================================================================
-- My own week
-- ===========================================================================
--
-- The player-facing door to the scorer. pickem_score_entry takes an entry id
-- and runs as definer, which means handing it to the browser would hand every
-- browser the breakdown of every other player's week — the leaderboard shows
-- an alias and a total on purpose, and the arithmetic behind somebody else's
-- total is not part of that.
--
-- So the scorer stays internal and this is what the screens call: it resolves
-- the caller from their session and can only ever reach one entry.
--
-- Returns null when the week has no entry or is not yet scorable, which is the
-- same null the scorer returns and means the same thing on screen: dashes.
create or replace function public.pickem_my_week(
  p_campaign_slug text,
  p_week int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_participant_id uuid;
  v_entry public.pickem_entries;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  v_participant_id := public.pickem_participant(v_campaign.id);
  if v_participant_id is null then
    raise exception 'not_a_participant';
  end if;

  select * into v_entry from public.pickem_entries
  where campaign_id = v_campaign.id and participant_id = v_participant_id and week = p_week;
  if not found then
    return null;
  end if;

  -- A settled week returns the breakdown that was stored when it settled, not
  -- a fresh computation. The stored one is what the player was told and what
  -- the ledger paid; re-deriving it would quietly restate history if anybody
  -- ever re-configures the mechanics mid-season.
  if v_entry.settled_at is not null then
    return v_entry.breakdown;
  end if;

  return public.pickem_score_entry(v_entry.id);
end;
$$;

-- ===========================================================================
-- Who may call what
-- ===========================================================================
--
-- `security definer` functions are granted to PUBLIC by default, so revoking
-- from anon and authenticated alone leaves the door open. PUBLIC first, then
-- grant back deliberately.
revoke all on function public.pickem_settle_week(text, int) from public;
revoke all on function public.pickem_score_entry(uuid) from public;
revoke all on function public.pickem_participant(uuid) from public;
revoke all on function public.pickem_save_picks(text, int, jsonb, int) from public;
revoke all on function public.pickem_checkin(text, int, text) from public;
revoke all on function public.pickem_leaderboard(text, int, text, int) from public;
revoke all on function public.pickem_my_week(text, int) from public;

-- Settling stays with service_role: the cron calls it, and a supervisor calls
-- it through a route that has already checked their seat on the campaign.
-- pickem_score_entry and pickem_participant are internals of the two above.
grant execute on function public.pickem_save_picks(text, int, jsonb, int) to authenticated;
grant execute on function public.pickem_checkin(text, int, text) to authenticated;
grant execute on function public.pickem_my_week(text, int) to authenticated;

-- The leaderboard is readable without a session: somebody who scans the table
-- QR should see the ranking before deciding whether to play.
grant execute on function public.pickem_leaderboard(text, int, text, int) to anon, authenticated;
