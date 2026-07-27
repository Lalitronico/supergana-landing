-- Scope receipt uploads to campaigns the account actually joined.
--
-- `receipts_upload_own_folder` pinned only the second path segment to
-- auth.uid(), so the first one -- the campaign -- was free. A signed-in
-- account could write `<cualquier-marca>/<su-uid>/x.jpg`, including a brand it
-- never joined and a slug that does not exist. Nothing leaked (reads are still
-- pinned to the caller's own uid folder), but for a module sold as one tenant
-- per brand it means another client's prefix can be littered by a stranger,
-- and per-campaign storage accounting stops meaning anything.
--
-- Verified 2026-07-27 by writing to `probe-campana-b/<uid>/` and
-- `campana-inventada/<uid>/` from a participant of ticket-al-tanque. Both
-- succeeded before this migration.
--
-- The upload happens from the browser before the receipt is registered, so the
-- check has to hold at that moment: it does, because `/subir/` is gated on
-- having a profile and `/registro/` writes the participants row first.

drop policy if exists "receipts_upload_own_folder" on storage.objects;

create policy "receipts_upload_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1
      from public.participants p
      join public.campaigns c on c.id = p.campaign_id
      where p.auth_user_id = (select auth.uid())
        and c.slug = (storage.foldername(name))[1]
    )
  );

-- Reads stay as they were: the folder's uid segment is the whole rule, because
-- a participant reading their own image does not need the campaign re-checked
-- and adding the join here would only cost a lookup per read.
