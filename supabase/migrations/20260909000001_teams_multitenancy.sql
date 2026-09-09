-- =============================================================================
-- NEXORA AI — Supabase Migration 20260909000001: Teams & Multi-Tenancy Hierarchy
-- =============================================================================

-- 1. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'PLANNER', 'ENGINEER', 'SUPERVISOR', 'AUDITOR', 'VIEWER')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_members_team_user UNIQUE (team_id, user_id)
);

-- 3. Team Invitations Table
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PLANNER', 'ENGINEER', 'SUPERVISOR', 'AUDITOR', 'VIEWER')),
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED', 'EXPIRED')),
    invited_by UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Add team_id to Project and Child Entities
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE document_jobs ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE document_extractions ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE work_observations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE match_proposals ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE actual_events ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE activity_current_state ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_lookup ON team_members(team_id, user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_email ON team_invitations(team_id, email, status);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_documents_team_id ON documents(team_id);
CREATE INDEX IF NOT EXISTS idx_work_observations_team_id ON work_observations(team_id);
CREATE INDEX IF NOT EXISTS idx_match_proposals_team_id ON match_proposals(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_team_id ON audit_events(team_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_team_id ON outbox_events(team_id);

-- 6. Helper Functions for RLS Security
CREATE OR REPLACE FUNCTION fn_user_has_team_access(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
          AND user_id = auth.uid()
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_user_team_role(p_team_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM team_members
        WHERE team_id = p_team_id
          AND user_id = auth.uid()
          AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 7. Enable RLS on Teams, Members, Invitations
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- 8. Teams Policies
DROP POLICY IF EXISTS teams_select_policy ON teams;
CREATE POLICY teams_select_policy ON teams
    FOR SELECT
    USING (
        created_by = auth.uid() OR fn_user_has_team_access(id)
    );

DROP POLICY IF EXISTS teams_insert_policy ON teams;
CREATE POLICY teams_insert_policy ON teams
    FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS teams_update_policy ON teams;
CREATE POLICY teams_update_policy ON teams
    FOR UPDATE
    USING (
        fn_user_team_role(id) IN ('OWNER', 'ADMIN')
    );

DROP POLICY IF EXISTS teams_delete_policy ON teams;
CREATE POLICY teams_delete_policy ON teams
    FOR DELETE
    USING (
        fn_user_team_role(id) = 'OWNER'
    );

-- 9. Team Members Policies
DROP POLICY IF EXISTS team_members_select_policy ON team_members;
CREATE POLICY team_members_select_policy ON team_members
    FOR SELECT
    USING (
        fn_user_has_team_access(team_id)
    );

DROP POLICY IF EXISTS team_members_write_policy ON team_members;
CREATE POLICY team_members_write_policy ON team_members
    FOR ALL
    USING (
        fn_user_team_role(team_id) IN ('OWNER', 'ADMIN')
    );

-- 10. Team Invitations Policies
DROP POLICY IF EXISTS team_invitations_select_policy ON team_invitations;
CREATE POLICY team_invitations_select_policy ON team_invitations
    FOR SELECT
    USING (
        fn_user_has_team_access(team_id) OR email = (auth.jwt() ->> 'email')
    );

DROP POLICY IF EXISTS team_invitations_write_policy ON team_invitations;
CREATE POLICY team_invitations_write_policy ON team_invitations
    FOR ALL
    USING (
        fn_user_team_role(team_id) IN ('OWNER', 'ADMIN')
    );

-- 11. Updated Projects Policy (allows team OWNER/ADMIN to access projects within their team)
DROP POLICY IF EXISTS projects_select_policy ON projects;
CREATE POLICY projects_select_policy ON projects
    FOR SELECT
    USING (
        (team_id IS NOT NULL AND fn_user_team_role(team_id) IN ('OWNER', 'ADMIN'))
        OR fn_user_has_project_access(id)
    );
