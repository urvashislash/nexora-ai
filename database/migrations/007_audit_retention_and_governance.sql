-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 007: Audit Retention & Governance
-- =============================================================================
-- Adds support for:
-- 1. Legal hold flag on projects and audit records (prevents premature deletion)
-- 2. Audit archival tracking table (stores cold archive batch metadata & root hash)
-- 3. Stored functions for tamper-checked audit record archiving
-- =============================================================================

-- ─────────────────────────────────────────────────
-- 1. Extend audit_trail with governance columns
-- ─────────────────────────────────────────────────
ALTER TABLE audit_trail
    ADD COLUMN IF NOT EXISTS is_legal_hold BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archive_batch_id UUID;

-- Indexes for retention query performance
CREATE INDEX IF NOT EXISTS idx_audit_trail_retention 
    ON audit_trail (project_id, created_at) 
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_trail_legal_hold 
    ON audit_trail (project_id, is_legal_hold) 
    WHERE is_legal_hold = true;

-- ─────────────────────────────────────────────────
-- 2. Audit Archive Batches Table (Cold Storage Ledger)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    batch_number BIGSERIAL,
    record_count INTEGER NOT NULL CHECK (record_count > 0),
    root_hash VARCHAR(64) NOT NULL,
    oldest_record_at TIMESTAMPTZ NOT NULL,
    newest_record_at TIMESTAMPTZ NOT NULL,
    storage_uri TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on audit_archives
ALTER TABLE audit_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_archives_select_policy ON audit_archives
    FOR SELECT
    USING (
        project_id IN (
            SELECT pm.project_id FROM project_members pm
            WHERE pm.user_id = auth.uid() AND pm.is_active = true
        )
    );

-- Only ADMIN or Compliance officer can manage archives
CREATE POLICY audit_archives_write_policy ON audit_archives
    FOR ALL
    USING (
        project_id IN (
            SELECT pm.project_id FROM project_members pm
            WHERE pm.user_id = auth.uid() 
              AND pm.role IN ('ADMIN', 'AUDITOR') 
              AND pm.is_active = true
        )
    );

-- ─────────────────────────────────────────────────
-- 3. Stored procedure: Apply legal hold to project
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_project_legal_hold(
    p_project_id UUID,
    p_enabled BOOLEAN,
    p_actor_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE audit_trail
    SET is_legal_hold = p_enabled
    WHERE project_id = p_project_id;

    -- Create governance audit record
    INSERT INTO audit_trail (
        project_id,
        entity_type,
        entity_id,
        action,
        actor_id,
        actor_role,
        payload_hash,
        created_at
    ) VALUES (
        p_project_id,
        'PROJECT_GOVERNANCE',
        p_project_id,
        CASE WHEN p_enabled THEN 'ENABLE_LEGAL_HOLD' ELSE 'RELEASE_LEGAL_HOLD' END,
        p_actor_id,
        'COMPLIANCE_OFFICER',
        encode(digest(concat(p_project_id::text, p_enabled::text, now()::text), 'sha256'), 'hex'),
        now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
