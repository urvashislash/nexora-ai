-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 002: Indexes, HNSW & RLS Policies
-- =============================================================================

-- 1. Vector HNSW Index for Fast Cosine Similarity Search
CREATE INDEX IF NOT EXISTS idx_activities_embedding_hnsw 
ON activities 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 2. Trigram GIN Indexes for Fast Fuzzy Text & Code Matching
CREATE INDEX IF NOT EXISTS idx_activities_name_trgm 
ON activities 
USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_activities_code_trgm 
ON activities 
USING gin (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_work_observations_normalized_trgm 
ON work_observations 
USING gin (normalized_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_terminology_synonym_trgm 
ON terminology 
USING gin (synonym_term gin_trgm_ops);

-- 3. High-Performance B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_activities_project_discipline 
ON activities(project_id, discipline);

CREATE INDEX IF NOT EXISTS idx_activities_schedule_version 
ON activities(schedule_version_id);

CREATE INDEX IF NOT EXISTS idx_wbs_nodes_schedule_version 
ON wbs_nodes(schedule_version_id, level);

CREATE INDEX IF NOT EXISTS idx_documents_project_status 
ON documents(project_id, processing_status);

CREATE INDEX IF NOT EXISTS idx_document_jobs_doc_status 
ON document_jobs(document_id, status);

CREATE INDEX IF NOT EXISTS idx_work_observations_project_date 
ON work_observations(project_id, observed_at);

CREATE INDEX IF NOT EXISTS idx_match_proposals_obs_rank 
ON match_proposals(observation_id, candidate_rank);

CREATE INDEX IF NOT EXISTS idx_match_proposals_project_status 
ON match_proposals(project_id, status);

CREATE INDEX IF NOT EXISTS idx_actual_events_project_activity 
ON actual_events(project_id, activity_id, actual_date);

CREATE INDEX IF NOT EXISTS idx_actual_events_status 
ON actual_events(lifecycle_status, verification_status);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity 
ON audit_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status 
ON outbox_events(status, retry_count);

-- 4. Enable Row Level Security (RLS) on all tables (Defense-in-depth)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wbs_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_current_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminology ENABLE ROW LEVEL SECURITY;

-- 5. Define Basic Tenant Isolation RLS Policies
-- Note: Rust Trust Plane connects with elevated service role; browser reads are scoped via project_members.
CREATE POLICY project_members_access_policy ON projects
    FOR ALL
    USING (
        id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY activities_access_policy ON activities
    FOR ALL
    USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY documents_access_policy ON documents
    FOR ALL
    USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY match_proposals_access_policy ON match_proposals
    FOR ALL
    USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY actual_events_access_policy ON actual_events
    FOR ALL
    USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );
