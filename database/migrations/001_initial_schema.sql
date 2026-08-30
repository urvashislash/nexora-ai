-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 001: Initial Schema
-- =============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Project Members Table
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PLANNER', 'ENGINEER', 'SUPERVISOR', 'AUDITOR', 'VIEWER')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- 4. Schedule Versions Table
CREATE TABLE IF NOT EXISTS schedule_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_label TEXT NOT NULL,
    version_type TEXT NOT NULL CHECK (version_type IN ('BASELINE', 'CURRENT_APPROVED', 'REVISED', 'WHAT_IF')),
    source_file_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, version_number)
);

-- 5. WBS Nodes Table (L1 - L4)
CREATE TABLE IF NOT EXISTS wbs_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES wbs_nodes(id) ON DELETE CASCADE,
    wbs_code TEXT NOT NULL,
    name TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
    path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(schedule_version_id, wbs_code)
);

-- 6. Activities Table (L5 / L6)
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
    wbs_id UUID NOT NULL REFERENCES wbs_nodes(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    discipline TEXT NOT NULL CHECK (discipline IN ('CIVIL', 'PIPING', 'MECHANICAL', 'ELECTRICAL', 'INSTRUMENTATION', 'HSE', 'GENERAL')),
    planned_start_date DATE NOT NULL,
    planned_finish_date DATE NOT NULL,
    planned_duration_days INTEGER NOT NULL CHECK (planned_duration_days >= 0),
    planned_quantity NUMERIC(14, 4),
    unit_of_measure TEXT,
    location TEXT,
    zone TEXT,
    equipment_tag TEXT,
    weightage NUMERIC(6, 4) DEFAULT 1.0,
    critical_path BOOLEAN NOT NULL DEFAULT false,
    embedding VECTOR(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(schedule_version_id, code)
);

-- 7. Activity Dependencies Table
CREATE TABLE IF NOT EXISTS activity_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
    predecessor_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    successor_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
    lag_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(predecessor_id, successor_id)
);

-- 8. Documents Table (Ingested files)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT,
    storage_bucket TEXT NOT NULL DEFAULT 'evidence-documents',
    storage_key TEXT NOT NULL,
    checksum_sha256 TEXT,
    source_type TEXT NOT NULL CHECK (source_type IN ('DAILY_REPORT', 'DISCIPLINE_SPREADSHEET', 'SITE_DIARY', 'VOICE', 'IMAGE', 'MANUAL', 'SCHEDULE')),
    document_type TEXT,
    classification TEXT NOT NULL DEFAULT 'INTERNAL',
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

-- 9. Document Processing Jobs
CREATE TABLE IF NOT EXISTS document_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('PARSE', 'OCR', 'ASR', 'EXTRACT', 'NORMALIZE', 'EMBED', 'MATCH')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'RETRYING')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 10. Document Extractions (Raw and Structured Artifacts)
CREATE TABLE IF NOT EXISTS document_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    extraction_version TEXT NOT NULL DEFAULT 'v1.0',
    extracted_text TEXT,
    structured_output JSONB,
    extraction_confidence NUMERIC(5, 4),
    model_name TEXT,
    model_version TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Work Observations Table (Canonical Field Facts)
CREATE TABLE IF NOT EXISTS work_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    reported_by UUID,
    observed_at TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    discipline TEXT,
    location TEXT,
    zone TEXT,
    equipment_tag TEXT,
    raw_text TEXT NOT NULL,
    normalized_text TEXT,
    event_type TEXT CHECK (event_type IN ('START', 'PROGRESS', 'FINISH', 'DELAY', 'BLOCKER', 'INSPECTION')),
    reported_progress NUMERIC(6, 2),
    reported_quantity NUMERIC(14, 4),
    unit_of_measure TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Match Proposals Table
CREATE TABLE IF NOT EXISTS match_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    observation_id UUID NOT NULL REFERENCES work_observations(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    candidate_rank INTEGER NOT NULL DEFAULT 1,
    lexical_score NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
    semantic_score NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
    context_boost NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
    confidence_score NUMERIC(5, 4) NOT NULL,
    match_tier TEXT NOT NULL CHECK (match_tier IN ('HIGH', 'MEDIUM', 'LOW', 'UNMATCHED')),
    explanation TEXT,
    evidence_snippet TEXT,
    model_version TEXT,
    status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'AUTO_LINKED', 'PENDING_REVIEW', 'ACCEPTED', 'OVERRIDDEN', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Actual Events Table (Immutable Event Ledger)
CREATE TABLE IF NOT EXISTS actual_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
    observation_id UUID REFERENCES work_observations(id) ON DELETE SET NULL,
    match_proposal_id UUID REFERENCES match_proposals(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('START', 'PROGRESS', 'FINISH', 'DELAY', 'BLOCKER', 'INSPECTION')),
    actual_date DATE NOT NULL,
    actual_progress_pct NUMERIC(6, 2),
    actual_quantity NUMERIC(14, 4),
    delay_reason TEXT,
    delay_days INTEGER,
    lifecycle_status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (lifecycle_status IN ('PROPOSED', 'MATCHED', 'REVIEW_REQUIRED', 'APPROVED', 'COMMITTED', 'REJECTED')),
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED', 'SYSTEM_VERIFIED', 'HUMAN_VERIFIED')),
    idempotency_key TEXT UNIQUE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Activity Current State (Materialized Execution State)
CREATE TABLE IF NOT EXISTS activity_current_state (
    activity_id UUID PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    execution_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (execution_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED')),
    actual_start_date DATE,
    actual_finish_date DATE,
    current_progress_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.0 CHECK (current_progress_pct BETWEEN 0.0 AND 100.0),
    cumulative_quantity NUMERIC(14, 4) DEFAULT 0.0,
    last_event_id UUID REFERENCES actual_events(id),
    last_event_date DATE,
    is_critical_path_delayed BOOLEAN NOT NULL DEFAULT false,
    variance_days INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Approvals Table
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_id UUID REFERENCES actual_events(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES match_proposals(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('APPROVE', 'REJECT', 'OVERRIDE')),
    reviewed_by UUID NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    selected_activity_id UUID REFERENCES activities(id),
    comments TEXT,
    confidence_override NUMERIC(5, 4)
);

-- 16. Audit Events Table (Tamper-Evident Trail)
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID,
    actor_role TEXT,
    actor_ip TEXT,
    before_state JSONB,
    after_state JSONB,
    payload_hash TEXT NOT NULL,
    previous_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Outbox Events Table (Reliable Transactional Outbox)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 18. Activity Lineage Table
CREATE TABLE IF NOT EXISTS activity_lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    previous_activity_id UUID NOT NULL,
    new_activity_id UUID NOT NULL,
    transition_type TEXT NOT NULL CHECK (transition_type IN ('SPLIT', 'MERGE', 'RECODE', 'SCOPE_TRANSFER')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. Terminology Dictionary Table
CREATE TABLE IF NOT EXISTS terminology (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    discipline TEXT NOT NULL,
    synonym_term TEXT NOT NULL,
    canonical_term TEXT NOT NULL,
    context_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, discipline, synonym_term)
);
