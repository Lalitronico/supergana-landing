-- Identity by phone number, for a player who comes back for eighteen weeks.
--
-- The Carrera de Tickets identity is an email and a password: the reward is a
-- gift card that arrives in an inbox, so the inbox is the account. Pick'em
-- delivers its prize across a counter against a code, so the inbox buys
-- nothing — and asking for one is friction charged to every player for the
-- benefit of nobody. What the season actually needs is a key that survives a
-- new phone, because the points belong to the number, not to the device.
--
-- Three facts this migration establishes, in order of how much they cost to get
-- wrong:
--   1. A phone number identifies at most one player per campaign.
--   2. A player is only real once that number answered a code we sent it.
--   3. The same player may hold that identity on several devices at once.
--
-- Nothing here is pick'em-specific in the schema. A future module that also
-- identifies people by phone gets all three for free, which is the point.

-- ---------------------------------------------------------------------------
-- What each module actually requires of a participant
-- ---------------------------------------------------------------------------
--
-- `participants` was drawn for a US promotion: email, first and last name and a
-- ZIP, all NOT NULL, because eligibility was decided on geography and the
-- reward was mailed. 0015 already dropped the ZIP's NOT NULL when Carrera
-- Alaska turned out not to need it. Pick'em needs the other three gone too.
--
-- Dropping a NOT NULL cannot fail an existing row, which is the only reason
-- this is safe to run against live data: 12 rows in Ticket al Tanque and 5 in
-- Carrera Alaska, all of which already carry every value being relaxed.

alter table public.participants
  alter column email drop not null,
  alter column first_name drop not null,
  alter column last_name drop not null;

-- The requirement does not disappear, it becomes per-module. Expressing that as
-- a CHECK is impossible — a CHECK cannot contain a subquery, so it cannot read
-- the campaign's module — and the handoff that specified this table wrote the
-- constraint that way anyway, as intent. This is the trigger it has to be.
--
-- WHY THE MODULE IS ALSO COPIED ONTO THE ROW.
--
-- A trigger can join. A partial index cannot: its predicate is as subquery-free
-- as a CHECK, so `unique (campaign_id, phone) where the campaign is a pick'em`
-- is unwriteable without the module sitting on this table. And that index is
-- the one invariant of the module — one number, one player — which is worth
-- more than the tidiness of not duplicating a column.
--
-- Stale is the usual objection to a copy, and here it does not arise: the same
-- trigger rewrites it on every insert and update, and a campaign does not
-- change module. A tickets campaign that became a pick'em would be a different
-- product with the same rows.
alter table public.participants
  add column if not exists module text;

update public.participants p
   set module = c.module
  from public.campaigns c
 where c.id = p.campaign_id and p.module is distinct from c.module;

comment on column public.participants.module is
  'Copia de campaigns.module, reescrita por el trigger en cada insert/update. Existe para que participants_phone_per_campaign pueda ser un indice parcial: el predicado de un indice no admite subconsulta.';

create or replace function public.participants_module_requirements()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_module text;
begin
  select module into v_module from public.campaigns where id = new.campaign_id;
  new.module := v_module;

  if v_module = 'pickem' then
    -- The number is the account and the alias is how the leaderboard names
    -- them. Without either there is nothing to rank and nowhere to send a code.
    if new.phone is null then
      raise exception 'pickem participant requires phone';
    end if;
    if new.alias is null or btrim(new.alias) = '' then
      raise exception 'pickem participant requires alias';
    end if;
  else
    -- Every other module keeps exactly what 0006 demanded, so this trigger
    -- cannot change the behaviour of a campaign that is already running. The
    -- ZIP is absent on purpose: 0015 made it a campaign's decision and Carrera
    -- Alaska has already decided against it.
    if new.email is null or new.first_name is null or new.last_name is null then
      raise exception 'participant requires email, first_name and last_name';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists participants_module_requirements on public.participants;
create trigger participants_module_requirements
  before insert or update on public.participants
  for each row execute function public.participants_module_requirements();

-- ---------------------------------------------------------------------------
-- One number, one player
-- ---------------------------------------------------------------------------
--
-- The column and its E.164 format CHECK already exist (0015). What was missing
-- is the uniqueness that makes it an identity rather than a delivery address.
--
-- Scoped to pick'em, and the scope is the decision. In this module the number
-- IS the account: the season's points live on it, and two rows for one number
-- means one person's eighteen weeks split across two leaderboard positions,
-- neither of which is theirs.
--
-- In tickets the number is a delivery address for a top-up, and it is not this
-- module's business to decide whether a household may share one. Carrera Alaska
-- already holds two rows on one number — both test accounts, created two days
-- apart, which is itself the argument for the constraint on the side that needs
-- it. Imposing it retroactively on a running campaign is a different decision,
-- and not one a pick'em migration gets to make.
create unique index if not exists participants_phone_per_campaign
  on public.participants (campaign_id, phone)
  where phone is not null and module = 'pickem';

-- Proof that the number answered, kept separate from the number itself for the
-- same reason `email_verified_at` is (0010): storing it is recording a fact, and
-- the fact is what gates play, not the presence of a value in a text column.
alter table public.participants
  add column if not exists phone_verified_at timestamptz;

comment on column public.participants.phone_verified_at is
  'Sello de la verificacion por WhatsApp. Sin el, pickem_save_picks rechaza: un numero sin verificar es una cuenta que alguien abrio con el celular de otro.';

-- ---------------------------------------------------------------------------
-- The code we sent
-- ---------------------------------------------------------------------------
--
-- Keyed by participant, like email_verifications, and for the same reason its
-- hash cannot live on `participants`: a participant reads their own row, and a
-- sha256 of a four-digit code sitting in a readable column is four notches of
-- work away from being no code at all. RLS on, no policies, service_role only.
--
-- Four digits and not six: it is what the demo tested with the client, and at
-- five attempts per code and three codes an hour the search space that matters
-- is the one the rate limit defines, not the one the alphabet does.
create table if not exists public.phone_verifications (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  code_hash text not null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Attempts against THIS code. Burning them invalidates the code, never the
  -- account: locking a player out of an eighteen-week season because somebody
  -- fat-fingered a digit four times is a worse failure than the one it prevents.
  attempts int not null default 0,
  -- Resends are what cost the client money — every code is a Meta conversation
  -- billed to them. Counted in a window rather than ever, because a player who
  -- lost their phone in week 9 has a legitimate reason to ask again.
  resends int not null default 0,
  resend_window_started_at timestamptz not null default now()
);

alter table public.phone_verifications enable row level security;

comment on table public.phone_verifications is
  'Un codigo vivo por participante. Solo service_role. Emitir uno nuevo pisa el anterior: dos codigos validos a la vez duplican la superficie de adivinanza sin darle nada al jugador.';

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------
--
-- `participants.auth_user_id` is one column, so it can name one session. That
-- was right for tickets, where the account is an email and a password and
-- signing in on a second device reuses the same auth user.
--
-- Pick'em signs in anonymously: a second device is a second `auth.users` row
-- for the same person. With only that column, verifying on the tablet would
-- take the identity away from the phone — and the handoff is explicit that a
-- person with a phone and a tablet is a person, not an attack.
--
-- So the link becomes a table. `participants.auth_user_id` stays as the device
-- that created the row (it is NOT NULL and other modules read it); every device
-- that has proven the number, including that first one, gets a row here.
create table if not exists public.participant_devices (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- One session belongs to one player per campaign. The reverse is deliberately
  -- unconstrained: that is what "several devices" means.
  primary key (campaign_id, auth_user_id)
);

create index if not exists participant_devices_participant_idx
  on public.participant_devices (participant_id);

alter table public.participant_devices enable row level security;
grant select on public.participant_devices to authenticated;

-- Own rows only, like everything else. A device may see that it is linked; it
-- may not enumerate the other devices of the player it belongs to.
drop policy if exists participant_devices_self_read on public.participant_devices;
create policy participant_devices_self_read on public.participant_devices
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

comment on table public.participant_devices is
  'Sesiones que probaron el numero. Varios dispositivos por jugador a proposito; verificar en la tablet no debe cerrar la sesion del telefono.';
