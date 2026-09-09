#![allow(dead_code)]

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TeamRole {
    Owner,
    Admin,
    Planner,
    Engineer,
    Supervisor,
    Auditor,
    Viewer,
}

impl TeamRole {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "OWNER" => Some(TeamRole::Owner),
            "ADMIN" => Some(TeamRole::Admin),
            "PLANNER" => Some(TeamRole::Planner),
            "ENGINEER" => Some(TeamRole::Engineer),
            "SUPERVISOR" => Some(TeamRole::Supervisor),
            "AUDITOR" => Some(TeamRole::Auditor),
            "VIEWER" => Some(TeamRole::Viewer),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            TeamRole::Owner => "OWNER",
            TeamRole::Admin => "ADMIN",
            TeamRole::Planner => "PLANNER",
            TeamRole::Engineer => "ENGINEER",
            TeamRole::Supervisor => "SUPERVISOR",
            TeamRole::Auditor => "AUDITOR",
            TeamRole::Viewer => "VIEWER",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMember {
    pub id: Uuid,
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub email: Option<String>,
    pub full_name: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamInvitation {
    pub id: Uuid,
    pub team_id: Uuid,
    pub email: String,
    pub role: String,
    pub token: String,
    pub status: String,
    pub invited_by: Uuid,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamCreateInput {
    pub name: String,
    pub slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamUpdateInput {
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamInviteInput {
    pub email: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMemberRoleUpdateInput {
    pub role: String,
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
    pub team_id: Option<Uuid>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaselineActivityInput {
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
    pub weightage: Option<f64>,
    pub critical_path: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectCreateInput {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub timezone: Option<String>,
    pub currency: Option<String>,
    pub team_id: Option<Uuid>,
    pub baseline_activities: Option<Vec<BaselineActivityInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityWithState {
    pub activity: Activity,
    pub state: Option<ActivityCurrentState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: Uuid,
    pub project_id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: Option<i64>,
    pub storage_bucket: String,
    pub storage_key: String,
    pub checksum_sha256: Option<String>,
    pub source_type: String,
    pub classification: String,
    pub uploaded_by: Option<Uuid>,
    pub uploaded_at: DateTime<Utc>,
    pub processing_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentJob {
    pub id: Uuid,
    pub document_id: Uuid,
    pub job_type: String,
    pub status: String,
    pub attempt_count: i32,
    pub max_attempts: i32,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentCreateInput {
    pub filename: String,
    pub mime_type: Option<String>,
    pub size_bytes: Option<i64>,
    pub storage_key: Option<String>,
    pub storage_bucket: Option<String>,
    pub source_type: Option<String>,
    pub checksum_sha256: Option<String>,
    pub text_content: Option<String>,
    pub content_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewQueueItem {
    pub proposal: MatchProposal,
    pub observation: Option<WorkObservation>,
    pub activity: Option<Activity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMember {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProjectMembership {
    pub project_id: Uuid,
    pub project_code: String,
    pub project_name: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMemberCreateInput {
    pub user_id: Option<Uuid>,
    pub email: String,
    pub full_name: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyInput {
    pub predecessor_code: String,
    pub successor_code: String,
    pub dependency_type: Option<String>,
    pub lag_days: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleImportInput {
    pub version_label: String,
    pub version_type: Option<String>,
    pub activities: Vec<BaselineActivityInput>,
    pub dependencies: Option<Vec<DependencyInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleImportPreview {
    pub version_label: String,
    pub total_activities: usize,
    pub total_dependencies: usize,
    pub earliest_start_date: Option<NaiveDate>,
    pub latest_finish_date: Option<NaiveDate>,
    pub critical_path_count: usize,
    pub disciplines: Vec<String>,
    pub sample_activities: Vec<BaselineActivityInput>,
    pub validation_errors: Vec<String>,
    pub validation_warnings: Vec<String>,
}
