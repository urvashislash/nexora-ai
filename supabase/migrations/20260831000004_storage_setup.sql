-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 007: Storage Setup
-- =============================================================================
-- Creates the 'evidence-documents' bucket in Supabase Storage and sets up RLS
-- policies for authenticated users.
-- =============================================================================

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-documents', 'evidence-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Setup RLS for the bucket
-- Allow read access to authenticated users
DROP POLICY IF EXISTS "Allow read access to project members for evidence" ON storage.objects;
CREATE POLICY "Allow read access to project members for evidence"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'evidence-documents' );

-- Allow inserts (uploads) for authenticated users
DROP POLICY IF EXISTS "Allow uploads for project members" ON storage.objects;
CREATE POLICY "Allow uploads for project members"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'evidence-documents' );

-- Allow updates
DROP POLICY IF EXISTS "Allow updates for project members" ON storage.objects;
CREATE POLICY "Allow updates for project members"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'evidence-documents' );

-- Allow deletes
DROP POLICY IF EXISTS "Allow deletes for project members" ON storage.objects;
CREATE POLICY "Allow deletes for project members"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'evidence-documents' );
