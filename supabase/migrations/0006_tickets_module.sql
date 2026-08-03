-- Platform core (organization → campaign → participant) + the Carrera de
-- Tickets module. Written 2026-07-24 against MODULO_CARRERA_TICKETS_PLAN.md
-- and BRIEF_MAESTRO_NOVAMEX_SUPERGANA.md.
--
-- Scope of this migration is the v1 reward flow only: register → upload
-- receipt → manual review → $20 delivered. Points, missions, weekly caps,
-- leaderboard and the grand-prize drawing are v1.1 and deliberately absent —
-- the drawing drags AMOE and state registration behind it.
--
-- Two auth surfaces, both on Supabase Auth:
--   participants  → auth.users row + a participants row per campaign
--   staff         → auth.users row + a campaign_admins row per campaign
-- Owner-scoped reads are open to `authenticated` through RLS. Everything that
-- moves money or decides eligibility goes through service_role API routes.

create extension if not exists pgcrypto;

-- ===========================================================================
-- Tenancy
-- ===========================================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- A campaign is the tenant boundary for every row below. Everything a client
-- can change without a deploy lives in `config`; see lib/tickets/config.ts for
-- the shape and the defaults applied when a key is missing.
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  module text not null default 'tickets' check (module in ('tickets', 'quinielas')),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  locales text[] not null default array['es', 'en'],
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Staff allowlist. Being in auth.users is not authorization: a reviewer only
-- exists relative to one campaign, and the role decides what they may do.
create table if not exists public.campaign_admins (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'reviewer'
    check (role in ('reviewer', 'supervisor', 'finance', 'admin')),
  created_at timestamptz not null default now(),
  primary key (campaign_id, auth_user_id)
);

-- ===========================================================================
-- Participants and consent
-- ===========================================================================

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  zip text not null check (zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
  state text check (state ~ '^[A-Z]{2}$'),
  locale text not null default 'es' check (locale in ('es', 'en')),
  alias text,                          -- public leaderboard name; v1.1
  -- Household key, decided 2026-07-24: normalized last name + ZIP digits.
  -- The brief promises "one reward per participant/household" but never
  -- defines household. This is deliberately a coarse key — two unrelated
  -- families can collide — so it FLAGS a claim for the reviewer rather than
  -- rejecting it. The hard block lives in tickets_approve_receipt.
  household_key text generated always as (
    lower(btrim(last_name)) || '|' || regexp_replace(zip, '[^0-9]', '', 'g')
  ) stored,
  created_at timestamptz not null default now(),
  unique (campaign_id, auth_user_id)
);

create index if not exists participants_household_idx
  on public.participants (campaign_id, household_key);

-- Append-only. Versioned because rules can change mid-campaign and we must be
-- able to answer "who accepted which version" a year later.
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  kind text not null check (kind in ('age_state', 'official_rules', 'marketing')),
  version text not null,
  accepted boolean not null,
  accepted_at timestamptz not null default now(),
  ip text,
  user_agent text
);

create index if not exists consents_participant_idx
  on public.consents (participant_id, kind, accepted_at desc);

-- ===========================================================================
-- Product catalogue
-- ===========================================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  brand text not null,
  name text not null,
  size text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- The reason receipt validation works at all. The same product prints
-- differently per retailer — CAMARONAZO 32OZ vs CAMARONAZO TOM, DGARI FRESA
-- vs D GARI GEL FRSA. Any model assuming one product = one string fails on
-- the first real receipt.
create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  retailer text,                      -- null = applies to every retailer
  alias_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists products_campaign_idx on public.products (campaign_id, active);
create index if not exists product_aliases_product_idx on public.product_aliases (product_id);
create index if not exists product_aliases_text_idx on public.product_aliases (lower(alias_text));

-- ===========================================================================
-- Receipts
-- ===========================================================================

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  status text not null default 'received'
    check (status in ('received', 'in_review', 'approved', 'rejected', 'needs_new_image')),
  image_path text not null,           -- object key inside the private bucket
  image_hash text,                    -- sha256 of the bytes, computed server-side
  submitted_at timestamptz not null default now(),

  -- Filled by the reviewer. No OCR in v1: the console captures these by hand,
  -- which is exactly what the 48h promise already covers.
  store_name text,
  purchase_date date,
  total_cents int check (total_cents is null or total_cents >= 0),
  eligible_cents int check (eligible_cents is null or eligible_cents >= 0),
  -- retailer + purchase date + total. The cheapest block for the most common
  -- abuse: the same receipt submitted from two accounts.
  dedupe_key text,
  reject_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

-- Both partial: a receipt has no dedupe_key until someone reviews it, and a
-- hash can be null if the object vanished before we could read it.
create unique index if not exists receipts_dedupe_uq
  on public.receipts (campaign_id, dedupe_key)
  where dedupe_key is not null;

create unique index if not exists receipts_image_hash_uq
  on public.receipts (campaign_id, image_hash)
  where image_hash is not null;

create index if not exists receipts_queue_idx
  on public.receipts (campaign_id, status, submitted_at);

create index if not exists receipts_participant_idx
  on public.receipts (participant_id, submitted_at desc);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  alias_matched text,
  line_text text not null,
  amount_cents int not null check (amount_cents >= 0)
);

create index if not exists receipt_items_receipt_idx on public.receipt_items (receipt_id);

-- Append-only decision log. A single reviewed_at/reviewed_by pair loses the
-- history of a receipt that went received → needs_new_image → approved, and
-- the brief asks for an immutable log of approver, date and reason.
create table if not exists public.receipt_reviews (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  reviewer uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'needs_new_image', 'reopened')),
  reason text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists receipt_reviews_receipt_idx
  on public.receipt_reviews (receipt_id, created_at);

-- ===========================================================================
-- Rewards
-- ===========================================================================

-- One row per approved claim. Created inside the same transaction that
-- approves the receipt, so the fund can never be overdrawn.
-- v1 delivers by hand (provider='manual'); Tremendous slots in behind the
-- same interface without touching this table.
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  receipt_id uuid not null unique references public.receipts(id) on delete restrict,
  amount_cents int not null check (amount_cents > 0),
  provider text not null default 'manual' check (provider in ('manual', 'tremendous')),
  -- Sent to the payout provider as its idempotency key. Retrying an order
  -- with the same external_id must never create a second reward.
  external_id uuid not null unique default gen_random_uuid(),
  provider_ref text,
  status text not null default 'reserved'
    check (status in ('reserved', 'queued', 'sent', 'delivered', 'failed', 'canceled')),
  -- Denormalised so the weekly quota and the fiscal-year total can be
  -- answered without walking back through receipts.
  household_key text not null,
  week_start timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists rewards_campaign_week_idx
  on public.rewards (campaign_id, week_start);

create index if not exists rewards_household_idx
  on public.rewards (campaign_id, household_key);

-- Also the fiscal-year index: the 1099 threshold is per winner per year, and
-- `participant_id + created_at range` answers "how much has this person
-- received in 2026" without reprocessing. A date_trunc('year', ...) index
-- would be rejected — date_trunc over timestamptz is STABLE, not IMMUTABLE.
create index if not exists rewards_participant_idx
  on public.rewards (participant_id, created_at desc);

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- Monday 00:00 in the campaign's timezone. date_trunc('week') is Monday-based
-- in Postgres, which is what "new rewards released every Monday" needs.
-- search_path is pinned on every function in this module: the approval path is
-- SECURITY DEFINER and calls these two unqualified, so leaving one link of that
-- chain resolvable by the caller's search_path is not a distinction worth
-- defending.
create or replace function public.tickets_week_start(p_tz text, p_at timestamptz default now())
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select date_trunc('week', (p_at at time zone p_tz)) at time zone p_tz;
$$;

create or replace function public.tickets_config_int(p_config jsonb, p_key text, p_default int)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce((p_config ->> p_key)::int, p_default);
$$;

-- ===========================================================================
-- Approval: the only place a reward is ever created
-- ===========================================================================

-- Every eligibility rule is checked under a campaign row lock, so two
-- reviewers approving at the same instant cannot both take the last slot of
-- the weekly quota or the last dollar of the fund.
--
-- Failures are raised with a stable machine code as the message; the API
-- route maps it to bilingual copy. Codes:
--   bad_status | below_threshold | duplicate_receipt | participant_limit
--   household_limit | weekly_quota | slots_exhausted | fund_exhausted
create or replace function public.tickets_approve_receipt(
  p_receipt_id uuid,
  p_reviewer uuid,
  p_store_name text,
  p_purchase_date date,
  p_total_cents int,
  p_eligible_cents int,
  p_items jsonb default '[]'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.receipts;
  v_campaign public.campaigns;
  v_participant public.participants;
  v_config jsonb;
  v_tz text;
  v_reward_cents int;
  v_min_cents int;
  v_week timestamptz;
  v_dedupe text;
  v_reward public.rewards;
  v_used_cents bigint;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'receipt_not_found';
  end if;

  -- Lock the campaign: this is what serialises concurrent approvals.
  select * into v_campaign from public.campaigns where id = v_receipt.campaign_id for update;
  select * into v_participant from public.participants where id = v_receipt.participant_id;

  v_config := v_campaign.config;
  v_tz := coalesce(v_config ->> 'timezone', 'America/Denver');
  v_reward_cents := tickets_config_int(v_config, 'reward_cents', 2000);
  v_min_cents := tickets_config_int(v_config, 'min_purchase_cents', 1000);
  v_week := public.tickets_week_start(v_tz, now());

  if v_receipt.status not in ('received', 'in_review', 'needs_new_image') then
    raise exception 'bad_status';
  end if;

  if p_eligible_cents < v_min_cents then
    raise exception 'below_threshold';
  end if;

  if p_eligible_cents > p_total_cents then
    raise exception 'eligible_above_total';
  end if;

  v_dedupe := lower(btrim(p_store_name)) || '|' || p_purchase_date::text || '|' || p_total_cents::text;
  if exists (
    select 1 from public.receipts r
    where r.campaign_id = v_receipt.campaign_id
      and r.dedupe_key = v_dedupe
      and r.id <> v_receipt.id
  ) then
    raise exception 'duplicate_receipt';
  end if;

  if (
    select count(*) from public.rewards
    where participant_id = v_receipt.participant_id and status <> 'canceled'
  ) >= tickets_config_int(v_config, 'per_participant_limit', 1) then
    raise exception 'participant_limit';
  end if;

  if (
    select count(*) from public.rewards
    where campaign_id = v_receipt.campaign_id
      and household_key = v_participant.household_key
      and status <> 'canceled'
  ) >= tickets_config_int(v_config, 'per_household_limit', 1) then
    raise exception 'household_limit';
  end if;

  if (
    select count(*) from public.rewards
    where campaign_id = v_receipt.campaign_id
      and week_start = v_week
      and status <> 'canceled'
  ) >= tickets_config_int(v_config, 'weekly_quota', 150) then
    raise exception 'weekly_quota';
  end if;

  if (
    select count(*) from public.rewards
    where campaign_id = v_receipt.campaign_id and status <> 'canceled'
  ) >= tickets_config_int(v_config, 'total_reward_slots', 1200) then
    raise exception 'slots_exhausted';
  end if;

  select coalesce(sum(amount_cents), 0) into v_used_cents
  from public.rewards
  where campaign_id = v_receipt.campaign_id and status <> 'canceled';

  if v_used_cents + v_reward_cents > tickets_config_int(v_config, 'fund_cents', 3000000) then
    raise exception 'fund_exhausted';
  end if;

  update public.receipts set
    status = 'approved',
    store_name = btrim(p_store_name),
    purchase_date = p_purchase_date,
    total_cents = p_total_cents,
    eligible_cents = p_eligible_cents,
    dedupe_key = v_dedupe,
    reject_reason = null,
    reviewed_at = now(),
    reviewed_by = p_reviewer
  where id = p_receipt_id;

  delete from public.receipt_items where receipt_id = p_receipt_id;
  insert into public.receipt_items (receipt_id, product_id, alias_matched, line_text, amount_cents)
  select
    p_receipt_id,
    nullif(item ->> 'product_id', '')::uuid,
    nullif(item ->> 'alias_matched', ''),
    item ->> 'line_text',
    (item ->> 'amount_cents')::int
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  where coalesce(item ->> 'line_text', '') <> '';

  insert into public.rewards (
    campaign_id, participant_id, receipt_id, amount_cents,
    provider, status, household_key, week_start, note
  ) values (
    v_receipt.campaign_id, v_receipt.participant_id, p_receipt_id, v_reward_cents,
    coalesce(v_config ->> 'payout_provider', 'manual'), 'reserved',
    v_participant.household_key, v_week, p_note
  )
  returning * into v_reward;

  insert into public.receipt_reviews (receipt_id, reviewer, decision, reason, snapshot)
  values (
    p_receipt_id, p_reviewer, 'approved', p_note,
    jsonb_build_object(
      'store_name', btrim(p_store_name),
      'purchase_date', p_purchase_date,
      'total_cents', p_total_cents,
      'eligible_cents', p_eligible_cents,
      'items', coalesce(p_items, '[]'::jsonb)
    )
  );

  return jsonb_build_object(
    'reward_id', v_reward.id,
    'external_id', v_reward.external_id,
    'amount_cents', v_reward.amount_cents,
    'week_start', v_reward.week_start
  );
end;
$$;

-- Reject / ask for a new image. Kept separate from approval because it moves
-- no money and needs none of the locking.
create or replace function public.tickets_review_receipt(
  p_receipt_id uuid,
  p_reviewer uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.receipts;
begin
  if p_decision not in ('rejected', 'needs_new_image', 'in_review') then
    raise exception 'bad_decision';
  end if;

  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'receipt_not_found';
  end if;
  if v_receipt.status = 'approved' then
    raise exception 'bad_status';
  end if;

  update public.receipts set
    status = p_decision,
    reject_reason = case when p_decision = 'in_review' then null else p_reason end,
    reviewed_at = case when p_decision = 'in_review' then null else now() end,
    reviewed_by = case when p_decision = 'in_review' then null else p_reviewer end
  where id = p_receipt_id;

  insert into public.receipt_reviews (receipt_id, reviewer, decision, reason)
  values (
    p_receipt_id,
    p_reviewer,
    case when p_decision = 'in_review' then 'reopened' else p_decision end,
    p_reason
  );

  return jsonb_build_object('receipt_id', p_receipt_id, 'status', p_decision);
end;
$$;

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.organizations   enable row level security;
alter table public.campaigns       enable row level security;
alter table public.campaign_admins enable row level security;
alter table public.participants    enable row level security;
alter table public.consents        enable row level security;
alter table public.products        enable row level security;
alter table public.product_aliases enable row level security;
alter table public.receipts        enable row level security;
alter table public.receipt_items   enable row level security;
alter table public.receipt_reviews enable row level security;
alter table public.rewards         enable row level security;

-- Start from zero: Supabase's default privileges hand anon/authenticated full
-- DML on new public tables, and RLS alone would not stop a DELETE.
revoke all on public.organizations, public.campaigns, public.campaign_admins,
  public.participants, public.consents, public.products, public.product_aliases,
  public.receipts, public.receipt_items, public.receipt_reviews, public.rewards
  from anon, authenticated;

-- Participants may read their own rows and nothing else. Writes go through
-- service_role API routes, which is where eligibility and money live.
grant select on public.participants, public.consents, public.receipts,
  public.receipt_items, public.rewards to authenticated;

drop policy if exists participants_self_read on public.participants;
create policy participants_self_read on public.participants
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists consents_self_read on public.consents;
create policy consents_self_read on public.consents
  for select to authenticated
  using (exists (
    select 1 from public.participants p
    where p.id = consents.participant_id and p.auth_user_id = (select auth.uid())
  ));

drop policy if exists receipts_self_read on public.receipts;
create policy receipts_self_read on public.receipts
  for select to authenticated
  using (exists (
    select 1 from public.participants p
    where p.id = receipts.participant_id and p.auth_user_id = (select auth.uid())
  ));

drop policy if exists receipt_items_self_read on public.receipt_items;
create policy receipt_items_self_read on public.receipt_items
  for select to authenticated
  using (exists (
    select 1 from public.receipts r
    join public.participants p on p.id = r.participant_id
    where r.id = receipt_items.receipt_id and p.auth_user_id = (select auth.uid())
  ));

drop policy if exists rewards_self_read on public.rewards;
create policy rewards_self_read on public.rewards
  for select to authenticated
  using (exists (
    select 1 from public.participants p
    where p.id = rewards.participant_id and p.auth_user_id = (select auth.uid())
  ));

-- Nobody but service_role runs the approval path.
revoke all on function public.tickets_approve_receipt(uuid, uuid, text, date, int, int, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.tickets_review_receipt(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.tickets_approve_receipt(uuid, uuid, text, date, int, int, jsonb, text)
  to service_role;
grant execute on function public.tickets_review_receipt(uuid, uuid, text, text)
  to service_role;

-- ===========================================================================
-- Receipt image storage
-- ===========================================================================

-- Private bucket. A receipt carries location, date and shopping habits — it is
-- personal data, never a public URL. The console views images through
-- short-lived signed URLs minted server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object keys are `<campaign-slug>/<auth-uid>/<uuid>.<ext>`, so the second
-- path segment is the only thing the policy needs to check. Participants
-- upload straight to storage — routing 8 MB phone photos through a serverless
-- function would hit Vercel's request body limit.
drop policy if exists receipts_upload_own_folder on storage.objects;
create policy receipts_upload_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists receipts_read_own_folder on storage.objects;
create policy receipts_read_own_folder on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ===========================================================================
-- Comments
-- ===========================================================================

comment on table public.organizations is
  'Tenant raíz de la plataforma. Una fila por marca cliente.';
comment on table public.campaigns is
  'Activación de un módulo para una organización. Todo lo configurable vive en config (jsonb): umbrales, cupos, fondo, estados elegibles.';
comment on table public.campaign_admins is
  'Allowlist de staff por campaña. Estar en auth.users no autoriza nada.';
comment on table public.participants is
  'Perfil del participante dentro de una campaña. household_key = apellido normalizado + ZIP.';
comment on table public.consents is
  'Registro append-only de consentimientos con versión de reglas y timestamp.';
comment on table public.product_aliases is
  'Cómo se imprime cada producto en el ticket de cada retailer. Sin esto la validación falla en el primer ticket real.';
comment on table public.receipts is
  'Tickets subidos. Estados: received → in_review → approved | rejected | needs_new_image.';
comment on table public.receipt_reviews is
  'Bitácora append-only de decisiones: revisor, fecha, motivo y captura del momento.';
comment on table public.rewards is
  'Recompensas aprobadas. Creadas dentro de la transacción que aprueba el ticket; external_id es la llave idempotente del proveedor de pago.';
comment on function public.tickets_approve_receipt(uuid, uuid, text, date, int, int, jsonb, text) is
  'Única vía para crear una recompensa. Verifica umbral, duplicado, límite por participante y hogar, cupo semanal, slots y fondo bajo lock de la campaña.';
