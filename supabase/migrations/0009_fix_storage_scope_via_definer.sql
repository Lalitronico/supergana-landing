-- Fixes 0008, which was correct in intent and unusable in practice.
--
-- 0008 put `join public.campaigns` inside the storage policy. RLS expressions
-- run as the invoking role, and `authenticated` deliberately has no SELECT on
-- `campaigns` -- the config holds the fund, the household rule and the alias
-- dictionary, none of which a participant may read. So the policy did not
-- merely fail to allow the attack, it denied every upload, including the
-- legitimate one:
--
--     bloqueó │ campaña a la que sí pertenece
--             │   permission denied for table campaigns
--
-- Granting the read would trade a littering bug for a real disclosure. The
-- lookup goes into a SECURITY DEFINER function instead, which is the narrowest
-- thing that can answer the question: it returns a boolean about the caller's
-- own membership and exposes no row either way.

create or replace function public.tickets_participates_in(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.participants p
    join public.campaigns c on c.id = p.campaign_id
    where p.auth_user_id = (select auth.uid())
      and c.slug = p_slug
  );
$$;

revoke all on function public.tickets_participates_in(text) from public, anon;
grant execute on function public.tickets_participates_in(text) to authenticated, service_role;

comment on function public.tickets_participates_in(text) is
  'Does the calling account have a participant row in this campaign? Used by the '
  'receipts storage policy, which cannot read public.campaigns directly. Returns '
  'only a boolean about the caller, so it discloses nothing about the campaign.';

drop policy if exists "receipts_upload_own_folder" on storage.objects;

create policy "receipts_upload_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.tickets_participates_in((storage.foldername(name))[1])
  );
