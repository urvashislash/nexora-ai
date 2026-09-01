-- ============================================================================
-- Phase 1 Migration: HNSW pgvector Indexing & State Aggregation Triggers
-- ============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create HNSW Vector Index on activities embedding for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_activities_embedding 
ON activities USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 3. Automatic Current State Aggregation Function
CREATE OR REPLACE FUNCTION fn_update_activity_current_state()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_current_state (
        activity_id,
        project_id,
        execution_status,
        current_progress_pct,
        cumulative_quantity,
        last_event_id,
        last_event_date,
        updated_at
    )
    VALUES (
        NEW.activity_id,
        NEW.project_id,
        CASE 
            WHEN NEW.actual_progress_pct >= 100 THEN 'COMPLETED'
            WHEN NEW.actual_progress_pct > 0 THEN 'IN_PROGRESS'
            ELSE 'NOT_STARTED'
        END,
        NEW.actual_progress_pct,
        NEW.actual_quantity,
        NEW.id,
        NEW.actual_date,
        now()
    )
    ON CONFLICT (activity_id) DO UPDATE SET
        execution_status = EXCLUDED.execution_status,
        current_progress_pct = GREATEST(activity_current_state.current_progress_pct, EXCLUDED.current_progress_pct),
        cumulative_quantity = COALESCE(activity_current_state.cumulative_quantity, 0) + COALESCE(EXCLUDED.cumulative_quantity, 0),
        last_event_id = EXCLUDED.last_event_id,
        last_event_date = EXCLUDED.last_event_date,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach Trigger to actual_events
DROP TRIGGER IF EXISTS trg_actual_events_aggregate ON actual_events;
CREATE TRIGGER trg_actual_events_aggregate
AFTER INSERT ON actual_events
FOR EACH ROW EXECUTE FUNCTION fn_update_activity_current_state();

-- 5. Enable full replica identity for realtime websocket broadcast
ALTER TABLE work_observations REPLICA IDENTITY FULL;
ALTER TABLE match_proposals REPLICA IDENTITY FULL;
ALTER TABLE activity_current_state REPLICA IDENTITY FULL;
ALTER TABLE audit_events REPLICA IDENTITY FULL;
