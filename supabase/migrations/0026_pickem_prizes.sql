-- Prizes, and the code that collects them across a counter.
--
-- WHY NOT `rewards`. The handoff said to reuse it, and the schema says
-- otherwise: `rewards` demands `receipt_id` (not null, unique), `amount_cents`
-- greater than zero and `household_key` (not null). A pick'em prize has no
-- receipt, is often not an amount of money — a jersey, a meal — and belongs to
-- a person rather than a household. Bending three NOT NULLs on a table that
-- serves a live campaign to store something it was not drawn for is how a
-- schema stops meaning anything.
--
-- WHY NOT `prize_redemptions`. Closer, but it models BUYING: a catalogue item
-- with a points cost and inventory, claimed first-come. A pick'em prize is
-- AWARDED for finishing first. Nobody spends anything and there is no queue.
--
-- What both DO give is the pattern, and that is reused: an append-only claim,
-- a legible code dictated over a counter, and a status that records the moment
-- somebody handed the thing over.
--
-- THE PRIZES THEMSELVES ARE DATA, AND CHAPA HAS NOT DEFINED THEM YET. That is
-- deliberate on both counts: the client defines and supplies the prizes (that
-- is how it was quoted), and a programme with no prize rows renders an honest
-- empty state rather than an invented one.

-- ===========================================================================
-- What is on offer
-- ===========================================================================

create table if not exists public.pickem_prizes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  -- 'week'   — awarded every jornada to the placement below.
  -- 'season' — the accumulated championship, awarded once at the end.
  scope text not null check (scope in ('week', 'season')),
  -- Which placement wins it. The demo proved that rewarding the top three
  -- hands the same player a prize almost every week, which kills the
  -- programme's credibility faster than a small prize does.
  place int not null default 1 check (place >= 1),
  name text not null,
  -- Free text the tenant writes: "Consumo de $500", "Jersey oficial".
  detail text,
  -- Days the winner has to collect. Visible on their screen from the moment
  -- they win, because a prize with an invisible deadline is a prize somebody
  -- loses without being told.
  valid_days int not null default 30 check (valid_days > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- One prize per placement per scope. A second row for first place would make
  -- "what did I win" a question with two answers.
  unique (campaign_id, scope, place)
);

-- ===========================================================================
-- What somebody won
-- ===========================================================================

create table if not exists public.pickem_awards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  -- on delete restrict: a prize row must not be deletable out from under a
  -- promise already made to a person.
  prize_id uuid not null references public.pickem_prizes(id) on delete restrict,
  -- Null for the season championship, which belongs to no single jornada.
  week int check (week is null or week >= 1),
  place int not null check (place >= 1),
  -- Short, legible, dictated across a counter. See the generator below.
  code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'redeemed', 'expired', 'canceled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  -- Where it was collected. Feeds the tenant's per-branch report, and answers
  -- "did they already use it" without anybody having to remember.
  redeemed_venue text,
  redeemed_by uuid references auth.users(id) on delete set null,
  -- The code IS the claim, so two of them in one programme is one prize handed
  -- to the wrong person.
  unique (campaign_id, code),
  -- One award per placement per week. Re-running a settle cannot award twice —
  -- the same invariant the ledger has, in the currency of prizes.
  unique (campaign_id, week, place)
);

create index if not exists pickem_awards_participant_idx
  on public.pickem_awards (participant_id, created_at desc);

-- Only a redeemed award carries the marks of being redeemed. Without this a
-- pending award could quietly hold a redemption date, and "has this been
-- collected" would have two sources that can disagree.
alter table public.pickem_awards drop constraint if exists pickem_awards_redeemed_pairing;
alter table public.pickem_awards add constraint pickem_awards_redeemed_pairing
  check (
    (status = 'redeemed' and redeemed_at is not null)
    or (status <> 'redeemed' and redeemed_at is null)
  );

-- ===========================================================================
-- The code
-- ===========================================================================

-- `CHA-W3-K7M2QX`. Three parts, each doing a job: the tenant's prefix so a
-- code found on the floor is identifiable, the jornada so staff can sanity
-- check it against the week they are in, and six random characters.
--
-- The alphabet comes from tickets_redemption_code (0013), which already
-- removed the glyphs that get misheard over a counter — 0/O and 1/I/L. Every
-- ambiguous character is a prize handed to the wrong person or refused to the
-- right one.
create or replace function public.pickem_award_code(p_campaign uuid, p_week int)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
begin
  select upper(substr(regexp_replace(o.slug, '[^a-zA-Z]', '', 'g'), 1, 3))
    into v_prefix
  from public.campaigns c join public.organizations o on o.id = c.org_id
  where c.id = p_campaign;

  return coalesce(nullif(v_prefix, ''), 'SUP')
      || '-' || coalesce('W' || p_week::text, 'GP')
      || '-' || public.tickets_redemption_code();
end;
$$;

-- ===========================================================================
-- Awarding, inside the settle
-- ===========================================================================
--
-- Replaces the 0023 version. Same signature, same guarantees, one more step:
-- after the points are credited, the week's prize goes to whoever finished
-- first. Inside the same transaction, because a settle that credited points
-- but failed to award the prize would need a human to notice.
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
  v_prize public.pickem_prizes;
  v_winner uuid;
  v_top int;
  v_tied int;
  v_code text;
  v_awarded boolean := false;
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

    insert into public.points_entries
      (campaign_id, participant_id, kind, currency, points, note, pickem_entry_id)
    values
      (v_campaign.id, v_entry.participant_id, 'pickem_week', 'points',
       (v_score ->> 'points')::int,
       'Jornada ' || p_week, v_entry.id)
    on conflict (pickem_entry_id) where kind = 'pickem_week' do nothing;

    v_settled := v_settled + 1;
  end loop;

  -- ---- the week's prize --------------------------------------------------
  select * into v_prize
  from public.pickem_prizes
  where campaign_id = v_campaign.id and scope = 'week' and place = 1 and active;

  if found then
    select max(points) into v_top
    from public.pickem_entries
    where campaign_id = v_campaign.id and week = p_week and settled_at is not null;

    if v_top is not null then
      select count(*) into v_tied
      from public.pickem_entries
      where campaign_id = v_campaign.id and week = p_week and points = v_top;

      -- A tie at the top is NOT resolved here. The tiebreak bonus already
      -- separates most of them, and when it does not, who gets the prize is a
      -- decision with a person's name on it — a supervisor's call, recorded in
      -- the console, not a silent `order by ... limit 1` that hands it to
      -- whichever row Postgres returned first.
      if v_tied = 1 then
        select participant_id into v_winner
        from public.pickem_entries
        where campaign_id = v_campaign.id and week = p_week and points = v_top;

        for v_attempt in 1..10 loop
          begin
            v_code := public.pickem_award_code(v_campaign.id, p_week);
            insert into public.pickem_awards
              (campaign_id, participant_id, prize_id, week, place, code, expires_at)
            values
              (v_campaign.id, v_winner, v_prize.id, p_week, 1, v_code,
               now() + make_interval(days => v_prize.valid_days));
            v_awarded := true;
            exit;
          exception
            -- The (campaign, week, place) key: this week's prize is already
            -- awarded, which is what a re-run looks like. Not an error.
            when unique_violation then
              if exists (select 1 from public.pickem_awards
                          where campaign_id = v_campaign.id and week = p_week and place = 1)
              then
                exit;
              end if;
              -- Otherwise it was the code colliding. Astronomically unlikely,
              -- and the loop is the recovery rather than the failure.
          end;
        end loop;
      end if;
    end if;
  end if;

  if v_program.open_week = p_week then
    update public.pickem_programs
       set open_week = p_week + 1
     where campaign_id = v_campaign.id;
  end if;

  return jsonb_build_object(
    'week', p_week,
    'settled', v_settled,
    'awarded', v_awarded,
    'tiedAtTop', coalesce(v_tied, 0) > 1
  );
end;
$$;

-- ===========================================================================
-- Redeeming at the counter
-- ===========================================================================
--
--   award_not_found | already_redeemed | award_expired | award_canceled
--   unknown_venue
--
-- The moment the game turns into a visit, which is the whole mechanism of the
-- business — so it is recorded properly: when, where, and by whom.
--
-- Service role only. The person holding the tablet is staff, and the route
-- that calls this checks their seat on the campaign first. A waiter does not
-- need an account: they read the code off the player's screen and type it.
create or replace function public.pickem_redeem_award(
  p_campaign_slug text,
  p_code text,
  p_venue text,
  p_staff uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_program public.pickem_programs;
  v_award public.pickem_awards;
  v_prize public.pickem_prizes;
  v_alias text;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  select * into v_program from public.pickem_programs where campaign_id = v_campaign.id;

  -- Typed by a person reading a phone screen across a counter, so it is matched
  -- case-insensitively and without the spaces or dashes they may or may not
  -- include. Refusing a real code over a lowercase letter is a bad way to end
  -- a meal.
  select * into v_award
  from public.pickem_awards
  where campaign_id = v_campaign.id
    and upper(regexp_replace(code, '[^a-zA-Z0-9]', '', 'g'))
      = upper(regexp_replace(p_code, '[^a-zA-Z0-9]', '', 'g'))
  for update;

  if not found then
    raise exception 'award_not_found';
  end if;
  if v_award.status = 'redeemed' then
    raise exception 'already_redeemed';
  end if;
  if v_award.status = 'canceled' then
    raise exception 'award_canceled';
  end if;
  if now() > v_award.expires_at then
    update public.pickem_awards set status = 'expired' where id = v_award.id;
    raise exception 'award_expired';
  end if;
  if v_program.venues is not null and array_length(v_program.venues, 1) is not null
     and not (p_venue = any (v_program.venues)) then
    raise exception 'unknown_venue';
  end if;

  update public.pickem_awards
     set status = 'redeemed',
         redeemed_at = now(),
         redeemed_venue = p_venue,
         redeemed_by = p_staff
   where id = v_award.id;

  select * into v_prize from public.pickem_prizes where id = v_award.prize_id;
  select alias into v_alias from public.participants where id = v_award.participant_id;

  return jsonb_build_object(
    'code', v_award.code,
    'alias', v_alias,
    'prize', v_prize.name,
    'detail', v_prize.detail,
    'week', v_award.week,
    'venue', p_venue
  );
end;
$$;

-- ===========================================================================
-- Row-level security
-- ===========================================================================

alter table public.pickem_prizes enable row level security;
alter table public.pickem_awards enable row level security;

grant select on public.pickem_prizes to anon, authenticated;
grant select on public.pickem_awards to authenticated;

-- What is on offer is public. "Lo que está en juego" is the reason somebody
-- who just scanned a QR keeps reading, and a prize nobody can see before
-- playing is a prize that persuades nobody.
drop policy if exists pickem_prizes_public_read on public.pickem_prizes;
create policy pickem_prizes_public_read on public.pickem_prizes
  for select to anon, authenticated using (true);

-- What somebody won is theirs. The code in particular: it is a bearer token
-- for a physical thing, and a leaderboard that leaked codes would be a
-- leaderboard that hands out other people's prizes.
drop policy if exists pickem_awards_self_read on public.pickem_awards;
create policy pickem_awards_self_read on public.pickem_awards
  for select to authenticated
  using (exists (
    select 1 from public.participant_devices d
    where d.participant_id = pickem_awards.participant_id
      and d.auth_user_id = (select auth.uid())
  ));

revoke all on function public.pickem_redeem_award(text, text, text, uuid) from public;
revoke all on function public.pickem_award_code(uuid, int) from public;
