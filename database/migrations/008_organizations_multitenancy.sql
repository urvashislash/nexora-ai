-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 008: Organizations & Multitenancy
-- =============================================================================

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add Organization ID to Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- 3. Seed Default Organization
INSERT INTO organizations (id, code, name, description)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'NEXORA-CORP',
    'NEXORA Infrastructure Solutions',
    'Enterprise construction portfolio organization'
)
ON CONFLICT (code) DO NOTHING;

-- 4. Associate Existing Projects with Default Organization
UPDATE projects
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- 5. Create Performance Indexes for Multitenant Queries
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_lookup ON project_members(project_id, user_id, is_active);
