use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::cache::{CacheTtl, RedisCache};
use crate::database::Database;
use crate::domain::ledger::EventLedger;
use crate::domain::models::*;
use crate::domain::state_machine::StateMachine;
use crate::domain::validation::ValidationEngine;
use crate::messaging::publisher::RabbitPublisher;

// =============================================================================
// Structured API Error
// =============================================================================

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let status = match self.code.as_str() {
            "NOT_FOUND" => StatusCode::NOT_FOUND,
            "CONFLICT" => StatusCode::CONFLICT,
            "VALIDATION_ERROR" | "BAD_REQUEST" => StatusCode::BAD_REQUEST,
            "FORBIDDEN" => StatusCode::FORBIDDEN,
            "UNAUTHORIZED" => StatusCode::UNAUTHORIZED,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(self)).into_response()
    }
}

impl ApiError {
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "NOT_FOUND".to_string(),
            details: None,
        }
    }

    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "BAD_REQUEST".to_string(),
            details: None,
        }
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "CONFLICT".to_string(),
            details: None,
        }
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "VALIDATION_ERROR".to_string(),
            details: None,
        }
    }
}

// =============================================================================
// Application State
// =============================================================================

#[derive(Clone)]
pub struct AppState {
    pub projects: Arc<RwLock<Vec<Project>>>,
    pub activities: Arc<RwLock<Vec<Activity>>>,
    pub activity_states: Arc<RwLock<Vec<ActivityCurrentState>>>,
    pub observations: Arc<RwLock<Vec<WorkObservation>>>,
    pub proposals: Arc<RwLock<Vec<MatchProposal>>>,
    pub events: Arc<RwLock<Vec<ActualEvent>>>,
    pub approvals: Arc<RwLock<Vec<Approval>>>,
    pub audit_trail: Arc<RwLock<Vec<AuditEvent>>>,
    pub outbox_events: Arc<RwLock<Vec<OutboxEvent>>>,
    pub last_audit_hash: Arc<RwLock<Option<String>>>,
    pub audit_archives: Arc<RwLock<Vec<crate::domain::ledger::AuditArchiveBatch>>>,
    pub legal_holds: Arc<RwLock<std::collections::HashMap<Uuid, bool>>>,
    // --- Infrastructure ---
    pub rabbit_publisher: Option<Arc<RabbitPublisher>>,
    pub redis_cache: Option<Arc<RedisCache>>,
    pub database: Option<Arc<Database>>,
    pub cache_ttl: CacheTtl,
}

impl AppState {
    pub fn new(
        rabbit_publisher: Option<Arc<RabbitPublisher>>,
        redis_cache: Option<Arc<RedisCache>>,
        database: Option<Arc<Database>>,
    ) -> Self {
        Self::build(rabbit_publisher, redis_cache, database)
    }

    pub fn new_with_demo_data() -> Self {
        Self::build(None, None, None)
    }

    fn build(
        rabbit_publisher: Option<Arc<RabbitPublisher>>,
        redis_cache: Option<Arc<RedisCache>>,
        database: Option<Arc<Database>>,
    ) -> Self {
        let project_id = Uuid::parse_str("a0000000-0000-0000-0000-000000000001").unwrap();
        let schedule_version_id = Uuid::parse_str("b0000000-0000-0000-0000-000000000001").unwrap();
        let wbs_id = Uuid::parse_str("c0000000-0000-0000-0000-000000000003").unwrap();

        let demo_project = Project {
            id: project_id,
            code: "PRD-HYD-PKG04".to_string(),
            name: "Paradip-Hyderabad Refinery Expansion - Package 04".to_string(),
            description: Some("EPC Package for Crude Distillation Unit (CDU), Pipe Rack B, and Compressor Station".to_string()),
            timezone: "Asia/Kolkata".to_string(),
            currency: "INR".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let act1_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000001").unwrap();
        let act2_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000002").unwrap();
        let act3_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000003").unwrap();
        let act4_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000004").unwrap();
        let act5_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000005").unwrap();

        let activities = vec![
            Activity {
                id: act1_id,
                project_id,
                schedule_version_id,
                wbs_id,
                code: "PIP-2400".to_string(),
                name: "Spool Erection and Alignment - Pipe Rack B".to_string(),
                description: Some(
                    "Prefabricated carbon steel piping spool erection on Rack B".to_string(),
                ),
                discipline: Discipline::Piping,
                planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 10).unwrap(),
                planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
                planned_duration_days: 15,
                planned_quantity: Some(450.0),
                unit_of_measure: Some("Inch-Dia".to_string()),
                location: Some("Pipe Rack B".to_string()),
                zone: Some("Zone 2".to_string()),
                equipment_tag: Some("RACK-B-CS".to_string()),
                weightage: 1.5,
                critical_path: true,
            },
            Activity {
                id: act2_id,
                project_id,
                schedule_version_id,
                wbs_id,
                code: "PIP-2401".to_string(),
                name: "Hydrostatic Testing - Line P-101 (Crude Feed Header)".to_string(),
                description: Some(
                    "Pressure testing of 24 inch crude feed header Line P-101".to_string(),
                ),
                discipline: Discipline::Piping,
                planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
                planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
                planned_duration_days: 3,
                planned_quantity: Some(1.0),
                unit_of_measure: Some("Test-Pack".to_string()),
                location: Some("Pipe Rack B".to_string()),
                zone: Some("Zone 2".to_string()),
                equipment_tag: Some("LINE-P-101".to_string()),
                weightage: 2.0,
                critical_path: true,
            },
            Activity {
                id: act3_id,
                project_id,
                schedule_version_id,
                wbs_id,
                code: "PIP-2402".to_string(),
                name: "Hydrostatic Testing - Line P-102 (Naphtha Return Header)".to_string(),
                description: Some(
                    "Pressure testing of 16 inch naphtha return header Line P-102".to_string(),
                ),
                discipline: Discipline::Piping,
                planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
                planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 30).unwrap(),
                planned_duration_days: 3,
                planned_quantity: Some(1.0),
                unit_of_measure: Some("Test-Pack".to_string()),
                location: Some("Pipe Rack B".to_string()),
                zone: Some("Zone 2".to_string()),
                equipment_tag: Some("LINE-P-102".to_string()),
                weightage: 1.8,
                critical_path: false,
            },
            Activity {
                id: act4_id,
                project_id,
                schedule_version_id,
                wbs_id,
                code: "CIV-1100".to_string(),
                name: "Rebar Tying and Shuttering - Compressor Foundation".to_string(),
                description: Some(
                    "Reinforcement steel bar cutting, bending and shuttering".to_string(),
                ),
                discipline: Discipline::Civil,
                planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 15).unwrap(),
                planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 24).unwrap(),
                planned_duration_days: 10,
                planned_quantity: Some(35.5),
                unit_of_measure: Some("MT".to_string()),
                location: Some("Compressor House".to_string()),
                zone: Some("Zone 1".to_string()),
                equipment_tag: Some("FND-C-101".to_string()),
                weightage: 1.2,
                critical_path: false,
            },
            Activity {
                id: act5_id,
                project_id,
                schedule_version_id,
                wbs_id,
                code: "CIV-1101".to_string(),
                name: "Concrete Pour - Column Footings Area 100".to_string(),
                description: Some(
                    "Ready-mix concrete pouring for heavy column footings".to_string(),
                ),
                discipline: Discipline::Civil,
                planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
                planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 29).unwrap(),
                planned_duration_days: 5,
                planned_quantity: Some(180.0),
                unit_of_measure: Some("Cu.M".to_string()),
                location: Some("CDU Area 100".to_string()),
                zone: Some("Zone 1".to_string()),
                equipment_tag: Some("COL-FTG-100".to_string()),
                weightage: 1.4,
                critical_path: false,
            },
        ];

        let states = activities
            .iter()
            .map(|a| ActivityCurrentState {
                activity_id: a.id,
                project_id: a.project_id,
                execution_status: ExecutionStatus::NotStarted,
                actual_start_date: None,
                actual_finish_date: None,
                current_progress_pct: 0.0,
                cumulative_quantity: 0.0,
                last_event_id: None,
                last_event_date: None,
                is_critical_path_delayed: false,
                variance_days: 0,
                updated_at: Utc::now(),
            })
            .collect();

        Self {
            projects: Arc::new(RwLock::new(vec![demo_project])),
            activities: Arc::new(RwLock::new(activities)),
            activity_states: Arc::new(RwLock::new(states)),
            observations: Arc::new(RwLock::new(Vec::new())),
            proposals: Arc::new(RwLock::new(Vec::new())),
            events: Arc::new(RwLock::new(Vec::new())),
            approvals: Arc::new(RwLock::new(Vec::new())),
            audit_trail: Arc::new(RwLock::new(Vec::new())),
            outbox_events: Arc::new(RwLock::new(Vec::new())),
            last_audit_hash: Arc::new(RwLock::new(None)),
            audit_archives: Arc::new(RwLock::new(Vec::new())),
            legal_holds: Arc::new(RwLock::new(std::collections::HashMap::new())),
            rabbit_publisher,
            redis_cache,
            database,
            cache_ttl: CacheTtl::default(),
        }
    }
}

// =============================================================================
// Health Check
// =============================================================================

pub async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let rabbit_status = if state.rabbit_publisher.is_some() {
        "connected"
    } else {
        "not_configured"
    };

    let redis_status = match &state.redis_cache {
        Some(cache) => {
            if cache.ping().await {
                "connected"
            } else {
                "unreachable"
            }
        }
        None => "not_configured",
    };

    Json(serde_json::json!({
        "status": "healthy",
        "service": "nexora-trust-plane",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": Utc::now().to_rfc3339(),
        "rabbitmq": rabbit_status,
        "redis": redis_status
    }))
}

// =============================================================================
// Dashboard & Query Handlers
// =============================================================================

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct DashboardKPIs {
    pub total_observations: usize,
    pub extracted_events: usize,
    pub auto_linked_events: usize,
    pub review_queue_count: usize,
    pub unmatched_count: usize,
    pub completed_activities: usize,
    pub in_progress_activities: usize,
    pub overall_progress_pct: f64,
}

pub async fn get_dashboard(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    // Try Redis cache first
    if let Some(cache) = &state.redis_cache {
        if let Some(cached) = cache
            .get::<DashboardKPIs>("dashboard", Some(project_id))
            .await
        {
            tracing::debug!("Dashboard cache HIT for project {}", project_id);
            return Json(cached);
        }
    }

    let obs = state.observations.read().await;
    let proposals = state.proposals.read().await;
    let events = state.events.read().await;
    let act_states = state.activity_states.read().await;

    let auto_linked = proposals
        .iter()
        .filter(|p| p.status == "AUTO_LINKED")
        .count();
    let review_queue = proposals
        .iter()
        .filter(|p| p.status == "PENDING_REVIEW")
        .count();
    let unmatched = proposals
        .iter()
        .filter(|p| p.match_tier == MatchTier::Unmatched)
        .count();
    let completed = act_states
        .iter()
        .filter(|s| s.execution_status == ExecutionStatus::Completed)
        .count();
    let in_progress = act_states
        .iter()
        .filter(|s| s.execution_status == ExecutionStatus::InProgress)
        .count();

    let total_progress: f64 = act_states.iter().map(|s| s.current_progress_pct).sum();
    let overall_pct = if !act_states.is_empty() {
        total_progress / (act_states.len() as f64)
    } else {
        0.0
    };

    let kpis = DashboardKPIs {
        total_observations: obs.len(),
        extracted_events: events.len(),
        auto_linked_events: auto_linked,
        review_queue_count: review_queue,
        unmatched_count: unmatched,
        completed_activities: completed,
        in_progress_activities: in_progress,
        overall_progress_pct: (overall_pct * 100.0).round() / 100.0,
    };

    // Cache the result
    if let Some(cache) = &state.redis_cache {
        cache
            .set(
                "dashboard",
                Some(project_id),
                &kpis,
                state.cache_ttl.dashboard_secs,
            )
            .await;
    }

    Json(kpis)
}

pub async fn get_activities(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    // Try Redis cache first
    if let Some(cache) = &state.redis_cache {
        if let Some(cached) = cache
            .get::<serde_json::Value>("activities", Some(project_id))
            .await
        {
            tracing::debug!("Activities cache HIT for project {}", project_id);
            return Json(cached);
        }
    }

    let acts = state.activities.read().await;
    let states = state.activity_states.read().await;

    #[derive(Serialize)]
    struct ActivityWithState {
        activity: Activity,
        state: Option<ActivityCurrentState>,
    }

    let combined: Vec<ActivityWithState> = acts
        .iter()
        .filter(|a| a.project_id == project_id)
        .map(|a| {
            let s = states.iter().find(|st| st.activity_id == a.id).cloned();
            ActivityWithState {
                activity: a.clone(),
                state: s,
            }
        })
        .collect();

    let value = serde_json::to_value(&combined).unwrap_or(serde_json::json!([]));

    // Cache the result
    if let Some(cache) = &state.redis_cache {
        cache
            .set(
                "activities",
                Some(project_id),
                &value,
                state.cache_ttl.activities_secs,
            )
            .await;
    }

    Json(value)
}

pub async fn get_review_queue(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    // Try Redis cache first
    if let Some(cache) = &state.redis_cache {
        if let Some(cached) = cache
            .get::<serde_json::Value>("review_queue", Some(project_id))
            .await
        {
            tracing::debug!("Review queue cache HIT for project {}", project_id);
            return Json(cached);
        }
    }

    let proposals = state.proposals.read().await;
    let obs = state.observations.read().await;
    let acts = state.activities.read().await;

    #[derive(Serialize)]
    struct ReviewItem {
        proposal: MatchProposal,
        observation: Option<WorkObservation>,
        activity: Option<Activity>,
    }

    let pending: Vec<ReviewItem> = proposals
        .iter()
        .filter(|p| p.project_id == project_id && p.status == "PENDING_REVIEW")
        .map(|p| {
            let observation = obs.iter().find(|o| o.id == p.observation_id).cloned();
            let activity = acts.iter().find(|a| a.id == p.activity_id).cloned();
            ReviewItem {
                proposal: p.clone(),
                observation,
                activity,
            }
        })
        .collect();

    let value = serde_json::to_value(&pending).unwrap_or(serde_json::json!([]));

    // Cache the result
    if let Some(cache) = &state.redis_cache {
        cache
            .set(
                "review_queue",
                Some(project_id),
                &value,
                state.cache_ttl.review_queue_secs,
            )
            .await;
    }

    Json(value)
}

/// GET /api/v1/projects/:id/observations — list all observations for a project
pub async fn get_observations(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let obs = state.observations.read().await;
    let filtered: Vec<WorkObservation> = obs
        .iter()
        .filter(|o| o.project_id == project_id)
        .cloned()
        .collect();
    Json(filtered)
}

/// GET /api/v1/projects/:id/events — list all actual events for a project
pub async fn get_events(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let events = state.events.read().await;
    let filtered: Vec<ActualEvent> = events
        .iter()
        .filter(|e| e.project_id == project_id)
        .cloned()
        .collect();
    Json(filtered)
}

pub async fn get_audit_trail(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let trail = state.audit_trail.read().await;
    let filtered: Vec<AuditEvent> = trail
        .iter()
        .filter(|a| a.project_id == project_id)
        .cloned()
        .collect();
    Json(filtered)
}

pub async fn verify_audit_chain(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let trail = state.audit_trail.read().await;
    let filtered: Vec<AuditEvent> = trail
        .iter()
        .filter(|a| a.project_id == project_id)
        .cloned()
        .collect();

    let result = EventLedger::verify_chain_integrity(&filtered);
    match result {
        Ok(()) => Json(serde_json::json!({
            "valid": true,
            "total_events": filtered.len(),
            "message": "Audit chain integrity fully verified"
        })),
        Err(broken_idx) => Json(serde_json::json!({
            "valid": false,
            "total_events": filtered.len(),
            "broken_at_index": broken_idx,
            "message": format!("Audit chain verification failed at event index {}", broken_idx)
        })),
    }
}

/// GET /api/v1/projects/:id/audit-trail/retention-policy
pub async fn get_audit_retention_policy(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let trail = state.audit_trail.read().await;
    let archives = state.audit_archives.read().await;
    let holds = state.legal_holds.read().await;

    let hot_count = trail.iter().filter(|a| a.project_id == project_id).count();
    let archived_count: usize = archives
        .iter()
        .filter(|a| a.project_id == project_id)
        .map(|a| a.record_count)
        .sum();
    let is_legal_hold = holds.get(&project_id).copied().unwrap_or(false);

    let policy = crate::domain::ledger::AuditRetentionPolicy::default();

    Json(serde_json::json!({
        "project_id": project_id,
        "policy": policy,
        "hot_records_count": hot_count,
        "archived_records_count": archived_count,
        "archive_batches_count": archives.iter().filter(|a| a.project_id == project_id).count(),
        "is_legal_hold_active": is_legal_hold
    }))
}

#[derive(Deserialize)]
pub struct LegalHoldPayload {
    pub enabled: bool,
    pub reason: Option<String>,
    pub authorized_by: Option<Uuid>,
}

/// POST /api/v1/projects/:id/audit-trail/legal-hold
pub async fn set_legal_hold(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<LegalHoldPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let mut holds = state.legal_holds.write().await;
    holds.insert(project_id, payload.enabled);

    let mut audit_trail = state.audit_trail.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;

    let action_str = if payload.enabled {
        "ENABLE_LEGAL_HOLD"
    } else {
        "RELEASE_LEGAL_HOLD"
    };

    let audit = EventLedger::create_audit_event(
        project_id,
        "PROJECT_GOVERNANCE",
        project_id,
        action_str,
        payload.authorized_by,
        Some("COMPLIANCE_OFFICER"),
        None,
        Some(serde_json::json!({
            "legal_hold": payload.enabled,
            "reason": payload.reason.unwrap_or_else(|| "Compliance request".to_string())
        })),
        last_hash_lock.as_deref(),
    );
    *last_hash_lock = Some(audit.payload_hash.clone());
    audit_trail.push(audit);

    Ok(Json(serde_json::json!({
        "project_id": project_id,
        "legal_hold_active": payload.enabled,
        "status": "UPDATED"
    })))
}

/// POST /api/v1/projects/:id/audit-trail/archive
pub async fn archive_audit_trail(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let holds = state.legal_holds.read().await;
    let is_legal_hold = holds.get(&project_id).copied().unwrap_or(false);
    drop(holds);

    let policy = crate::domain::ledger::AuditRetentionPolicy::default();
    let mut trail = state.audit_trail.write().await;

    let project_events: Vec<AuditEvent> = trail
        .iter()
        .filter(|a| a.project_id == project_id)
        .cloned()
        .collect();

    match EventLedger::prepare_audit_archive(project_id, &project_events, &policy, is_legal_hold) {
        Ok(Some((batch, _to_archive, to_retain_hot))) => {
            // Keep hot records and non-project records
            trail.retain(|a| a.project_id != project_id);
            trail.extend(to_retain_hot);

            let mut archives = state.audit_archives.write().await;
            archives.push(batch.clone());

            Ok(Json(serde_json::json!({
                "status": "ARCHIVED",
                "batch": batch
            })))
        }
        Ok(None) => Ok(Json(serde_json::json!({
            "status": "NO_OP",
            "message": "No audit records older than the hot retention window found to archive"
        }))),
        Err(err) => Err(ApiError::bad_request(err)),
    }
}

// =============================================================================
// Decision Payloads
// =============================================================================

fn default_reviewer_id() -> Uuid {
    Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap_or_else(|_| Uuid::nil())
}

pub fn parse_uuid_or_derive(id_str: &str) -> Uuid {
    if let Ok(u) = Uuid::parse_str(id_str) {
        return u;
    }
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(id_str.as_bytes());
    let hash = hasher.finalize();
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&hash[0..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(bytes)
}

fn empty_string_is_none<'de, D>(deserializer: D) -> Result<Option<Uuid>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt = Option::<String>::deserialize(deserializer)?;
    match opt.as_deref() {
        None | Some("") => Ok(None),
        Some(s) => Ok(Some(parse_uuid_or_derive(s))),
    }
}

#[derive(Deserialize)]
pub struct DecisionPayload {
    #[serde(alias = "reviewed_by", default = "default_reviewer_id")]
    pub reviewer_id: Uuid,
    pub comments: Option<String>,
    #[serde(default, deserialize_with = "empty_string_is_none")]
    pub selected_activity_id: Option<Uuid>,
}

// =============================================================================
// Approval / Rejection / Override Handlers
// =============================================================================

pub async fn approve_proposal(
    State(state): State<AppState>,
    Path(proposal_id_raw): Path<String>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let proposal_id = parse_uuid_or_derive(&proposal_id_raw);
    let mut proposals = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;
    let mut outbox_store = state.outbox_events.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;
    let acts = state.activities.read().await;

    let (project_id, obs_id, original_act_id) =
        if let Some(p) = proposals.iter_mut().find(|p| p.id == proposal_id) {
            p.status = "ACCEPTED".to_string();
            (p.project_id, p.observation_id, p.activity_id)
        } else {
            let default_project = state.projects.read().await[0].id;
            let default_act = payload.selected_activity_id.unwrap_or_else(|| acts[0].id);
            let dynamic_obs_id = Uuid::new_v4();
            let new_prop = MatchProposal {
                id: proposal_id,
                project_id: default_project,
                observation_id: dynamic_obs_id,
                activity_id: default_act,
                candidate_rank: 1,
                lexical_score: 0.85,
                semantic_score: 0.90,
                context_boost: 0.10,
                confidence_score: 0.90,
                match_tier: MatchTier::Medium,
                explanation: Some("Planner approved via Field Ledger UI".to_string()),
                evidence_snippet: payload.comments.clone(),
                status: "ACCEPTED".to_string(),
                created_at: Utc::now(),
            };
            proposals.push(new_prop);
            (default_project, dynamic_obs_id, default_act)
        };

    let target_activity_id = payload.selected_activity_id.unwrap_or(original_act_id);
    let act = acts
        .iter()
        .find(|a| a.id == target_activity_id)
        .ok_or(ApiError::not_found("Target activity not found"))?;

    // --- Validation gates ---
    let actual_date = Utc::now().date_naive();
    ValidationEngine::validate_event_date(actual_date)
        .map_err(|e| ApiError::validation(e.to_string()))?;
    ValidationEngine::validate_progress(Some(100.0))
        .map_err(|e| ApiError::validation(e.to_string()))?;

    // --- Idempotency gate ---
    let idempotency_key = format!("event-{}-{}", target_activity_id, actual_date);
    let existing_keys: Vec<Option<String>> =
        events.iter().map(|e| e.idempotency_key.clone()).collect();
    ValidationEngine::validate_idempotency_key(Some(&idempotency_key), &existing_keys)
        .map_err(|e| ApiError::conflict(e.to_string()))?;

    // Create official ActualEvent
    let new_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id: target_activity_id,
        observation_id: Some(obs_id),
        match_proposal_id: Some(proposal_id),
        event_type: EventType::Finish,
        actual_date,
        actual_progress_pct: Some(100.0),
        actual_quantity: act.planned_quantity,
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: Some(idempotency_key),
        created_by: Some(payload.reviewer_id),
        created_at: Utc::now(),
    };

    // Project to current state
    if let Some(state_entry) = act_states
        .iter_mut()
        .find(|s| s.activity_id == target_activity_id)
    {
        let _ = StateMachine::project_event(state_entry, &new_event, act.planned_finish_date);
    }

    // Create Approval record
    let approval = Approval {
        id: Uuid::new_v4(),
        project_id,
        event_id: Some(new_event.id),
        proposal_id: Some(proposal_id),
        action: "APPROVE".to_string(),
        reviewed_by: payload.reviewer_id,
        reviewed_at: Utc::now(),
        selected_activity_id: payload.selected_activity_id,
        comments: payload.comments.clone(),
        confidence_override: None,
    };
    approvals_store.push(approval);

    // Audit trail with hash chaining
    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_APPROVAL",
        proposal_id,
        "APPROVE_AND_COMMIT",
        Some(payload.reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({"status": "PENDING_REVIEW"})),
        Some(serde_json::json!({
            "status": "COMMITTED",
            "event_id": new_event.id,
            "comments": payload.comments
        })),
        last_hash_lock.as_deref(),
    );
    *last_hash_lock = Some(audit.payload_hash.clone());

    // Outbox event for async delivery
    let outbox = EventLedger::create_outbox_event(project_id, "PROPOSAL_APPROVED", &new_event);
    outbox_store.push(outbox);

    events.push(new_event.clone());
    audit_trail.push(audit);

    // Invalidate caches after state mutation
    if let Some(cache) = &state.redis_cache {
        cache.invalidate_project(project_id).await;
    }

    Ok(Json(serde_json::json!({
        "status": "APPROVED",
        "event_id": new_event.id,
        "activity_code": act.code
    })))
}

pub async fn reject_proposal(
    State(state): State<AppState>,
    Path(proposal_id_raw): Path<String>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let proposal_id = parse_uuid_or_derive(&proposal_id_raw);
    let mut proposals = state.proposals.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;
    let acts = state.activities.read().await;

    let project_id = if let Some(p) = proposals.iter_mut().find(|p| p.id == proposal_id) {
        p.status = "REJECTED".to_string();
        p.project_id
    } else {
        let default_project = state.projects.read().await[0].id;
        let new_prop = MatchProposal {
            id: proposal_id,
            project_id: default_project,
            observation_id: Uuid::new_v4(),
            activity_id: acts[0].id,
            candidate_rank: 1,
            lexical_score: 0.50,
            semantic_score: 0.50,
            context_boost: 0.0,
            confidence_score: 0.50,
            match_tier: MatchTier::Low,
            explanation: Some("Proposal rejected by Lead Planner".to_string()),
            evidence_snippet: payload.comments.clone(),
            status: "REJECTED".to_string(),
            created_at: Utc::now(),
        };
        proposals.push(new_prop);
        default_project
    };

    // Create Approval record for the rejection
    let approval = Approval {
        id: Uuid::new_v4(),
        project_id,
        event_id: None,
        proposal_id: Some(proposal_id),
        action: "REJECT".to_string(),
        reviewed_by: payload.reviewer_id,
        reviewed_at: Utc::now(),
        selected_activity_id: None,
        comments: payload.comments.clone(),
        confidence_override: None,
    };
    approvals_store.push(approval);

    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_REJECTION",
        proposal_id,
        "REJECT",
        Some(payload.reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({"status": "PENDING_REVIEW"})),
        Some(serde_json::json!({"status": "REJECTED", "comments": payload.comments})),
        last_hash_lock.as_deref(),
    );
    *last_hash_lock = Some(audit.payload_hash.clone());
    audit_trail.push(audit);

    // Invalidate caches after state mutation
    if let Some(cache) = &state.redis_cache {
        cache.invalidate_project(project_id).await;
    }

    Ok(Json(
        serde_json::json!({"status": "REJECTED", "proposal_id": proposal_id}),
    ))
}

/// Override a proposal — planner selects a different target activity
pub async fn override_proposal(
    State(state): State<AppState>,
    Path(proposal_id_raw): Path<String>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let proposal_id = parse_uuid_or_derive(&proposal_id_raw);
    let selected_activity_id = payload.selected_activity_id.ok_or(ApiError::bad_request(
        "selected_activity_id is required for override",
    ))?;

    let mut proposals = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;
    let mut outbox_store = state.outbox_events.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;
    let acts = state.activities.read().await;

    let (project_id, obs_id, original_activity_id) =
        if let Some(p) = proposals.iter_mut().find(|p| p.id == proposal_id) {
            p.status = "OVERRIDDEN".to_string();
            (p.project_id, p.observation_id, p.activity_id)
        } else {
            let default_project = state.projects.read().await[0].id;
            let dynamic_obs_id = Uuid::new_v4();
            let new_prop = MatchProposal {
                id: proposal_id,
                project_id: default_project,
                observation_id: dynamic_obs_id,
                activity_id: selected_activity_id,
                candidate_rank: 1,
                lexical_score: 0.60,
                semantic_score: 0.65,
                context_boost: 0.05,
                confidence_score: 0.65,
                match_tier: MatchTier::Medium,
                explanation: Some("Planner overrode proposal with new activity".to_string()),
                evidence_snippet: payload.comments.clone(),
                status: "OVERRIDDEN".to_string(),
                created_at: Utc::now(),
            };
            proposals.push(new_prop);
            (default_project, dynamic_obs_id, selected_activity_id)
        };

    // Validate that the override target activity exists and belongs to the same project
    let act = acts
        .iter()
        .find(|a| a.id == selected_activity_id && a.project_id == project_id)
        .ok_or(ApiError::not_found(
            "Override target activity not found in this project",
        ))?;

    let actual_date = Utc::now().date_naive();
    ValidationEngine::validate_event_date(actual_date)
        .map_err(|e| ApiError::validation(e.to_string()))?;

    // Create ActualEvent linked to the overridden activity
    let new_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id: selected_activity_id,
        observation_id: Some(obs_id),
        match_proposal_id: Some(proposal_id),
        event_type: EventType::Finish,
        actual_date,
        actual_progress_pct: Some(100.0),
        actual_quantity: act.planned_quantity,
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: Some(format!("override-{}-{}", selected_activity_id, actual_date)),
        created_by: Some(payload.reviewer_id),
        created_at: Utc::now(),
    };

    // Project to current state
    if let Some(state_entry) = act_states
        .iter_mut()
        .find(|s| s.activity_id == selected_activity_id)
    {
        let _ = StateMachine::project_event(state_entry, &new_event, act.planned_finish_date);
    }

    // Create Approval record with OVERRIDE action
    let approval = Approval {
        id: Uuid::new_v4(),
        project_id,
        event_id: Some(new_event.id),
        proposal_id: Some(proposal_id),
        action: "OVERRIDE".to_string(),
        reviewed_by: payload.reviewer_id,
        reviewed_at: Utc::now(),
        selected_activity_id: Some(selected_activity_id),
        comments: payload.comments.clone(),
        confidence_override: None,
    };
    approvals_store.push(approval);

    // Audit trail
    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_OVERRIDE",
        proposal_id,
        "OVERRIDE_AND_COMMIT",
        Some(payload.reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({
            "status": "PENDING_REVIEW",
            "original_activity_id": original_activity_id
        })),
        Some(serde_json::json!({
            "status": "OVERRIDDEN",
            "selected_activity_id": selected_activity_id,
            "event_id": new_event.id,
            "comments": payload.comments
        })),
        last_hash_lock.as_deref(),
    );
    *last_hash_lock = Some(audit.payload_hash.clone());

    let outbox = EventLedger::create_outbox_event(project_id, "PROPOSAL_OVERRIDDEN", &new_event);
    outbox_store.push(outbox);

    events.push(new_event.clone());
    audit_trail.push(audit);

    // Invalidate caches after state mutation
    if let Some(cache) = &state.redis_cache {
        cache.invalidate_project(project_id).await;
    }

    Ok(Json(serde_json::json!({
        "status": "OVERRIDDEN",
        "event_id": new_event.id,
        "activity_code": act.code,
        "original_activity_id": original_activity_id,
        "selected_activity_id": selected_activity_id
    })))
}

/// Add a comment to a proposal without changing its status
#[derive(Deserialize)]
pub struct CommentPayload {
    #[serde(alias = "reviewed_by", default = "default_reviewer_id")]
    pub reviewer_id: Uuid,
    pub comments: String,
}

pub async fn add_proposal_comment(
    State(state): State<AppState>,
    Path(proposal_id_raw): Path<String>,
    Json(payload): Json<CommentPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let proposal_id = parse_uuid_or_derive(&proposal_id_raw);
    let proposals = state.proposals.read().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;

    let project_id = if let Some(p) = proposals.iter().find(|p| p.id == proposal_id) {
        p.project_id
    } else {
        state.projects.read().await[0].id
    };

    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_COMMENT",
        proposal_id,
        "COMMENT",
        Some(payload.reviewer_id),
        Some("PLANNER"),
        None,
        Some(serde_json::json!({"comments": payload.comments})),
        last_hash_lock.as_deref(),
    );
    *last_hash_lock = Some(audit.payload_hash.clone());
    audit_trail.push(audit);

    Ok(Json(
        serde_json::json!({"status": "COMMENT_ADDED", "proposal_id": proposal_id}),
    ))
}

fn deserialize_string_or_uuid_vec<'de, D>(deserializer: D) -> Result<Vec<Uuid>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let list = Vec::<String>::deserialize(deserializer)?;
    Ok(list.into_iter().map(|s| parse_uuid_or_derive(&s)).collect())
}

/// Batch approve multiple proposals
#[derive(Deserialize)]
pub struct BatchApprovePayload {
    #[serde(alias = "reviewed_by", default = "default_reviewer_id")]
    pub reviewer_id: Uuid,
    #[serde(default, deserialize_with = "deserialize_string_or_uuid_vec")]
    pub proposal_ids: Vec<Uuid>,
    pub comments: Option<String>,
}

pub async fn batch_approve_proposals(
    State(state): State<AppState>,
    Json(payload): Json<BatchApprovePayload>,
) -> Result<impl IntoResponse, ApiError> {
    let mut proposals = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;
    let mut outbox_store = state.outbox_events.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;
    let acts = state.activities.read().await;

    let mut results = Vec::new();
    let actual_date = Utc::now().date_naive();

    for pid in &payload.proposal_ids {
        let proposal = match proposals.iter_mut().find(|p| p.id == *pid) {
            Some(p) => p,
            None => {
                results.push(serde_json::json!({
                    "proposal_id": pid,
                    "status": "NOT_FOUND"
                }));
                continue;
            }
        };

        if proposal.status != "PENDING_REVIEW" && proposal.status != "PROPOSED" {
            results.push(serde_json::json!({
                "proposal_id": pid,
                "status": "SKIPPED",
                "reason": format!("Proposal status is '{}', not reviewable", proposal.status)
            }));
            continue;
        }

        proposal.status = "ACCEPTED".to_string();

        let act = match acts.iter().find(|a| a.id == proposal.activity_id) {
            Some(a) => a,
            None => {
                results.push(serde_json::json!({
                    "proposal_id": pid,
                    "status": "ERROR",
                    "reason": "Target activity not found"
                }));
                continue;
            }
        };

        let new_event = ActualEvent {
            id: Uuid::new_v4(),
            project_id: proposal.project_id,
            activity_id: proposal.activity_id,
            observation_id: Some(proposal.observation_id),
            match_proposal_id: Some(proposal.id),
            event_type: EventType::Finish,
            actual_date,
            actual_progress_pct: Some(100.0),
            actual_quantity: act.planned_quantity,
            delay_reason: None,
            delay_days: None,
            lifecycle_status: LifecycleStatus::Committed,
            verification_status: VerificationStatus::HumanVerified,
            idempotency_key: Some(format!("batch-{}-{}", proposal.activity_id, actual_date)),
            created_by: Some(payload.reviewer_id),
            created_at: Utc::now(),
        };

        if let Some(state_entry) = act_states
            .iter_mut()
            .find(|s| s.activity_id == proposal.activity_id)
        {
            let _ = StateMachine::project_event(state_entry, &new_event, act.planned_finish_date);
        }

        let approval = Approval {
            id: Uuid::new_v4(),
            project_id: proposal.project_id,
            event_id: Some(new_event.id),
            proposal_id: Some(proposal.id),
            action: "APPROVE".to_string(),
            reviewed_by: payload.reviewer_id,
            reviewed_at: Utc::now(),
            selected_activity_id: None,
            comments: payload.comments.clone(),
            confidence_override: None,
        };
        approvals_store.push(approval);

        let audit = EventLedger::create_audit_event(
            proposal.project_id,
            "BATCH_PROPOSAL_APPROVAL",
            proposal.id,
            "BATCH_APPROVE_AND_COMMIT",
            Some(payload.reviewer_id),
            Some("PLANNER"),
            Some(serde_json::json!({"status": "PENDING_REVIEW"})),
            Some(serde_json::json!({"status": "COMMITTED", "event_id": new_event.id})),
            last_hash_lock.as_deref(),
        );
        *last_hash_lock = Some(audit.payload_hash.clone());

        let outbox = EventLedger::create_outbox_event(
            proposal.project_id,
            "BATCH_PROPOSAL_APPROVED",
            &new_event,
        );
        outbox_store.push(outbox);

        results.push(serde_json::json!({
            "proposal_id": pid,
            "status": "APPROVED",
            "event_id": new_event.id,
            "activity_code": act.code
        }));

        events.push(new_event);
        audit_trail.push(audit);
    }

    // Invalidate caches for all affected projects
    if let Some(cache) = &state.redis_cache {
        let projects_guard = state.projects.read().await;
        for p in projects_guard.iter() {
            cache.invalidate_project(p.id).await;
        }
    }

    Ok(Json(serde_json::json!({
        "batch_size": payload.proposal_ids.len(),
        "results": results
    })))
}

// =============================================================================
// Observation Creation
// =============================================================================

#[derive(Deserialize)]
pub struct CreateObservationPayload {
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
    pub reported_by: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

pub async fn create_observation(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<CreateObservationPayload>,
) -> Result<impl IntoResponse, ApiError> {
    // Validate progress and quantity if supplied
    ValidationEngine::validate_progress(payload.reported_progress)
        .map_err(|e| ApiError::validation(e.to_string()))?;
    ValidationEngine::validate_quantity_bounds(payload.reported_quantity)
        .map_err(|e| ApiError::validation(e.to_string()))?;

    let mut obs_list = state.observations.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;

    let obs = WorkObservation {
        id: Uuid::new_v4(),
        project_id,
        document_id: None,
        reported_by: payload.reported_by,
        observed_at: Some(Utc::now()),
        recorded_at: Utc::now(),
        discipline: payload.discipline,
        location: payload.location,
        zone: payload.zone,
        equipment_tag: payload.equipment_tag,
        raw_text: payload.raw_text,
        normalized_text: payload.normalized_text,
        event_type: payload.event_type,
        reported_progress: payload.reported_progress,
        reported_quantity: payload.reported_quantity,
        unit_of_measure: payload.unit_of_measure,
        metadata: payload.metadata.unwrap_or(serde_json::json!({})),
    };

    let audit = EventLedger::create_audit_event(
        project_id,
        "WORK_OBSERVATION",
        obs.id,
        "CREATE_OBSERVATION",
        payload.reported_by,
        Some("SUPERVISOR"),
        None,
        Some(serde_json::json!({
            "raw_text": obs.raw_text,
            "discipline": obs.discipline,
            "progress": obs.reported_progress
        })),
        last_hash_lock.as_deref(),
    );
    *last_hash_lock = Some(audit.payload_hash.clone());

    obs_list.push(obs.clone());
    audit_trail.push(audit);

    Ok((StatusCode::CREATED, Json(obs)))
}

// =============================================================================
// Ingest Pipeline
// =============================================================================

#[derive(Deserialize, Clone)]
pub struct IngestObservationPayload {
    pub raw_text: String,
    pub normalized_text: Option<String>,
    pub discipline: Option<Discipline>,
    pub location: Option<String>,
    pub zone: Option<String>,
    pub equipment_tag: Option<String>,
    pub event_type: Option<EventType>,
    pub reported_progress: Option<f64>,
    pub reported_quantity: Option<f64>,
    pub unit_of_measure: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct IngestProposalPayload {
    pub activity_id: Uuid,
    pub candidate_rank: i32,
    pub lexical_score: f64,
    pub semantic_score: f64,
    pub context_boost: f64,
    pub confidence_score: f64,
    pub match_tier: MatchTier,
    pub explanation: Option<String>,
    pub evidence_snippet: Option<String>,
    pub auto_link_eligible: bool,
}

#[derive(Deserialize, Clone)]
pub struct IngestItem {
    pub observation: IngestObservationPayload,
    pub proposal: Option<IngestProposalPayload>,
}

#[derive(Deserialize)]
pub struct IngestRequest {
    pub document_id: Option<Uuid>,
    pub items: Vec<IngestItem>,
}

#[derive(Serialize)]
pub struct IngestResponse {
    pub project_id: Uuid,
    pub total_ingested: usize,
    pub auto_committed: usize,
    pub review_required: usize,
    pub unmatched: usize,
}

pub async fn ingest_observations(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<IngestRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let mut obs_list = state.observations.write().await;
    let mut prop_list = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut outbox_store = state.outbox_events.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;
    let acts = state.activities.read().await;

    let mut auto_committed = 0;
    let mut review_required = 0;
    let mut unmatched = 0;

    for item in payload.items.iter() {
        let obs_id = Uuid::new_v4();
        let obs = WorkObservation {
            id: obs_id,
            project_id,
            document_id: payload.document_id,
            reported_by: None,
            observed_at: Some(Utc::now()),
            recorded_at: Utc::now(),
            discipline: item.observation.discipline,
            location: item.observation.location.clone(),
            zone: item.observation.zone.clone(),
            equipment_tag: item.observation.equipment_tag.clone(),
            raw_text: item.observation.raw_text.clone(),
            normalized_text: item.observation.normalized_text.clone(),
            event_type: item.observation.event_type,
            reported_progress: item.observation.reported_progress,
            reported_quantity: item.observation.reported_quantity,
            unit_of_measure: item.observation.unit_of_measure.clone(),
            metadata: serde_json::json!({}),
        };
        obs_list.push(obs);

        if let Some(prop_data) = &item.proposal {
            let prop_id = Uuid::new_v4();
            let act_opt = acts.iter().find(|a| a.id == prop_data.activity_id);

            if let (true, Some(act)) = (prop_data.auto_link_eligible, act_opt) {
                let actual_date = Utc::now().date_naive();
                let progress = item.observation.reported_progress.unwrap_or(100.0);

                let new_event = ActualEvent {
                    id: Uuid::new_v4(),
                    project_id,
                    activity_id: act.id,
                    observation_id: Some(obs_id),
                    match_proposal_id: Some(prop_id),
                    event_type: item.observation.event_type.unwrap_or(EventType::Finish),
                    actual_date,
                    actual_progress_pct: Some(progress),
                    actual_quantity: item.observation.reported_quantity.or(act.planned_quantity),
                    delay_reason: None,
                    delay_days: None,
                    lifecycle_status: LifecycleStatus::Committed,
                    verification_status: VerificationStatus::SystemVerified,
                    idempotency_key: Some(format!("autolink-{}-{}", act.id, actual_date)),
                    created_by: None,
                    created_at: Utc::now(),
                };

                if let Some(state_entry) = act_states.iter_mut().find(|s| s.activity_id == act.id) {
                    let _ = StateMachine::project_event(
                        state_entry,
                        &new_event,
                        act.planned_finish_date,
                    );
                }

                let proposal = MatchProposal {
                    id: prop_id,
                    project_id,
                    observation_id: obs_id,
                    activity_id: act.id,
                    candidate_rank: prop_data.candidate_rank,
                    lexical_score: prop_data.lexical_score,
                    semantic_score: prop_data.semantic_score,
                    context_boost: prop_data.context_boost,
                    confidence_score: prop_data.confidence_score,
                    match_tier: prop_data.match_tier,
                    explanation: prop_data.explanation.clone(),
                    evidence_snippet: prop_data.evidence_snippet.clone(),
                    status: "AUTO_LINKED".to_string(),
                    created_at: Utc::now(),
                };
                prop_list.push(proposal);

                let audit = EventLedger::create_audit_event(
                    project_id,
                    "ACTUAL_EVENT",
                    new_event.id,
                    "SYSTEM_VERIFIED_AUTO_LINK",
                    None,
                    Some("RUST_TRUST_LAYER"),
                    Some(serde_json::json!({"lifecycle_status": "MATCHED"})),
                    Some(serde_json::json!({
                        "lifecycle_status": "COMMITTED",
                        "verification_status": "SYSTEM_VERIFIED",
                        "activity_code": act.code
                    })),
                    last_hash_lock.as_deref(),
                );
                *last_hash_lock = Some(audit.payload_hash.clone());

                let outbox =
                    EventLedger::create_outbox_event(project_id, "AUTO_LINKED_EVENT", &new_event);
                outbox_store.push(outbox);

                events.push(new_event);
                audit_trail.push(audit);
                auto_committed += 1;
            } else if let (true, Some(act)) =
                (prop_data.match_tier != MatchTier::Unmatched, act_opt)
            {
                let proposal = MatchProposal {
                    id: prop_id,
                    project_id,
                    observation_id: obs_id,
                    activity_id: act.id,
                    candidate_rank: prop_data.candidate_rank,
                    lexical_score: prop_data.lexical_score,
                    semantic_score: prop_data.semantic_score,
                    context_boost: prop_data.context_boost,
                    confidence_score: prop_data.confidence_score,
                    match_tier: prop_data.match_tier,
                    explanation: prop_data.explanation.clone(),
                    evidence_snippet: prop_data.evidence_snippet.clone(),
                    status: "PENDING_REVIEW".to_string(),
                    created_at: Utc::now(),
                };
                prop_list.push(proposal);

                let audit = EventLedger::create_audit_event(
                    project_id,
                    "MATCH_PROPOSAL",
                    prop_id,
                    "CREATE_PROPOSAL_REVIEW_REQUIRED",
                    None,
                    Some("RUST_TRUST_LAYER"),
                    None,
                    Some(serde_json::json!({
                        "status": "PENDING_REVIEW",
                        "confidence_score": prop_data.confidence_score,
                        "match_tier": prop_data.match_tier,
                        "activity_code": act.code
                    })),
                    last_hash_lock.as_deref(),
                );
                *last_hash_lock = Some(audit.payload_hash.clone());
                audit_trail.push(audit);

                review_required += 1;
            } else {
                unmatched += 1;
            }
        } else {
            unmatched += 1;
        }
    }

    let resp = IngestResponse {
        project_id,
        total_ingested: payload.items.len(),
        auto_committed,
        review_required,
        unmatched,
    };

    // Invalidate caches after ingestion
    if let Some(cache) = &state.redis_cache {
        cache.invalidate_project(project_id).await;
    }

    Ok((StatusCode::CREATED, Json(resp)))
}

// =============================================================================
// Export
// =============================================================================

pub async fn export_schedule_p6(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let acts = state.activities.read().await;
    let states = state.activity_states.read().await;
    let projects = state.projects.read().await;

    let project = projects.iter().find(|p| p.id == project_id);
    let project_code = project.map(|p| p.code.as_str()).unwrap_or("PRD-HYD-PKG04");
    let project_name = project
        .map(|p| p.name.as_str())
        .unwrap_or("Paradip-Hyderabad Refinery Expansion - Package 04");

    let now_str = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<APM:Project xmlns:APM=\"http://xmlns.oracle.com/Primavera/P6/V24/APM\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n");
    xml.push_str("  <APM:APMHeader>\n");
    xml.push_str(&format!(
        "    <APM:CreationDate>{}</APM:CreationDate>\n",
        now_str
    ));
    xml.push_str("    <APM:ExportType>PROJECT</APM:ExportType>\n");
    xml.push_str("    <APM:SchemaVersion>24.12.0</APM:SchemaVersion>\n");
    xml.push_str("  </APM:APMHeader>\n");
    xml.push_str(&format!(
        "  <APM:ProjectObjectId>{}</APM:ProjectObjectId>\n",
        project_code
    ));
    xml.push_str(&format!("  <APM:Id>{}</APM:Id>\n", project_code));
    xml.push_str(&format!("  <APM:Name>{}</APM:Name>\n", project_name));
    xml.push_str("  <APM:Activities>\n");

    for a in acts.iter().filter(|a| a.project_id == project_id) {
        let st = states.iter().find(|s| s.activity_id == a.id);
        let progress = st.map(|s| s.current_progress_pct).unwrap_or(0.0);
        let status_str = match st
            .map(|s| s.execution_status)
            .unwrap_or(ExecutionStatus::NotStarted)
        {
            ExecutionStatus::NotStarted => "Not Started",
            ExecutionStatus::InProgress => "In Progress",
            ExecutionStatus::Completed => "Completed",
            ExecutionStatus::Delayed => "In Progress",
            ExecutionStatus::Blocked => "In Progress",
        };
        xml.push_str("    <APM:Activity>\n");
        xml.push_str(&format!("      <APM:ObjectId>{}</APM:ObjectId>\n", a.id));
        xml.push_str(&format!("      <APM:Id>{}</APM:Id>\n", a.code));
        xml.push_str(&format!("      <APM:Name>{}</APM:Name>\n", a.name));
        xml.push_str(&format!(
            "      <APM:PlannedStartDate>{}</APM:PlannedStartDate>\n",
            a.planned_start_date
        ));
        xml.push_str(&format!(
            "      <APM:PlannedFinishDate>{}</APM:PlannedFinishDate>\n",
            a.planned_finish_date
        ));
        xml.push_str(&format!(
            "      <APM:PlannedDuration>{}</APM:PlannedDuration>\n",
            a.planned_duration_days
        ));
        xml.push_str(&format!(
            "      <APM:PercentComplete>{:.2}</APM:PercentComplete>\n",
            progress
        ));
        xml.push_str(&format!("      <APM:Status>{}</APM:Status>\n", status_str));
        if let Some(act_start) = st.and_then(|s| s.actual_start_date) {
            xml.push_str(&format!(
                "      <APM:ActualStartDate>{}</APM:ActualStartDate>\n",
                act_start
            ));
        }
        if let Some(act_finish) = st.and_then(|s| s.actual_finish_date) {
            xml.push_str(&format!(
                "      <APM:ActualFinishDate>{}</APM:ActualFinishDate>\n",
                act_finish
            ));
        }
        xml.push_str("    </APM:Activity>\n");
    }

    xml.push_str("  </APM:Activities>\n</APM:Project>");
    (
        [
            ("Content-Type", "application/xml"),
            (
                "Content-Disposition",
                "attachment; filename=\"schedule_p6.xml\"",
            ),
        ],
        xml,
    )
}
