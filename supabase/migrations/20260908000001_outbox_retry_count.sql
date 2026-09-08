-- ============================================================================
-- Migration: Ensure outbox_events has retry_count and nullable aggregate fields
-- ============================================================================

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbox_events ALTER COLUMN aggregate_type DROP NOT NULL;
ALTER TABLE outbox_events ALTER COLUMN aggregate_id DROP NOT NULL;
