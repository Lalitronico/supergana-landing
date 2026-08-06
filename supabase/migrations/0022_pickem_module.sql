-- Pick'em: the tables. RPCs are 0023, the Chapa seed is 0024.
--
-- Third module after tickets and quinielas. What distinguishes it is time: a
-- quiniela is one match played once, a ticket race is a ladder with no
-- calendar, and a pick'em is eighteen appointments a player has to keep. Almost
-- everything below exists to make one of those appointments unambiguous —
-- when it opens, when it locks, and what it was worth.

-- ===========================================================================
-- The module joins the platform
-- ===========================================================================

alter table public.campaigns drop constraint if exists campaigns_module_check;
alter table public.campaigns add constraint campaigns_module_check
  check (module in ('tickets', 'quinielas', 'pickem'));

-- ---------------------------------------------------------------------------
-- Two currencies in one ledger
-- ---------------------------------------------------------------------------
--
-- This is the legal frame of the whole platform, in one column.
--
-- SUPERGANA_PLATAFORMA_FUNDAMENTOS.md and 0011 both say it: points are the
-- ACCUMULATION regime, earned by purchase and redeemed against fixed
-- thresholds, and they must never feed a draw — "comprar no mejora tus
-- probabilidades" is what keeps the programme out of private-lottery territory.
--
-- Pick'em inverts the risk. Its prize is decided by a competition, so the
-- danger is the mirror image: if spending money could add to a leaderboard
-- position, then buying more would improve the odds of winning, and the
-- programme becomes a lottery. The loyalty currency a tenant wants alongside
-- the game (Fichas Chapa, deferred past v1) is exactly the currency that must
-- never reach the ranking.
--
-- Encoding that as "the leaderboard filters kind = 'pickem_week'" would work
-- and would be one careless WHERE clause away from not working. A column named
-- for the distinction survives being read by somebody who does not know the
-- history: the leaderboard sums `currency = 'points'`, and a loyalty entry
-- cannot enter that sum by accident, only by someone typing the word.
alter table public.points_entries
  add column if not exists currency text not null default 'points';

alter table public.points_entries drop constraint if exists points_entries_currency_check;
alter table public.points_entries add constraint points_entries_currency_check
  check (currency in ('points', 'fichas'));

comment on column public.points_entries.currency is
  'points alimenta el ranking; fichas NUNCA. Es el limite entre un concurso y una loteria privada: si el consumo pudiera mover el leaderboard, gastar mejoraria la probabilidad de ganar.';

-- Where a week's points come from. `adjustment` already exists and stays the
-- correction path — the runbook is explicit that a mis-entered score is fixed
-- with a new entry, never by editing the original, because the ledger is
-- append-only.
alter table public.points_entries drop constraint if exists points_entries_kind_check;
alter table public.points_entries add constraint points_entries_kind_check
  check (kind in ('purchase', 'adjustment', 'redemption', 'pickem_week'));

-- ===========================================================================
-- The calendar
-- ===========================================================================
--
-- A season is a fact about the world, not about a tenant: the same 272 NFL
-- games serve Chapa and whoever signs next. So it lives outside `campaigns`,
-- and each programme points at one.
--
-- No display timezone here, deliberately. Which clock a player reads is a
-- property of the tenant, not of the league — a Juárez restaurant and a Mexico
-- City one would need different ones from the same season. It is already
-- `campaigns.config ->> 'timezone'`, which tickets_redeem_prize (0013) reads
-- for exactly this reason.
create table if not exists public.sport_seasons (
  id uuid primary key default gen_random_uuid(),
  league text not null default 'nfl',
  year int not null,
  -- Regular-season weeks. 18 in the NFL since 2021.
  weeks int not null check (weeks >= 1),
  created_at timestamptz not null default now(),
  unique (league, year)
);

create table if not exists public.sport_games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.sport_seasons(id) on delete cascade,
  week int not null check (week >= 1),
  -- Source is ESPN, and its abbreviations are the ones the logo CDN keys on.
  -- Washington is WSH there, not WAS — the only team whose own abbreviation
  -- and ESPN's disagree.
  away text not null check (away ~ '^[A-Z]{2,3}$'),
  home text not null check (home ~ '^[A-Z]{2,3}$'),
  -- UTC, always, and formatted for the player with Intl in the tenant's zone.
  -- Never offset arithmetic: Ciudad Juárez runs on Mountain time synced to El
  -- Paso, daylight saving ends 1 November 2026 mid-season, and a fixed ET−2
  -- would be an hour wrong from week 9 on. An hour is exactly enough to make
  -- somebody miss a lock they thought they had time for.
  kickoff_at timestamptz not null,
  -- Null until the league assigns it. Weeks 16-18 of 2026 arrive unassigned and
  -- the screens must say "cadena por definir" rather than draw an empty dash.
  network text,
  -- Derived from the kickoff, never asserted: "Ciudad de México", "Thursday
  -- Night", "Thanksgiving". A rule that only looked at the weekday once labelled
  -- a week 12 Wednesday game "kickoff de temporada".
  venue_note text,
  -- Final score. Null until the week is captured.
  away_score int check (away_score is null or away_score >= 0),
  home_score int check (home_score is null or home_score >= 0),
  -- A postponed game, taken out of the scoring. It happens over eighteen weeks —
  -- weather, emergencies; the league has done it. Without this the week can
  -- never settle, because settling refuses to run while a score is missing.
  --
  -- The mechanism, not the rule: whether a postponed game is annulled for
  -- everybody or replayed later is the client's call and belongs in the
  -- published rules before the season opens. Annulling is what this supports
  -- and what the runbook recommends, because it is the version that can be
  -- explained across a table in one sentence.
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  -- Two teams do not meet twice in the same week.
  unique (season_id, week, away, home),
  -- A score is captured whole or not at all. Half a score would let a week
  -- settle with a game whose winner is a coin flip.
  constraint sport_games_score_pairing
    check ((away_score is null) = (home_score is null))
);

create index if not exists sport_games_week_idx
  on public.sport_games (season_id, week, kickoff_at);

comment on column public.sport_games.kickoff_at is
  'UTC. La jornada 18 llega de ESPN con los 16 partidos en un mismo horario placeholder: la NFL no los fija hasta terminar la 17, asi que la re-ingesta del calendario no es opcional para esa jornada.';

-- ===========================================================================
-- The programme
-- ===========================================================================

create table if not exists public.pickem_programs (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  season_id uuid not null references public.sport_seasons(id) on delete restrict,
  -- The one week accepting picks. Earlier weeks are settled, later ones are
  -- visible but not playable — the demo showed them locked on purpose, because
  -- seeing week 12 exists is what makes an eighteen-week season feel like one.
  open_week int not null default 1 check (open_week >= 1),
  -- Every number the game is scored with. jsonb because the next tenant will
  -- want a different split and that must not be a migration. Read through
  -- lib/pickem/scoring.ts, which supplies these same defaults when a key is
  -- missing, so a half-filled config cannot produce a half-scored week.
  mechanics jsonb not null default '{
    "hit": 10,
    "tiebreak": 15,
    "tiebreakMargin": 3,
    "early": 5,
    "earlyHours": 24,
    "streak3": 20,
    "streak6": 50,
    "checkinMult": 1,
    "promoMult": 1
  }'::jsonb,
  -- Weeks the tenant has marked double. A promotional lever, not code: week 11
  -- is the Mexico City game and week 12 is Thanksgiving, both already full-table
  -- occasions.
  promo_weeks int[] not null default '{}',
  -- Where the game is played and prizes are collected. Free text per tenant.
  venues text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- Play
-- ===========================================================================

-- One entry per player per week. Picks hang off the entry so that the
-- tiebreak, the venue and the settle stamp live in one place instead of being
-- repeated across sixteen rows.
create table if not exists public.pickem_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  week int not null check (week >= 1),
  -- Predicted total points of the week's closing game.
  tiebreak int check (tiebreak is null or tiebreak >= 0),
  -- Which venue this week was played from. Copied from the check-in rather than
  -- from the profile: a regular who watches at Chapa Prime one week and Chapa
  -- Zaragoza the next should show up in each week's venue numbers where they
  -- actually were, or the per-venue report measures registration, not traffic.
  venue text,
  -- First submission. Not touched by later edits, because the early-bird bonus
  -- rewards deciding early and re-opening the screen to change one pick is not
  -- un-deciding.
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Stamped when the week settles. While null, the entry is editable.
  settled_at timestamptz,
  hits int check (hits is null or hits >= 0),
  points int check (points is null or points >= 0),
  -- The breakdown that produced `points`, kept so the screen can explain the
  -- score months later without re-deriving it from mechanics that may have been
  -- re-configured since. A player who cannot see where a number came from stops
  -- believing the ranking, and the ranking is the product.
  breakdown jsonb,
  -- The constraint of the module.
  unique (campaign_id, participant_id, week)
);

create index if not exists pickem_entries_week_idx
  on public.pickem_entries (campaign_id, week, points desc nulls last);

comment on column public.pickem_entries.points is
  'Cache de cierre, escrito una sola vez dentro de pickem_settle_week y nunca despues. La verdad sigue siendo pickem_picks contra sport_games; esto existe porque el leaderboard ordena por puntos y no vale recalcular 450 entradas por 16 partidos en cada carga.';

-- The pointer from the ledger back to the week that produced it. Without it,
-- "which jornada was this 540 for" is answerable only by parsing a note or
-- guessing from a timestamp — the same gap 0013 closed for redemptions.
alter table public.points_entries
  add column if not exists pickem_entry_id uuid
    references public.pickem_entries(id) on delete cascade;

-- One ledger entry per settled week entry, ever. Re-running a settle cannot pay
-- twice — the same invariant as points_entries_one_per_receipt (0011) and
-- points_entries_one_per_redemption (0013), and what makes the ON CONFLICT in
-- pickem_settle_week safe rather than hopeful.
create unique index if not exists points_entries_one_per_pickem_week
  on public.points_entries (pickem_entry_id) where kind = 'pickem_week';

create table if not exists public.pickem_picks (
  entry_id uuid not null references public.pickem_entries(id) on delete cascade,
  game_id uuid not null references public.sport_games(id) on delete restrict,
  choice text not null check (choice in ('away', 'home')),
  updated_at timestamptz not null default now(),
  primary key (entry_id, game_id)
);

-- ---------------------------------------------------------------------------
-- Check-in: presence, never consumption
-- ---------------------------------------------------------------------------
--
-- The mechanic that fills the dining room, and the one that has to stay clean.
-- It doubles a week's score, so under the rule above it cannot require spending
-- anything: scanning the table's QR is free, and the screen says so. What it
-- rewards is being at Chapa, not buying at Chapa. That distinction is not fine
-- print — it is the reason the multiplier is legal.
create table if not exists public.pickem_checkins (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  week int not null check (week >= 1),
  venue text not null,
  created_at timestamptz not null default now(),
  -- One per player per week: the QR belongs to the table, not to the person, so
  -- the limit cannot live on the code.
  unique (campaign_id, participant_id, week)
);

create index if not exists pickem_checkins_week_idx
  on public.pickem_checkins (campaign_id, week);

-- ===========================================================================
-- Row-level security
-- ===========================================================================

alter table public.sport_seasons enable row level security;
alter table public.sport_games enable row level security;
alter table public.pickem_programs enable row level security;
alter table public.pickem_entries enable row level security;
alter table public.pickem_picks enable row level security;
alter table public.pickem_checkins enable row level security;

grant select on public.sport_seasons to anon, authenticated;
grant select on public.sport_games to anon, authenticated;
grant select on public.pickem_programs to anon, authenticated;
grant select on public.pickem_entries to authenticated;
grant select on public.pickem_picks to authenticated;
grant select on public.pickem_checkins to authenticated;

-- The schedule is public. It is the NFL's calendar, there is nothing in it to
-- protect, and making it readable without a session is what lets the landing
-- screen render a real countdown to somebody who just scanned a QR and has not
-- signed in yet.
drop policy if exists sport_seasons_public_read on public.sport_seasons;
create policy sport_seasons_public_read on public.sport_seasons
  for select to anon, authenticated using (true);

drop policy if exists sport_games_public_read on public.sport_games;
create policy sport_games_public_read on public.sport_games
  for select to anon, authenticated using (true);

-- Programme configuration is public for the same reason: how many points an
-- answer is worth is a rule of the game, and a game whose rules are secret is
-- one nobody can check. Nothing sensitive lives on this table.
drop policy if exists pickem_programs_public_read on public.pickem_programs;
create policy pickem_programs_public_read on public.pickem_programs
  for select to anon, authenticated using (true);

-- Everything a player did is theirs alone. The leaderboard does NOT come from
-- relaxing this: 0011 anticipated the day a wider read was needed and said it
-- should be its own scoped view rather than a loosened policy. That view is
-- pickem_leaderboard in 0023, and it returns aliases and points — never a
-- phone number, an email or a real name.
--
-- Resolved through participant_devices rather than participants.auth_user_id,
-- because a player holds this identity on every device that proved the number.
drop policy if exists pickem_entries_self_read on public.pickem_entries;
create policy pickem_entries_self_read on public.pickem_entries
  for select to authenticated
  using (exists (
    select 1 from public.participant_devices d
    where d.participant_id = pickem_entries.participant_id
      and d.auth_user_id = (select auth.uid())
  ));

drop policy if exists pickem_picks_self_read on public.pickem_picks;
create policy pickem_picks_self_read on public.pickem_picks
  for select to authenticated
  using (exists (
    select 1
    from public.pickem_entries e
    join public.participant_devices d on d.participant_id = e.participant_id
    where e.id = pickem_picks.entry_id
      and d.auth_user_id = (select auth.uid())
  ));

drop policy if exists pickem_checkins_self_read on public.pickem_checkins;
create policy pickem_checkins_self_read on public.pickem_checkins
  for select to authenticated
  using (exists (
    select 1 from public.participant_devices d
    where d.participant_id = pickem_checkins.participant_id
      and d.auth_user_id = (select auth.uid())
  ));
