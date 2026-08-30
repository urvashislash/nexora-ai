#![allow(dead_code)]

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Discipline {
    Civil,
    Piping,
    Mechanical,
    Electrical,
    Instrumentation,
    Hse,
    General,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EventType {
    Start,
    Progress,
    Finish,
    Delay,
    Blocker,
    Inspection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LifecycleStatus {
    Proposed,
    Matched,
    ReviewRequired,
    Approved,
    Committed,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VerificationStatus {
    Unverified,
    SystemVerified,
    HumanVerified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MatchTier {
    High,
    Medium,
    Low,
    Unmatched,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    Admin,
    Planner,
    Engineer,
    Supervisor,
    Auditor,
    Viewer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ExecutionStatus {
    NotStarted,
    InProgress,
    Completed,
    Delayed,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DependencyType {
    Fs,
    Ss,
    Ff,
    Sf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub timezone: String,
    pub currency: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: Uuid,
    pub project_id: Uuid,
    pub schedule_version_id: Uuid,
    pub wbs_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub discipline: Discipline,
    pub planned_start_date: NaiveDate,
    pub planned_finish_date: NaiveDate,
    pub planned_duration_days: i32,
    pub planned_quantity: Option<f64>,
    pub unit_of_measure: Option<String>,
    pub location: Option<String>,
    pub zone: Option<String>,
    pub equipment_tag: Option<String>,
    pub weightage: f64,
    pub critical_path: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDependency {
    pub id: Uuid,
    pub schedule_version_id: Uuid,
    pub predecessor_id: Uuid,
    pub successor_id: Uuid,
    pub dependency_type: DependencyType,
    pub lag_days: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkObservation {
    pub id: Uuid,
    pub project_id: Uuid,
    pub document_id: Option<Uuid>,
    pub reported_by: Option<Uuid>,
    pub observed_at: Option<DateTime<Utc>>,
    pub recorded_at: DateTime<Utc>,
    pub discipline: Option<Discipline>,
    pub location: Option<String>,
    pub zone: Option<String>,
    pub equipment_tag: Option<String>,
    pub raw_text: String,
    pub normalized_text: Option<String>,
    pub event_type: Option<EventType>,
    pub reported_progress: Option<f64>,
    pub reported_quantity: Option<f64>,
    pub unit_of_measure: Option<String>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchProposal {
    pub id: Uuid,
    pub project_id: Uuid,
    pub observation_id: Uuid,
    pub activity_id: Uuid,
    pub candidate_rank: i32,
    pub lexical_score: f64,
    pub semantic_score: f64,
    pub context_boost: f64,
    pub confidence_score: f64,
    pub match_tier: MatchTier,
    pub explanation: Option<String>,
    pub evidence_snippet: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActualEvent {
    pub id: Uuid,
    pub project_id: Uuid,
    pub activity_id: Uuid,
    pub observation_id: Option<Uuid>,
    pub match_proposal_id: Option<Uuid>,
    pub event_type: EventType,
    pub actual_date: NaiveDate,
    pub actual_progress_pct: Option<f64>,
    pub actual_quantity: Option<f64>,
    pub delay_reason: Option<String>,
    pub delay_days: Option<i32>,
    pub lifecycle_status: LifecycleStatus,
    pub verification_status: VerificationStatus,
    pub idempotency_key: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityCurrentState {
    pub activity_id: Uuid,
    pub project_id: Uuid,
    pub execution_status: ExecutionStatus,
    pub actual_start_date: Option<NaiveDate>,
    pub actual_finish_date: Option<NaiveDate>,
    pub current_progress_pct: f64,
    pub cumulative_quantity: f64,
    pub last_event_id: Option<Uuid>,
    pub last_event_date: Option<NaiveDate>,
    pub is_critical_path_delayed: bool,
    pub variance_days: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Approval {
    pub id: Uuid,
    pub project_id: Uuid,
    pub event_id: Option<Uuid>,
    pub proposal_id: Option<Uuid>,
    pub action: String,
    pub reviewed_by: Uuid,
    pub reviewed_at: DateTime<Utc>,
    pub selected_activity_id: Option<Uuid>,
    pub comments: Option<String>,
    pub confidence_override: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: Uuid,
    pub project_id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub action: String,
    pub actor_id: Option<Uuid>,
    pub actor_role: Option<String>,
    pub before_state: Option<serde_json::Value>,
    pub after_state: Option<serde_json::Value>,
    pub payload_hash: String,
    pub previous_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxEvent {
    pub id: Uuid,
    pub project_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub status: String,
    pub retry_count: i32,
    pub created_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}
