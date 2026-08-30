-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 008: Auth User Mapping
-- =============================================================================
-- This migration sets up a trigger to automatically create a project_member
-- entry when a new user signs up via Supabase Auth, mapping them to the
-- default 'VIEWER' role for a designated project (or requires admin assignment).
-- =============================================================================

-- Ensure auth trigger function exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- We assume they're mapped to a default project if they sign up via the app
    -- A robust production implementation might lookup a project based on domain/email,
    -- or leave project_members empty until an ADMIN invites them.
    
    -- For now, we just log it in a custom table or insert a stub. 
    -- In NEXORA, 'project_members' requires a project_id. We'll leave it to the
    -- Rust trust layer to issue invitations, but this hook is available if needed.
    
    -- Example placeholder logic:
    -- INSERT INTO public.users (id, full_name, email)
    -- VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
