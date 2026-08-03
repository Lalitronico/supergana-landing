-- Applied to production as 20260724214849_tickets_helpers_search_path (between
-- 0007 and 0008); recovered from supabase_migrations.schema_migrations on
-- 2026-08-03 because the file never landed in the repo.

-- Pin search_path on the two helpers, matching what the approval and review
-- functions already do. They are SECURITY INVOKER so the exposure is smaller,
-- but tickets_approve_receipt calls them unqualified from inside a SECURITY
-- DEFINER body, and leaving one link of that chain resolvable by the caller's
-- search_path is not a distinction worth defending.
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
