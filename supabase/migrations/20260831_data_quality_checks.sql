-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 005: Data Quality & Integrity Checks
-- =============================================================================
-- Adds database-level constraints and validation functions to prevent bad data
-- at the boundary. These are defense-in-depth — Rust should also validate.
-- =============================================================================

-- ─────────────────────────────────────────────────
-- 1. CHECK: actual_events progress is within bounds
-- ─────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_actual_events_progress'
    ) THEN
        ALTER TABLE actual_events
            ADD CONSTRAINT chk_actual_events_progress
            CHECK (actual_progress_pct IS NULL OR (actual_progress_pct >= 0.0 AND actual_progress_pct <= 100.0));
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────
-- 2. CHECK: actual_events quantity is non-negative
-- ─────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_actual_events_quantity'
    ) THEN
        ALTER TABLE actual_events
            ADD CONSTRAINT chk_actual_events_quantity
            CHECK (actual_quantity IS NULL OR actual_quantity >= 0.0);
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────
-- 3. CHECK: work_observations progress is within bounds
-- ─────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_observations_progress'
    ) THEN
        ALTER TABLE work_observations
            ADD CONSTRAINT chk_work_observations_progress
            CHECK (reported_progress IS NULL OR (reported_progress >= 0.0 AND reported_progress <= 100.0));
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────
-- 4. CHECK: work_observations quantity is non-negative
-- ─────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_observations_quantity'
    ) THEN
        ALTER TABLE work_observations
            ADD CONSTRAINT chk_work_observations_quantity
            CHECK (reported_quantity IS NULL OR reported_quantity >= 0.0);
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────
-- 5. CHECK: activity_dependencies predecessor != successor
-- ─────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_activity_deps_no_self_ref'
    ) THEN
        ALTER TABLE activity_dependencies
            ADD CONSTRAINT chk_activity_deps_no_self_ref
            CHECK (predecessor_id != successor_id);
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────
-- 6. CHECK: planned_quantity is non-negative on activities
-- ─────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_activities_quantity'
    ) THEN
        ALTER TABLE activities
            ADD CONSTRAINT chk_activities_quantity
            CHECK (planned_quantity IS NULL OR planned_quantity >= 0.0);
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────
-- 7. FUNCTION: Validate WBS hierarchy consistency
--    Returns orphaned nodes (parent_id references non-existent node)
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validate_wbs_hierarchy(p_project_id UUID)
RETURNS TABLE (
    node_id UUID,
    wbs_code TEXT,
    parent_id UUID,
    issue TEXT
) AS $$
BEGIN
    -- Find nodes whose parent_id doesn't exist
    RETURN QUERY
    SELECT w.id, w.wbs_code, w.parent_id, 'ORPHANED_NODE: parent_id references non-existent node'::TEXT
    FROM wbs_nodes w
    WHERE w.project_id = p_project_id
      AND w.parent_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM wbs_nodes p WHERE p.id = w.parent_id AND p.project_id = p_project_id
      );

    -- Find nodes whose level doesn't match hierarchy depth
    RETURN QUERY
    SELECT w.id, w.wbs_code, w.parent_id, 'LEVEL_MISMATCH: node level does not match parent level + 1'::TEXT
    FROM wbs_nodes w
    JOIN wbs_nodes p ON w.parent_id = p.id
    WHERE w.project_id = p_project_id
      AND w.level != p.level + 1;

    -- Find root nodes (parent_id IS NULL) that aren't level 1
    RETURN QUERY
    SELECT w.id, w.wbs_code, w.parent_id, 'ROOT_LEVEL_MISMATCH: root node is not level 1'::TEXT
    FROM wbs_nodes w
    WHERE w.project_id = p_project_id
      AND w.parent_id IS NULL
      AND w.level != 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────
-- 8. FUNCTION: Validate critical path dependencies
--    Returns critical-path activities without predecessors
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validate_critical_path_deps(p_project_id UUID)
RETURNS TABLE (
    activity_id UUID,
    activity_code TEXT,
    activity_name TEXT,
    issue TEXT
) AS $$
BEGIN
    -- Critical path activities with no predecessor defined (except first activity)
    RETURN QUERY
    SELECT a.id, a.code, a.name,
           'CRITICAL_NO_PREDECESSOR: critical path activity has no predecessor dependency'::TEXT
    FROM activities a
    WHERE a.project_id = p_project_id
      AND a.critical_path = true
      AND NOT EXISTS (
          SELECT 1 FROM activity_dependencies ad WHERE ad.successor_id = a.id
      )
      -- Allow the very first activity (earliest planned start) to have no predecessor
      AND a.planned_start_date != (
          SELECT MIN(a2.planned_start_date)
          FROM activities a2
          WHERE a2.project_id = p_project_id AND a2.critical_path = true
      );

    -- Critical path activities with no successor defined (except last activity)
    RETURN QUERY
    SELECT a.id, a.code, a.name,
           'CRITICAL_NO_SUCCESSOR: critical path activity has no successor dependency'::TEXT
    FROM activities a
    WHERE a.project_id = p_project_id
      AND a.critical_path = true
      AND NOT EXISTS (
          SELECT 1 FROM activity_dependencies ad WHERE ad.predecessor_id = a.id
      )
      -- Allow the very last activity (latest planned finish) to have no successor
      AND a.planned_finish_date != (
          SELECT MAX(a2.planned_finish_date)
          FROM activities a2
          WHERE a2.project_id = p_project_id AND a2.critical_path = true
      );
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────
-- 9. FUNCTION: Detect duplicate observations
--    Returns observations with same document + raw_text
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_detect_duplicate_observations(p_project_id UUID)
RETURNS TABLE (
    observation_id UUID,
    document_id UUID,
    raw_text_prefix TEXT,
    duplicate_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT wo.id, wo.document_id, LEFT(wo.raw_text, 80),
           COUNT(*) OVER (PARTITION BY wo.document_id, wo.raw_text)
    FROM work_observations wo
    WHERE wo.project_id = p_project_id
      AND wo.document_id IS NOT NULL
    GROUP BY wo.id, wo.document_id, wo.raw_text
    HAVING COUNT(*) OVER (PARTITION BY wo.document_id, wo.raw_text) > 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────
-- 10. VIEW: Project health summary with COALESCE fallbacks
-- ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_project_health_summary AS
SELECT
    p.id AS project_id,
    p.code AS project_code,
    p.name AS project_name,
    COALESCE(p.status, 'ACTIVE') AS project_status,
    COALESCE(act_counts.total_activities, 0) AS total_activities,
    COALESCE(act_counts.completed, 0) AS completed_activities,
    COALESCE(act_counts.in_progress, 0) AS in_progress_activities,
    COALESCE(act_counts.delayed, 0) AS delayed_activities,
    COALESCE(act_counts.not_started, 0) AS not_started_activities,
    COALESCE(obs_count.total, 0) AS total_observations,
    COALESCE(event_count.total, 0) AS total_events,
    COALESCE(review_count.pending, 0) AS pending_reviews,
    COALESCE(audit_count.total, 0) AS total_audit_entries
FROM projects p
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS total_activities,
        COUNT(*) FILTER (WHERE acs.execution_status = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE acs.execution_status = 'IN_PROGRESS') AS in_progress,
        COUNT(*) FILTER (WHERE acs.execution_status = 'DELAYED') AS delayed,
        COUNT(*) FILTER (WHERE acs.execution_status = 'NOT_STARTED') AS not_started
    FROM activity_current_state acs
    WHERE acs.project_id = p.id
) act_counts ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM work_observations wo WHERE wo.project_id = p.id
) obs_count ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM actual_events ae WHERE ae.project_id = p.id
) event_count ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS pending
    FROM match_proposals mp WHERE mp.project_id = p.id AND mp.status = 'PENDING_REVIEW'
) review_count ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM audit_events aev WHERE aev.project_id = p.id
) audit_count ON true;
