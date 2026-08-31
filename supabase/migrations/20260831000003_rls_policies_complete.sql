-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 006: Complete RLS Policies
-- =============================================================================
-- Adds row-level security policies for all tables that currently have RLS
-- enabled but no policies defined. Also adds role-based write restrictions
-- for sensitive operations.
--
-- Per the locked auth boundary (Backend_Schema §3A):
--   - Rust is the SOLE enforcer of business authorization
--   - RLS is defense-in-depth, not the primary authorization
--   - Rust connects with a service_role key (bypasses RLS)
--   - Browser reads via Supabase client are scoped through auth.uid()
-- =============================================================================

-- ─────────────────────────────────────────────────
-- Helper: reusable function to check project membership
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_user_has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow read for demo project when unauthenticated
    IF auth.uid() IS NULL AND p_project_id = 'a0000000-0000-0000-0000-000000000001'::uuid THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id
          AND user_id = auth.uid()
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_user_project_role(p_project_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM project_members
        WHERE project_id = p_project_id
          AND user_id = auth.uid()
          AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────
-- 1. project_members — users see only their own projects' members
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS project_members_select_policy ON project_members;
CREATE POLICY project_members_select_policy ON project_members
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR
        fn_user_has_project_access(project_id)
    );

-- Only ADMIN can insert/update/delete members
DROP POLICY IF EXISTS project_members_write_policy ON project_members;
CREATE POLICY project_members_write_policy ON project_members
    FOR ALL
    USING (
        fn_user_project_role(project_id) = 'ADMIN'
    );

-- ─────────────────────────────────────────────────
-- 2. schedule_versions — project-scoped read
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS schedule_versions_access_policy ON schedule_versions;
CREATE POLICY schedule_versions_access_policy ON schedule_versions
    FOR SELECT
    USING (fn_user_has_project_access(project_id));

-- ─────────────────────────────────────────────────
-- 3. wbs_nodes — project-scoped read
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS wbs_nodes_access_policy ON wbs_nodes;
CREATE POLICY wbs_nodes_access_policy ON wbs_nodes
    FOR SELECT
    USING (fn_user_has_project_access(project_id));

-- ─────────────────────────────────────────────────
-- 4. activity_dependencies — via schedule_version → project
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS activity_deps_access_policy ON activity_dependencies;
CREATE POLICY activity_deps_access_policy ON activity_dependencies
    FOR SELECT
    USING (
        schedule_version_id IN (
            SELECT sv.id FROM schedule_versions sv
            WHERE fn_user_has_project_access(sv.project_id)
        )
    );

-- ─────────────────────────────────────────────────
-- 5. document_jobs — via document → project
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS document_jobs_access_policy ON document_jobs;
CREATE POLICY document_jobs_access_policy ON document_jobs
    FOR SELECT
    USING (
        document_id IN (
            SELECT d.id FROM documents d
            WHERE fn_user_has_project_access(d.project_id)
        )
    );

-- ─────────────────────────────────────────────────
-- 6. document_extractions — via document → project
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS document_extractions_access_policy ON document_extractions;
CREATE POLICY document_extractions_access_policy ON document_extractions
    FOR SELECT
    USING (
        document_id IN (
            SELECT d.id FROM documents d
            WHERE fn_user_has_project_access(d.project_id)
        )
    );

-- ─────────────────────────────────────────────────
-- 7. work_observations — project-scoped
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS work_observations_access_policy ON work_observations;
CREATE POLICY work_observations_access_policy ON work_observations
    FOR SELECT
    USING (fn_user_has_project_access(project_id));

-- SUPERVISOR, ENGINEER, PLANNER, ADMIN can insert observations
DROP POLICY IF EXISTS work_observations_insert_policy ON work_observations;
CREATE POLICY work_observations_insert_policy ON work_observations
    FOR INSERT
    WITH CHECK (
        fn_user_project_role(project_id) IN ('SUPERVISOR', 'ENGINEER', 'PLANNER', 'ADMIN')
    );

-- ─────────────────────────────────────────────────
-- 8. activity_current_state — project-scoped read
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS activity_current_state_access_policy ON activity_current_state;
CREATE POLICY activity_current_state_access_policy ON activity_current_state
    FOR SELECT
    USING (fn_user_has_project_access(project_id));

-- ─────────────────────────────────────────────────
-- 9. approvals — project-scoped read
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS approvals_access_policy ON approvals;
CREATE POLICY approvals_access_policy ON approvals
    FOR SELECT
    USING (fn_user_has_project_access(project_id));

-- Only PLANNER and ADMIN can insert approvals
DROP POLICY IF EXISTS approvals_insert_policy ON approvals;
CREATE POLICY approvals_insert_policy ON approvals
    FOR INSERT
    WITH CHECK (
        fn_user_project_role(project_id) IN ('PLANNER', 'ADMIN')
    );

-- ─────────────────────────────────────────────────
-- 10. audit_events — project-scoped, with AUDITOR+ read
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS audit_events_access_policy ON audit_events;
CREATE POLICY audit_events_access_policy ON audit_events
    FOR SELECT
    USING (
        project_id IS NULL  -- system-level events visible to all authenticated
        OR fn_user_project_role(project_id) IN ('AUDITOR', 'ADMIN', 'PLANNER')
    );

-- No browser writes to audit_events (service-role only)

-- ─────────────────────────────────────────────────
-- 11. outbox_events — service-role only (no browser access)
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS outbox_events_deny_policy ON outbox_events;
CREATE POLICY outbox_events_deny_policy ON outbox_events
    FOR ALL
    USING (false);  -- Rust service_role key bypasses RLS

-- ─────────────────────────────────────────────────
-- 12. activity_lineage — project-scoped
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS activity_lineage_access_policy ON activity_lineage;
CREATE POLICY activity_lineage_access_policy ON activity_lineage
    FOR SELECT
    USING (fn_user_has_project_access(project_id));

-- ─────────────────────────────────────────────────
-- 13. terminology — project-scoped
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS terminology_access_policy ON terminology;
CREATE POLICY terminology_access_policy ON terminology
    FOR SELECT
    USING (fn_user_has_project_access(project_id));

-- PLANNER and ADMIN can manage terminology
DROP POLICY IF EXISTS terminology_write_policy ON terminology;
CREATE POLICY terminology_write_policy ON terminology
    FOR ALL
    USING (
        fn_user_project_role(project_id) IN ('PLANNER', 'ADMIN')
    );
