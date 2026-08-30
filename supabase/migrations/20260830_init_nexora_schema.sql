-- NEXORA AI Supabase migration
-- Mirrors the project schema used by the Docker/Postgres setup and the locked MVP design.

create extension if not exists "uuid-ossp";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

create table if not exists projects (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    description text,
    timezone text not null default 'Asia/Kolkata',
    currency text not null default 'INR',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists project_members (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    user_id uuid not null,
    email text not null,
    full_name text not null,
    role text not null check (role in ('ADMIN', 'PLANNER', 'ENGINEER', 'SUPERVISOR', 'AUDITOR', 'VIEWER')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    unique(project_id, user_id)
);

create table if not exists schedule_versions (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    version_number integer not null,
    version_label text not null,
    version_type text not null check (version_type in ('BASELINE', 'CURRENT_APPROVED', 'REVISED', 'WHAT_IF')),
    source_file_id uuid,
    is_active boolean not null default false,
    approved_by uuid,
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    unique(project_id, version_number)
);

create table if not exists wbs_nodes (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    schedule_version_id uuid not null references schedule_versions(id) on delete cascade,
    parent_id uuid references wbs_nodes(id) on delete cascade,
    wbs_code text not null,
    name text not null,
    level integer not null check (level between 1 and 10),
    path text not null,
    created_at timestamptz not null default now(),
    unique(schedule_version_id, wbs_code)
);

create table if not exists activities (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    schedule_version_id uuid not null references schedule_versions(id) on delete cascade,
    wbs_id uuid not null references wbs_nodes(id) on delete restrict,
    code text not null,
    name text not null,
    description text,
    discipline text not null check (discipline in ('CIVIL', 'PIPING', 'MECHANICAL', 'ELECTRICAL', 'INSTRUMENTATION', 'HSE', 'GENERAL')),
    planned_start_date date not null,
    planned_finish_date date not null,
    planned_duration_days integer not null check (planned_duration_days >= 0),
    planned_quantity numeric(14, 4),
    unit_of_measure text,
    location text,
    zone text,
    equipment_tag text,
    weightage numeric(6, 4) default 1.0,
    critical_path boolean not null default false,
    embedding vector(384),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(schedule_version_id, code)
);

create table if not exists activity_dependencies (
    id uuid primary key default gen_random_uuid(),
    schedule_version_id uuid not null references schedule_versions(id) on delete cascade,
    predecessor_id uuid not null references activities(id) on delete cascade,
    successor_id uuid not null references activities(id) on delete cascade,
    dependency_type text not null check (dependency_type in ('FS', 'SS', 'FF', 'SF')),
    lag_days integer not null default 0,
    created_at timestamptz not null default now(),
    unique(predecessor_id, successor_id)
);

create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    filename text not null,
    mime_type text not null,
    size_bytes bigint,
    storage_bucket text not null default 'evidence-documents',
    storage_key text not null,
    checksum_sha256 text,
    source_type text not null check (source_type in ('DAILY_REPORT', 'DISCIPLINE_SPREADSHEET', 'SITE_DIARY', 'VOICE', 'IMAGE', 'MANUAL', 'SCHEDULE')),
    document_type text,
    classification text not null default 'INTERNAL',
    uploaded_by uuid,
    uploaded_at timestamptz not null default now(),
    processing_status text not null default 'RECEIVED' check (processing_status in ('RECEIVED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

create table if not exists document_jobs (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references documents(id) on delete cascade,
    job_type text not null check (job_type in ('PARSE', 'OCR', 'ASR', 'EXTRACT', 'NORMALIZE', 'EMBED', 'MATCH')),
    status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'RETRYING')),
    attempt_count integer not null default 0,
    max_attempts integer not null default 3,
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz
);

create table if not exists document_extractions (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references documents(id) on delete cascade,
    extraction_version text not null default 'v1.0',
    extracted_text text,
    structured_output jsonb,
    extraction_confidence numeric(5, 4),
    model_name text,
    model_version text,
    prompt_version text,
    created_at timestamptz not null default now()
);

create table if not exists work_observations (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    document_id uuid references documents(id) on delete set null,
    reported_by uuid,
    observed_at timestamptz,
    recorded_at timestamptz not null default now(),
    discipline text,
    location text,
    zone text,
    equipment_tag text,
    raw_text text not null,
    normalized_text text,
    event_type text check (event_type in ('START', 'PROGRESS', 'FINISH', 'DELAY', 'BLOCKER', 'INSPECTION')),
    reported_progress numeric(6, 2),
    reported_quantity numeric(14, 4),
    unit_of_measure text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists match_proposals (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    observation_id uuid not null references work_observations(id) on delete cascade,
    activity_id uuid not null references activities(id) on delete cascade,
    candidate_rank integer not null default 1,
    lexical_score numeric(5, 4) not null default 0.0,
    semantic_score numeric(5, 4) not null default 0.0,
    context_boost numeric(5, 4) not null default 0.0,
    confidence_score numeric(5, 4) not null,
    match_tier text not null check (match_tier in ('HIGH', 'MEDIUM', 'LOW', 'UNMATCHED')),
    explanation text,
    evidence_snippet text,
    model_version text,
    status text not null default 'PROPOSED' check (status in ('PROPOSED', 'AUTO_LINKED', 'PENDING_REVIEW', 'ACCEPTED', 'OVERRIDDEN', 'REJECTED')),
    created_at timestamptz not null default now()
);

create table if not exists actual_events (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    activity_id uuid not null references activities(id) on delete restrict,
    observation_id uuid references work_observations(id) on delete set null,
    match_proposal_id uuid references match_proposals(id) on delete set null,
    event_type text not null check (event_type in ('START', 'PROGRESS', 'FINISH', 'DELAY', 'BLOCKER', 'INSPECTION')),
    actual_date date not null,
    actual_progress_pct numeric(6, 2),
    actual_quantity numeric(14, 4),
    delay_reason text,
    delay_days integer,
    lifecycle_status text not null default 'PROPOSED' check (lifecycle_status in ('PROPOSED', 'MATCHED', 'REVIEW_REQUIRED', 'APPROVED', 'COMMITTED', 'REJECTED')),
    verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED', 'SYSTEM_VERIFIED', 'HUMAN_VERIFIED')),
    idempotency_key text unique,
    created_by uuid,
    created_at timestamptz not null default now()
);

create table if not exists activity_current_state (
    activity_id uuid primary key references activities(id) on delete cascade,
    project_id uuid not null references projects(id) on delete cascade,
    execution_status text not null default 'NOT_STARTED' check (execution_status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED')),
    actual_start_date date,
    actual_finish_date date,
    current_progress_pct numeric(6, 2) not null default 0.0 check (current_progress_pct between 0.0 and 100.0),
    cumulative_quantity numeric(14, 4) default 0.0,
    last_event_id uuid references actual_events(id),
    last_event_date date,
    is_critical_path_delayed boolean not null default false,
    variance_days integer not null default 0,
    updated_at timestamptz not null default now()
);

create table if not exists approvals (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    event_id uuid references actual_events(id) on delete cascade,
    proposal_id uuid references match_proposals(id) on delete cascade,
    action text not null check (action in ('APPROVE', 'REJECT', 'OVERRIDE')),
    reviewed_by uuid not null,
    reviewed_at timestamptz not null default now(),
    selected_activity_id uuid references activities(id),
    comments text,
    confidence_override numeric(5, 4)
);

create table if not exists audit_events (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references projects(id) on delete cascade,
    entity_type text not null,
    entity_id uuid not null,
    action text not null,
    actor_id uuid,
    actor_role text,
    actor_ip text,
    before_state jsonb,
    after_state jsonb,
    payload_hash text not null,
    previous_hash text,
    created_at timestamptz not null default now()
);

create table if not exists outbox_events (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    aggregate_type text not null,
    aggregate_id uuid not null,
    event_type text not null,
    payload jsonb not null,
    status text not null default 'PENDING',
    attempt_count integer not null default 0,
    available_at timestamptz not null default now(),
    processed_at timestamptz,
    last_error text,
    created_at timestamptz not null default now()
);

create index if not exists idx_activities_embedding_hnsw
on activities using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64);

create index if not exists idx_activities_name_trgm on activities using gin (name gin_trgm_ops);
create index if not exists idx_activities_code_trgm on activities using gin (code gin_trgm_ops);
create index if not exists idx_work_observations_normalized_trgm on work_observations using gin (normalized_text gin_trgm_ops);

create index if not exists idx_activities_project_discipline on activities(project_id, discipline);
create index if not exists idx_activities_schedule_version on activities(schedule_version_id);
create index if not exists idx_wbs_nodes_schedule_version on wbs_nodes(schedule_version_id, level);
create index if not exists idx_documents_project_status on documents(project_id, processing_status);
create index if not exists idx_document_jobs_doc_status on document_jobs(document_id, status);
create index if not exists idx_work_observations_project_date on work_observations(project_id, observed_at);
create index if not exists idx_match_proposals_obs_rank on match_proposals(observation_id, candidate_rank);
create index if not exists idx_match_proposals_project_status on match_proposals(project_id, status);
create index if not exists idx_actual_events_project_activity on actual_events(project_id, activity_id, actual_date);
create index if not exists idx_actual_events_status on actual_events(lifecycle_status, verification_status);
create index if not exists idx_audit_events_entity on audit_events(entity_type, entity_id);
create index if not exists idx_outbox_events_status on outbox_events(status, attempt_count);

alter table projects enable row level security;
alter table project_members enable row level security;
alter table schedule_versions enable row level security;
alter table wbs_nodes enable row level security;
alter table activities enable row level security;
alter table activity_dependencies enable row level security;
alter table documents enable row level security;
alter table document_jobs enable row level security;
alter table document_extractions enable row level security;
alter table work_observations enable row level security;
alter table match_proposals enable row level security;
alter table actual_events enable row level security;
alter table activity_current_state enable row level security;
alter table approvals enable row level security;
alter table audit_events enable row level security;
alter table outbox_events enable row level security;

drop policy if exists project_members_access_policy on projects;
create policy project_members_access_policy on projects
for all
using (
    id in (
        select project_id from project_members where user_id = auth.uid() and is_active = true
    )
);

drop policy if exists activities_access_policy on activities;
create policy activities_access_policy on activities
for all
using (
    project_id in (
        select project_id from project_members where user_id = auth.uid() and is_active = true
    )
);

drop policy if exists documents_access_policy on documents;
create policy documents_access_policy on documents
for all
using (
    project_id in (
        select project_id from project_members where user_id = auth.uid() and is_active = true
    )
);

drop policy if exists match_proposals_access_policy on match_proposals;
create policy match_proposals_access_policy on match_proposals
for all
using (
    project_id in (
        select project_id from project_members where user_id = auth.uid() and is_active = true
    )
);

drop policy if exists actual_events_access_policy on actual_events;
create policy actual_events_access_policy on actual_events
for all
using (
    project_id in (
        select project_id from project_members where user_id = auth.uid() and is_active = true
    )
);
