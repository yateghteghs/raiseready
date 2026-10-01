-- Private storage buckets (spec sections 3, 6.5, 8).
-- Object paths are `{owner_id}/{startup_id}/{file}` so ownership can be
-- checked from the first path segment.
-- Uploads and deletes go through server code (service role) after content
-- validation; founders may only read their own objects, which is what creating
-- a short-lived signed URL with their session requires.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 20971520, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('reports', 'reports', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "documents bucket: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "reports bucket: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
