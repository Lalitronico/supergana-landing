-- Applied to production as 20260724212037_tickets_receipt_storage (between
-- 0006 and 0007); recovered from supabase_migrations.schema_migrations on
-- 2026-08-03 because the file never landed in the repo.

-- Private bucket for receipt images. A receipt carries location, date and
-- shopping habits — personal data, never a public URL. The console views them
-- through short-lived signed URLs minted server-side.
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
-- upload straight to storage: routing 8 MB phone photos through a serverless
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
