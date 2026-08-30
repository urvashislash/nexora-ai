-- Storage setup for the NEXORA AI MVP.
-- Run this after the Supabase project is created and connected.

create extension if not exists "http";

select storage.create_bucket('evidence-documents', false);

create policy "Allow read access to project members for evidence"
on storage.objects
for select
using (
  bucket_id = 'evidence-documents'
  and auth.uid() is not null
);

create policy "Allow uploads for project members"
on storage.objects
for insert
with check (
  bucket_id = 'evidence-documents'
  and auth.uid() is not null
);

create policy "Allow updates for project members"
on storage.objects
for update
using (
  bucket_id = 'evidence-documents'
  and auth.uid() is not null
);

create policy "Allow deletes for project members"
on storage.objects
for delete
using (
  bucket_id = 'evidence-documents'
  and auth.uid() is not null
);

-- Optional: mark the bucket as private and require service-role access for admin operations.
-- The Rust trust layer should own authorization and should not rely on browser uploads directly.
