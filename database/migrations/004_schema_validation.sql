-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 004: Schema Validation & Alignment
-- =============================================================================
-- Aligns the actual schema with the locked MVP design in Backend_Schema.md.
-- Adds missing columns, constraints, trigger functions, and missing tables.
-- =============================================================================

-- ─────────────────────────────────────────────────
-- 0. Reusable updated_at trigger function
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables that have the column
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'public'
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I; '
            'CREATE TRIGGER trg_set_updated_at '
            'BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────
-- 1. projects — add missing columns from spec
-- ─────────────────────────────────────────────────

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS client_name TEXT,
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Add CHECK constraint for status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_projects_status'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT chk_projects_status
            CHECK (status IN ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'));
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────
-- 2. project_members — add discipline column
-- ─────────────────────────────────────────────────

ALTER TABLE project_members
    ADD COLUMN IF NOT EXISTS discipline TEXT;

-- ─────────────────────────────────────────────────
-- 3. schedule_versions — add missing columns
-- ─────────────────────────────────────────────────

ALTER TABLE schedule_versions
    ADD COLUMN IF NOT EXISTS source_system TEXT,
    ADD COLUMN IF NOT EXISTS checksum TEXT;

-- ─────────────────────────────────────────────────
-- 4. activities — add missing columns + date constraint
-- ─────────────────────────────────────────────────

ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS contractor TEXT,
    ADD COLUMN IF NOT EXISTS searchable_text TEXT;

-- planned_finish_date >= planned_start_date
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_activities_date_range'
    ) THEN
        ALTER TABLE activities
            ADD CONSTRAINT chk_activities_date_range
            CHECK (planned_finish_date >= planned_start_date);
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────
-- 5. outbox_events — align with richer Supabase version
-- ─────────────────────────────────────────────────

ALTER TABLE outbox_events
    ADD COLUMN IF NOT EXISTS aggregate_type TEXT,
    ADD COLUMN IF NOT EXISTS aggregate_id UUID,
    ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────
-- 6. activity_lineage — ensure exists (may already exist)
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    previous_activity_id UUID NOT NULL,
    new_activity_id UUID NOT NULL,
    transition_type TEXT NOT NULL CHECK (transition_type IN ('SPLIT', 'MERGE', 'RECODE', 'SCOPE_TRANSFER')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────
-- 7. terminology — ensure exists (may already exist)
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS terminology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    discipline TEXT NOT NULL,
    synonym_term TEXT NOT NULL,
    canonical_term TEXT NOT NULL,
    context_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, discipline, synonym_term)
);

-- ─────────────────────────────────────────────────
-- 8. Indexes for newly added columns
-- ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_members_discipline ON project_members(project_id, discipline);
CREATE INDEX IF NOT EXISTS idx_activity_lineage_project ON activity_lineage(project_id);
CREATE INDEX IF NOT EXISTS idx_terminology_project_discipline ON terminology(project_id, discipline);
