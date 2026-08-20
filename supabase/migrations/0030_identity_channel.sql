-- Identity channel: how a campaign's participants prove who they are
-- ===========================================================================
--
-- WHY. Carrera Alaska cannot open. Its participants sign in with email and
-- password, and this project has no SMTP of its own: Supabase Free caps the
-- built-in sender at two messages an hour, so a password nobody can reset and a
-- code nobody receives is the whole front door. Meanwhile the platform's
-- WhatsApp account went live on 2026-08-19 -- business verified, template
-- `codigo_supergana` approved -- and pick'em already signs its players in with
-- it. Alaska should use the same door.
--
-- WHAT THIS IS NOT. It is not "Alaska uses WhatsApp". It is a campaign-level
-- choice between two identity channels, defaulting to the one every existing
-- campaign already uses. Ticket al Tanque's row is not touched by this
-- migration and its behaviour is unchanged byte for byte: its rewards are paid
-- to an email address, so email is the right channel for it and stays.
--
-- WHY 0030 AND NOT 0026. The same crossed numbering 0025 documents: 0021-0029
-- were written on the unmerged `modulo-pickem` branch and are already applied
-- to this database. Reusing one of those numbers for different contents would
-- make the history depend on which branch you rebuilt from. 0030 is the first
-- number free on both sides.
--
-- ORDER MATTERS. This migration only prepares the ground; it does not switch
-- any campaign. Alaska is still `email` when this runs, so its six test rows
-- (which have emails and no verified phone, two of them sharing a number) pass
-- the trigger below and are excluded by the partial index below. 0031 deletes
-- them and flips the channel, in that order. Running 0031 first fails.

-- ---------------------------------------------------------------------------
-- The channel, copied onto the row
-- ---------------------------------------------------------------------------
--
-- Denormalised for exactly the reason 0021 copied `module`: a partial index
-- predicate cannot contain a subquery, and the uniqueness below has to be
-- scoped to the campaigns where a phone number IS an identity. Nobody writes
-- this column by hand -- the trigger recomputes it on every insert and update.
alter table public.participants
  add column if not exists identity_channel text;

comment on column public.participants.identity_channel is
  'Copia de campaigns.config->auth->>channel (o phone si module=pickem). La escribe el trigger participants_module_requirements, nunca la aplicacion. Existe para que el indice unico parcial de telefono tenga un predicado sin subconsulta.';

-- ---------------------------------------------------------------------------
-- What a participant must carry, now that there are two ways to be one
-- ---------------------------------------------------------------------------
--
-- Replaces the function 0021 installed. The pick'em branch is byte-identical to
-- what it was; the `else` branch splits in two.
--
-- The phone branch keeps first_name and last_name REQUIRED. That is not
-- inertia: Alaska's prizes are handed over a counter against a redemption code,
-- and somebody has to be able to say whose name is on it. Only the email
-- becomes optional, and only where the email was never the delivery channel.
create or replace function public.participants_module_requirements()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_module  text;
  v_channel text;
begin
  select c.module,
         coalesce(c.config->'auth'->>'channel', 'email')
    into v_module, v_channel
    from public.campaigns c
   where c.id = new.campaign_id;

  new.module := v_module;
  -- Pick'em's channel is not a campaign's to choose: that module has no email
  -- anywhere in it. Anything else takes the campaign's word, and an unset or
  -- misspelled key reads as 'email' -- the direction where a mistake means an
  -- extra field, not an account nobody can prove.
  new.identity_channel := case
    when v_module = 'pickem' then 'phone'
    when v_channel = 'phone' then 'phone'
    else 'email'
  end;

  if v_module = 'pickem' then
    -- The number is the account and the alias is how the leaderboard names
    -- them. Without either there is nothing to rank and nowhere to send a code.
    if new.phone is null then
      raise exception 'pickem participant requires phone';
    end if;
    if new.alias is null or btrim(new.alias) = '' then
      raise exception 'pickem participant requires alias';
    end if;
  elsif new.identity_channel = 'phone' then
    -- The number replaces the address as the credential, and is written by the
    -- server from the proven session, never from a request body. The name still
    -- has to be there: the prize is collected in person.
    if new.phone is null then
      raise exception 'participant identified by phone requires phone';
    end if;
    if new.first_name is null or new.last_name is null then
      raise exception 'participant requires first_name and last_name';
    end if;
  else
    -- Every email campaign keeps exactly what 0006 demanded, so this trigger
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

-- Backfill. The trigger would compute the same values on the next write, but
-- leaving the column null until somebody happens to touch a row would leave the
-- index below silently indexing nothing. Written out rather than triggered so
-- the history says what every existing row became.
update public.participants p
   set identity_channel = case
         when c.module = 'pickem' then 'phone'
         when coalesce(c.config->'auth'->>'channel', 'email') = 'phone' then 'phone'
         else 'email'
       end
  from public.campaigns c
 where c.id = p.campaign_id
   and p.identity_channel is distinct from case
         when c.module = 'pickem' then 'phone'
         when coalesce(c.config->'auth'->>'channel', 'email') = 'phone' then 'phone'
         else 'email'
       end;

-- ---------------------------------------------------------------------------
-- One number, one participant -- wherever the number is the identity
-- ---------------------------------------------------------------------------
--
-- 0021 scoped this to `module = 'pickem'` and said why: in tickets the number
-- was a delivery address for a top-up, and whether a household may share one
-- was not a pick'em migration's decision to make. That is still right, and it
-- is what this changes rather than contradicts -- the predicate is no longer
-- "which module" but "is the number the credential here". Where it is, two rows
-- on one number means two people holding one key, and the second sign-in cannot
-- tell which account it opened.
--
-- Alaska's two rows sharing +526567767074 do not block this: it is still an
-- email campaign at this point in the migration order, so the predicate skips
-- them. 0031 removes them before the channel flips.
create unique index if not exists participants_phone_identity_per_campaign
  on public.participants (campaign_id, phone)
  where phone is not null and identity_channel = 'phone';

-- Subsumed: every pick'em row now carries identity_channel = 'phone', so the
-- new index covers everything the old one did. Two indexes enforcing one
-- invariant is one of them going stale.
drop index if exists public.participants_phone_per_campaign;

-- ---------------------------------------------------------------------------
-- The code we sent, before there is an account to hang it on
-- ---------------------------------------------------------------------------
--
-- WHY NOT `phone_verifications`. That table (0021) is keyed by participant,
-- because in pick'em the player row is created by `start`, before the code goes
-- out. Tickets must not do that: a participant row is what the review console
-- counts and lists, and minting one for every number somebody types into a
-- login box would fill the queue with people who never signed up. Here what is
-- being proven is a NUMBER, so the key is the number, and the participant is
-- created later by the profile step -- which stays the module's only writer of
-- `participants`.
--
-- Salted with campaign_id and phone on the application side, so a code minted
-- for one tenant cannot verify in another even if both were sent to the same
-- person in the same minute.
--
-- RLS on with NO policies, like `email_verifications` (0010) and
-- `phone_verifications` (0021): service_role only. A sha256 of four digits in a
-- readable column is four notches of work away from being no code at all.
create table if not exists public.phone_login_codes (
  campaign_id              uuid        not null references public.campaigns(id) on delete cascade,
  phone                    text        not null check (phone ~ '^\+[0-9]{10,15}$'),
  code_hash                text        not null,
  sent_at                  timestamptz not null default now(),
  expires_at               timestamptz not null,
  attempts                 int         not null default 0,
  resends                  int         not null default 0,
  resend_window_started_at timestamptz not null default now(),
  primary key (campaign_id, phone)
);

alter table public.phone_login_codes enable row level security;
revoke all on public.phone_login_codes from anon, authenticated;

-- Reads the per-campaign send breaker: "how many numbers were sent a code in
-- the last hour". Every one of those is a WhatsApp conversation billed to the
-- tenant, so the query behind it runs on every sign-in attempt.
create index if not exists phone_login_codes_sent_idx
  on public.phone_login_codes (campaign_id, sent_at desc);

comment on table public.phone_login_codes is
  'Codigo OTP vivo por (campana, telefono). Existe antes que la cuenta: probar un numero no crea participante. Solo service_role. Se borra al confirmar; el cron purga los de mas de 7 dias.';
