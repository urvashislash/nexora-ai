-- =============================================================================
-- NEXORA AI — PostgreSQL Schema Migration 003: Approval Enhancements
-- =============================================================================
-- Adds indexes to support the planner review and approval UX:
--   - Fast lookups on approvals by proposal_id and reviewer
--   - Fast filtering of match_proposals queue by status and tier

-- Index on approvals.proposal_id for fast join from match_proposals → approvals
CREATE INDEX IF NOT EXISTS idx_approvals_proposal_id
  ON approvals (proposal_id);

-- Index on approvals.reviewed_by for audit / user-specific queries
CREATE INDEX IF NOT EXISTS idx_approvals_reviewed_by
  ON approvals (reviewed_by);

-- Index on approvals.project_id + action for project-scoped approval summaries
CREATE INDEX IF NOT EXISTS idx_approvals_project_action
  ON approvals (project_id, action);

-- Index on match_proposals.status for review queue filtering
CREATE INDEX IF NOT EXISTS idx_match_proposals_status
  ON match_proposals (status);

-- Index on match_proposals.project_id + status for project-scoped queue lookups
CREATE INDEX IF NOT EXISTS idx_match_proposals_project_status
  ON match_proposals (project_id, status);

-- Index on match_proposals.match_tier for confidence tier filtering
CREATE INDEX IF NOT EXISTS idx_match_proposals_match_tier
  ON match_proposals (match_tier);
