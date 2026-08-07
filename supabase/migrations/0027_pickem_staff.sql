-- The four things a supervisor has to be able to do that the cron cannot.
--
-- 0026 left the module with one unreachable door and one open question:
--
--   · `pickem_redeem_award` was written, granted to service_role, and never
--     called by anything. A prize could be won and could not be collected,
--     which is the entire mechanism of the business — the game lives on the
--     phone, the prize brings the player back to the table.
--   · `pickem_settle_week` deliberately refuses to break a tie at the top. It
--     settles the week, credits everybody and awards nobody, returning
--     `tiedAtTop: true`. That was the right call and it left the prize in
--     limbo: nothing in the schema could hand it to anyone afterwards.
--
-- And the runbook (07-OPERACION-SEMANAL.md) names two more, both of which will
-- happen inside eighteen weeks rather than in theory: a game gets postponed and
-- has to be taken out of the scoring, and a score gets captured wrong and has
-- to be corrected AFTER the week closed. The second one is the reason the
-- ledger is append-only: a correction is a new entry with a reason on it, never
-- an edit of the entry that was already paid.
--
-- Everything below is service_role only. The panel routes check the caller's
-- seat in `campaign_admins` before they reach any of it — the same allowlist,
-- the same `resolveStaff`, and the same two-outcome split (401 no session, 403
-- no seat) the tickets console has used since 0006. There is no second notion
-- of staff on this platform and this migration does not invent one.

-- ===========================================================================
-- Who did it
-- ===========================================================================

-- The ledger records what changed and never who changed it. That was fine
-- while every entry was born inside `tickets_approve_receipt` or
-- `pickem_settle_week`, where the author is the machine and the receipt or the
-- entry already points at the human decision behind it. A manual adjustment has
-- no such row: it is one person deciding that a number is wrong, and "quién lo
-- hizo" (the runbook's words) has to be answerable months later.
--
-- A column rather than a sentence appended to `note`, because a name parsed out
-- of free text is a name that stops being findable the first time somebody
-- types the reason differently.
--
-- Nullable, and null is meaningful: it says the entry was written by the
-- programme rather than by a person. Every existing row is exactly that.
alter table public.points_entries
  add column if not exists created_by uuid references auth.users(id) on delete set null;

comment on column public.points_entries.created_by is
  'Staff que escribio el asiento a mano. NULL = lo escribio el sistema (cierre de jornada, aprobacion de ticket). El ledger es append-only: una correccion es un asiento nuevo con motivo y autor, nunca una edicion del original.';

-- The same question about a prize: `pickem_awards` records who collected it
-- (`redeemed_by`) and not who decided it was theirs. Null means the settle
-- awarded it automatically because there was exactly one first place; a value
-- means a supervisor broke a tie, and 0026 said out loud that such a decision
-- has a person's name on it.
alter table public.pickem_awards
  add column if not exists awarded_by uuid references auth.users(id) on delete set null;

comment on column public.pickem_awards.awarded_by is
  'Supervisor que resolvio un empate en la cima. NULL = lo otorgo pickem_settle_week porque hubo un solo primer lugar.';

-- ===========================================================================
-- A shared first place is a real thing
-- ===========================================================================
--
-- 0026 wrote `unique (campaign_id, week, place)` and explained it as "one award
-- per placement per week. Re-running a settle cannot award twice". Two rules in
-- one key, and only the first of them is true:
--
--   1. The same person cannot be awarded the same placement of the same week
--      twice. This is what makes a re-run of the settle harmless, and it is
--      kept below.
--   2. Only one person can ever hold a placement. This one is contradicted by
--      the supervisor's own decision: when the tiebreak does not separate two
--      players, splitting the prize between them is one of the two answers a
--      supervisor is allowed to give, and under the old key the second insert
--      failed.
--
-- So the key gains `participant_id` and keeps doing the job it was actually
-- protecting. The settle's exception handler still works unchanged: a re-run
-- inserts the same (campaign, week, place, participant) tuple, raises
-- unique_violation, and its `exists` probe on (campaign, week, place) finds the
-- award and exits. The `unique (campaign_id, code)` key — the one that makes a
-- code a claim on exactly one prize — is untouched.
--
-- `pickem_resolve_tie` below carries rule 2 where it belongs: as an explicit
-- `already_awarded` refusal, which can say why instead of surfacing a
-- constraint name.
alter table public.pickem_awards
  drop constraint if exists pickem_awards_campaign_id_week_place_key;

alter table public.pickem_awards
  drop constraint if exists pickem_awards_one_per_place_per_player;
alter table public.pickem_awards
  add constraint pickem_awards_one_per_place_per_player
  unique (campaign_id, week, place, participant_id);

-- ===========================================================================
-- Breaking the tie
-- ===========================================================================
--
--   campaign_not_found | week_not_settled | no_winners | not_tied_at_top
--   no_week_prize | already_awarded
--
-- The supervisor picks one of the tied players, or several to split between.
-- Both are legitimate and the schema takes no side; what it refuses is naming
-- somebody who did not finish first, awarding a week that never closed, and
-- awarding a week that already has its prize out.
--
-- One transaction: either every winner named gets a code or none of them does.
-- Handing one of two tied players a code and failing on the second is the worst
-- outcome available, because the half that succeeded is already on a phone.
create or replace function public.pickem_resolve_tie(
  p_campaign_slug text,
  p_week int,
  p_winners uuid[],
  p_staff uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_prize public.pickem_prizes;
  v_winners uuid[];
  v_top int;
  v_tied int;
  v_valid int;
  v_winner uuid;
  v_code text;
  v_awarded jsonb := '[]'::jsonb;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  -- Duplicates in the array would otherwise become two codes for one person,
  -- and the unique key would catch it as a constraint violation rather than as
  -- the typo it is.
  select array_agg(distinct w) into v_winners
  from unnest(coalesce(p_winners, '{}'::uuid[])) as w
  where w is not null;

  if v_winners is null or array_length(v_winners, 1) is null then
    raise exception 'no_winners';
  end if;

  -- The top score of a week that actually closed. An unsettled week has no
  -- first place: `points` is null until the settle writes it, and awarding on
  -- top of nulls would hand the prize to whoever Postgres returned first —
  -- exactly what 0026 refused to do.
  select max(points) into v_top
  from public.pickem_entries
  where campaign_id = v_campaign.id and week = p_week and settled_at is not null;

  if v_top is null then
    raise exception 'week_not_settled';
  end if;

  select count(*) into v_tied
  from public.pickem_entries
  where campaign_id = v_campaign.id and week = p_week
    and settled_at is not null and points = v_top;

  -- Every name given has to be on the top line. The panel builds the list from
  -- the same query, so this only fires on a stale screen or a hand-made
  -- request — and both of those are somebody being handed a prize they did not
  -- win, which is not a thing to discover from a restaurant counter.
  select count(*) into v_valid
  from public.pickem_entries
  where campaign_id = v_campaign.id and week = p_week
    and settled_at is not null and points = v_top
    and participant_id = any (v_winners);

  if v_valid <> array_length(v_winners, 1) then
    raise exception 'not_tied_at_top';
  end if;

  select * into v_prize
  from public.pickem_prizes
  where campaign_id = v_campaign.id and scope = 'week' and place = 1 and active;
  if not found then
    raise exception 'no_week_prize';
  end if;

  -- Rule 2 of the old unique key, now able to explain itself. Includes the
  -- automatic award: if the settle already handed the week to a single winner,
  -- there is no tie to resolve.
  if exists (
    select 1 from public.pickem_awards
    where campaign_id = v_campaign.id and week = p_week and place = 1
  ) then
    raise exception 'already_awarded';
  end if;

  foreach v_winner in array v_winners loop
    -- Same retry as the settle: the only realistic unique_violation here is the
    -- six random characters colliding, and the loop is the recovery rather than
    -- the failure. A collision on (campaign, week, place, participant) cannot
    -- happen — the array is deduplicated and the week has no awards yet.
    for v_attempt in 1..10 loop
      begin
        v_code := public.pickem_award_code(v_campaign.id, p_week);
        insert into public.pickem_awards
          (campaign_id, participant_id, prize_id, week, place, code, expires_at, awarded_by)
        values
          (v_campaign.id, v_winner, v_prize.id, p_week, 1, v_code,
           now() + make_interval(days => v_prize.valid_days), p_staff);
        exit;
      exception when unique_violation then
        if v_attempt = 10 then
          raise;
        end if;
      end;
    end loop;

    v_awarded := v_awarded || jsonb_build_object(
      'participantId', v_winner,
      'alias', (select alias from public.participants where id = v_winner),
      'code', v_code
    );
  end loop;

  return jsonb_build_object(
    'week', p_week,
    'top', v_top,
    'tied', v_tied,
    'prize', v_prize.name,
    'validDays', v_prize.valid_days,
    'awarded', v_awarded
  );
end;
$$;

-- ===========================================================================
-- Annulling a game
-- ===========================================================================
--
--   campaign_not_found | game_not_found | week_settled
--
-- A postponed game. The league has done it for weather and for emergencies, and
-- over eighteen weeks it will happen at least once. `sport_games.voided` already
-- existed (0022) with nothing able to set it: without a way in, one postponed
-- game freezes a whole jornada forever, because the settle refuses to run while
-- a score is missing.
--
-- Voided means annulled for the pick'em, which is the rule the runbook
-- recommends and the only one that can be explained across a table in one
-- sentence: nobody wins or loses points for it, and the week closes on the
-- games that were played. The scorer excludes it from the hits AND from the
-- denominator, so "11 de 15" stays honest instead of quietly costing everybody
-- one pick.
--
-- A SETTLED WEEK IS HISTORY. Voiding a game after the close would change what
-- the scorer computes without changing what the ledger paid, so the two would
-- disagree with nothing to say which is right. The correction path for a week
-- already closed is `pickem_adjust_points` below — a new entry, with a reason.
--
-- The season is shared: the same 272 NFL games serve every tenant. So a
-- programme may only touch games in ITS OWN season, and a second tenant on the
-- same season sees the annulment too, which is correct — the game really was
-- postponed for everybody.
create or replace function public.pickem_set_game_voided(
  p_campaign_slug text,
  p_game uuid,
  p_voided boolean,
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
  v_game public.sport_games;
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

  select * into v_game from public.sport_games
  where id = p_game and season_id = v_program.season_id
  for update;
  if not found then
    raise exception 'game_not_found';
  end if;

  if exists (
    select 1 from public.pickem_entries
    where campaign_id = v_campaign.id and week = v_game.week and settled_at is not null
  ) then
    raise exception 'week_settled';
  end if;

  update public.sport_games set voided = p_voided where id = v_game.id;

  return jsonb_build_object(
    'gameId', v_game.id,
    'week', v_game.week,
    'away', v_game.away,
    'home', v_game.home,
    'voided', p_voided,
    'staff', p_staff
  );
end;
$$;

-- ===========================================================================
-- Correcting a score after the close
-- ===========================================================================
--
--   campaign_not_found | participant_not_found | note_required | zero_adjustment
--
-- The runbook's third real case: "un marcador se capturó mal y hay que
-- corregirlo DESPUÉS de cerrar". The answer is never to edit the entry that was
-- already credited — that entry is what the player was told and what the
-- ranking published. It is a new entry, signed, with a reason, and the balance
-- moves because a balance is a SUM (0011) and always was.
--
-- `currency = 'points'` is not a parameter and never will be. Points are the
-- currency the leaderboard sums; `fichas` is the loyalty currency earned by
-- spending, and the whole legal frame of the platform is that the second can
-- never reach the first — if consumption could move a ranking that decides a
-- prize, spending would improve the odds of winning and the programme would be
-- a private lottery. A staff correction of a pick'em score is a correction of
-- pick'em points, so the column is written literally here rather than passed
-- in, and no argument can make it say anything else.
--
-- No cap on the amount. A rail low enough to catch a fat finger is a rail that
-- eventually blocks a legitimate correction at the worst moment, and the panel
-- already asks for confirmation against a magnitude it considers unusual.
-- What is enforced here is what cannot be recovered by looking at the screen
-- again: a reason, and a number that does something.
create or replace function public.pickem_adjust_points(
  p_campaign_slug text,
  p_participant uuid,
  p_points int,
  p_note text,
  p_staff uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_participant public.participants;
  v_note text;
  v_entry public.points_entries;
  v_total bigint;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  -- Scoped to the campaign the caller was authorised for. A supervisor with a
  -- seat at one programme must not be able to move another programme's ledger
  -- by pasting in a participant id.
  select * into v_participant
  from public.participants
  where id = p_participant and campaign_id = v_campaign.id;
  if not found then
    raise exception 'participant_not_found';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is null then
    raise exception 'note_required';
  end if;

  -- Zero is not a correction. It writes a row that changes nothing and leaves a
  -- reason in the log implying something happened.
  if p_points = 0 then
    raise exception 'zero_adjustment';
  end if;

  insert into public.points_entries
    (campaign_id, participant_id, kind, currency, points, note, created_by)
  values
    (v_campaign.id, p_participant, 'adjustment', 'points', p_points, v_note, p_staff)
  returning * into v_entry;

  select coalesce(sum(points), 0) into v_total
  from public.points_entries
  where campaign_id = v_campaign.id
    and participant_id = p_participant
    and currency = 'points';

  return jsonb_build_object(
    'entryId', v_entry.id,
    'alias', v_participant.alias,
    'points', p_points,
    'note', v_note,
    'total', v_total
  );
end;
$$;

-- ===========================================================================
-- Finding a code at the counter
-- ===========================================================================
--
-- The read half of `pickem_redeem_award`, and it exists so that there is
-- exactly ONE rule for what a typed code matches.
--
-- The cashier reads the code off a phone screen across a counter. They may type
-- it lowercase, with the dashes or without, with a space where a dash was. The
-- redeem function already forgives all of that. If the panel's search forgave a
-- different set, the two would disagree at the worst possible moment: a code
-- the search cannot find but the redeem would have accepted looks, from the
-- customer's side, exactly like a prize that does not exist.
--
-- So the normalisation lives here, character for character the same expression,
-- and the panel never matches codes itself. Returns null rather than raising
-- when nothing matches: "no such code" is an answer to show on screen, not an
-- exception to translate.
create or replace function public.pickem_find_award(
  p_campaign_slug text,
  p_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_award public.pickem_awards;
  v_prize public.pickem_prizes;
  v_alias text;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  select * into v_award
  from public.pickem_awards
  where campaign_id = v_campaign.id
    and upper(regexp_replace(code, '[^a-zA-Z0-9]', '', 'g'))
      = upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));

  if not found then
    return null;
  end if;

  select * into v_prize from public.pickem_prizes where id = v_award.prize_id;
  select alias into v_alias from public.participants where id = v_award.participant_id;

  return jsonb_build_object(
    'code', v_award.code,
    'alias', coalesce(v_alias, 'Jugador'),
    'prize', v_prize.name,
    'detail', v_prize.detail,
    'week', v_award.week,
    'place', v_award.place,
    -- The stored status, and separately whether the date has passed. A pending
    -- award past its deadline is expired in fact whether or not anybody ran the
    -- update, and the counter has to be told that before it hands over a jersey.
    'status', v_award.status,
    'expired', now() > v_award.expires_at,
    'expiresAt', v_award.expires_at,
    'redeemedAt', v_award.redeemed_at,
    'redeemedVenue', v_award.redeemed_venue
  );
end;
$$;

-- ===========================================================================
-- Who may call what
-- ===========================================================================
--
-- `security definer` functions are granted to PUBLIC by default, so revoking
-- from anon and authenticated alone leaves the door open. PUBLIC first, then
-- grant back deliberately — the same order as 0023.
--
-- All four are service_role only, and none of them resolves the caller from
-- `auth.uid()`. That is the difference between these and `pickem_save_picks`:
-- a player's write says nothing about whose points to touch because the session
-- decides, while a supervisor's write names somebody else on purpose. The seat
-- that permits it is checked in the route, against `campaign_admins`, before
-- the service-role client is ever reached — and `p_staff` is passed from that
-- verified session rather than from the request body, so the signature on an
-- adjustment cannot be forged by whoever sent the JSON.
revoke all on function public.pickem_resolve_tie(text, int, uuid[], uuid) from public;
revoke all on function public.pickem_set_game_voided(text, uuid, boolean, uuid) from public;
revoke all on function public.pickem_adjust_points(text, uuid, int, text, uuid) from public;
revoke all on function public.pickem_find_award(text, text) from public;

grant execute on function public.pickem_resolve_tie(text, int, uuid[], uuid) to service_role;
grant execute on function public.pickem_set_game_voided(text, uuid, boolean, uuid) to service_role;
grant execute on function public.pickem_adjust_points(text, uuid, int, text, uuid) to service_role;
grant execute on function public.pickem_find_award(text, text) to service_role;

-- 0026 wrote this one and granted it to nobody but service_role, which was
-- right and which left it unreachable: no route called it. The panel's counter
-- screen is that caller. Restated here so the grant is visible next to the one
-- door that uses it.
grant execute on function public.pickem_redeem_award(text, text, text, uuid) to service_role;

comment on function public.pickem_resolve_tie(text, int, uuid[], uuid) is
  'Empate en la cima: el supervisor elige a uno de los empatados o reparte entre varios. pickem_settle_week nunca lo decide sola.';
comment on function public.pickem_set_game_voided(text, uuid, boolean, uuid) is
  'Anula o des-anula un partido pospuesto. Se niega si la jornada ya cerro: esa correccion va por pickem_adjust_points.';
comment on function public.pickem_adjust_points(text, uuid, int, text, uuid) is
  'Correccion manual del ledger, con motivo y autor obligatorios. El ledger es append-only: nunca se edita el asiento original.';
comment on function public.pickem_find_award(text, text) is
  'Busqueda de un codigo de premio en la caja. Normaliza igual que pickem_redeem_award para que buscar y canjear no puedan discrepar.';
