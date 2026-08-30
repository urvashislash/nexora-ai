-- =============================================================================
-- NEXORA AI — Supabase Migration: Schema Validation & Alignment
-- =============================================================================
-- Mirrors database/migrations/004_schema_validation.sql for the Supabase env.
-- Adds missing columns, constraints, triggers, and tables (activity_lineage,
-- terminology) that were present in database/ but absent from Supabase.
-- =============================================================================

-- 0. Reusable updated_at trigger function
create or replace function fn_set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

do $$
declare
    tbl text;
begin
    for tbl in
        select table_name
        from information_schema.columns
        where column_name = 'updated_at'
          and table_schema = 'public'
    loop
        execute format(
            'drop trigger if exists trg_set_updated_at on %I; '
            'create trigger trg_set_updated_at '
            'before update on %I '
            'for each row execute function fn_set_updated_at();',
            tbl, tbl
        );
    end loop;
end;
$$;

-- 1. projects — add missing columns
alter table projects
    add column if not exists client_name text,
    add column if not exists location text,
    add column if not exists status text not null default 'ACTIVE';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'chk_projects_status'
    ) then
        alter table projects
            add constraint chk_projects_status
            check (status in ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'));
    end if;
end;
$$;

-- 2. project_members — add discipline
alter table project_members
    add column if not exists discipline text;

-- 3. schedule_versions — add missing columns
alter table schedule_versions
    add column if not exists source_system text,
    add column if not exists checksum text;

-- 4. activities — add missing columns + date constraint
alter table activities
    add column if not exists contractor text,
    add column if not exists searchable_text text;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'chk_activities_date_range'
    ) then
        alter table activities
            add constraint chk_activities_date_range
            check (planned_finish_date >= planned_start_date);
    end if;
end;
$$;

-- 5. activity_lineage table (was missing from Supabase migration)
create table if not exists activity_lineage (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    previous_activity_id uuid not null,
    new_activity_id uuid not null,
    transition_type text not null check (transition_type in ('SPLIT', 'MERGE', 'RECODE', 'SCOPE_TRANSFER')),
    reason text,
    created_at timestamptz not null default now()
);

-- 6. terminology table (was missing from Supabase migration)
create table if not exists terminology (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    discipline text not null,
    synonym_term text not null,
    canonical_term text not null,
    context_notes text,
    created_at timestamptz not null default now(),
    unique(project_id, discipline, synonym_term)
);

-- 7. RLS for newly added tables
alter table activity_lineage enable row level security;
alter table terminology enable row level security;

-- 8. Indexes for new columns and tables
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_project_members_discipline on project_members(project_id, discipline);
create index if not exists idx_activity_lineage_project on activity_lineage(project_id);
create index if not exists idx_terminology_project_discipline on terminology(project_id, discipline);
create index if not exists idx_terminology_synonym_trgm on terminology using gin (synonym_term gin_trgm_ops);
