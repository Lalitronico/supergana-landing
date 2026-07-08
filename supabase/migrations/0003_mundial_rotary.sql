-- Quiniela Mundial 2026 x Rotary - donation campaign with staged prizes.
-- Unlike the PSG-Arsenal quiniela (anon RPC writes), all reads/writes for this
-- campaign go through Next.js API routes using the service role key. Anon has
-- no direct access to any of these tables.

create extension if not exists pgcrypto;

-- One row per paid ticket. The row id doubles as the secret access token the
-- participant uses to open the form, so it must never be exposed publicly.
create table if not exists public.mundial_tickets (
  id uuid primary key default gen_random_uuid(),
  email text,
  source text not null default 'stripe' check (source in ('stripe', 'manual')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount_usd numeric not null default 100,
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  note text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

-- One entry (filled quiniela) per ticket. created_at determines per-stage
-- prize eligibility: an entry only competes in stages whose lock time had
-- not passed when it was submitted.
create table if not exists public.mundial_entries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.mundial_tickets(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  email text not null,
  phone text not null,
  accepted_rules boolean not null default false,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

-- Real match results, captured by the admin as the tournament unfolds.
-- Single row keyed by a constant.
create table if not exists public.mundial_results (
  id boolean primary key default true check (id),
  qf_winners jsonb not null default '{}'::jsonb,   -- { "qf1": "fra", ... }
  finalists jsonb not null default '[]'::jsonb,    -- [ "fra", "eng" ]
  champion text,                                   -- team id
  runner_up text,
  champion_goals int,                              -- final score, champion side (90' + extra time)
  runner_up_goals int,
  updated_at timestamptz not null default now()
);

-- Winners per stage, computed by the admin panel and published to the
-- public transparency section once confirmed.
create table if not exists public.mundial_winners (
  stage text primary key check (stage in ('cuartos', 'semis', 'final')),
  payload jsonb not null,        -- winners list + scores + tiebreak notes
  prize_usd numeric not null default 0,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists mundial_entries_created_idx
  on public.mundial_entries (created_at);

-- Lock everything down: only the service role (which bypasses RLS) touches
-- these tables. No grants and no policies for anon/authenticated.
alter table public.mundial_tickets enable row level security;
alter table public.mundial_entries enable row level security;
alter table public.mundial_results enable row level security;
alter table public.mundial_winners enable row level security;

revoke all on public.mundial_tickets from anon, authenticated;
revoke all on public.mundial_entries from anon, authenticated;
revoke all on public.mundial_results from anon, authenticated;
revoke all on public.mundial_winners from anon, authenticated;

comment on table public.mundial_tickets is
  'Boletos pagados de la campaña Rotary. El id es el token secreto de acceso al formulario.';
comment on table public.mundial_entries is
  'Quinielas llenadas. created_at define elegibilidad por etapa (cuartos/semis/final).';
comment on table public.mundial_results is
  'Resultados reales del Mundial capturados por el admin (fila única).';
comment on table public.mundial_winners is
  'Ganadores calculados por etapa; published=true los muestra en la sección pública.';
