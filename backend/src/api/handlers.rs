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

use crate::domain::ledger::EventLedger;
use crate::domain::models::*;
use crate::domain::state_machine::StateMachine;
use crate::domain::validation::ValidationEngine;

#[derive(Clone)]
#[allow(dead_code)]
pub struct AppState {
    pub projects: Arc<RwLock<Vec<Project>>>,
    pub activities: Arc<RwLock<Vec<Activity>>>,
    pub activity_states: Arc<RwLock<Vec<ActivityCurrentState>>>,
    pub observations: Arc<RwLock<Vec<WorkObservation>>>,
    pub proposals: Arc<RwLock<Vec<MatchProposal>>>,
    pub events: Arc<RwLock<Vec<ActualEvent>>>,
    pub audit_trail: Arc<RwLock<Vec<AuditEvent>>>,
    pub approvals: Arc<RwLock<Vec<Approval>>>,
}

impl AppState {
    pub fn new_with_demo_data() -> Self {
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
            audit_trail: Arc::new(RwLock::new(Vec::new())),
            approvals: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

#[derive(Serialize)]
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
    Path(_project_id): Path<Uuid>,
) -> impl IntoResponse {
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

    Json(kpis)
}

pub async fn get_activities(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
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

    Json(combined)
}

pub async fn get_review_queue(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let proposals = state.proposals.read().await;
    let obs = state.observations.read().await;
    let acts = state.activities.read().await;

    #[derive(Serialize)]
    pub struct ReviewItem {
        pub proposal: MatchProposal,
        pub observation: Option<WorkObservation>,
        pub activity: Option<Activity>,
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

    Json(pending)
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct DecisionPayload {
    pub reviewer_id: Uuid,
    pub comments: Option<String>,
    pub selected_activity_id: Option<Uuid>,
}

pub async fn approve_proposal(
    State(state): State<AppState>,
    Path(proposal_id): Path<Uuid>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut proposals = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;
    let acts = state.activities.read().await;

    let proposal = proposals
        .iter_mut()
        .find(|p| p.id == proposal_id)
        .ok_or((StatusCode::NOT_FOUND, "Proposal not found".to_string()))?;

    proposal.status = "ACCEPTED".to_string();

    let target_activity_id = payload.selected_activity_id.unwrap_or(proposal.activity_id);
    let act = acts.iter().find(|a| a.id == target_activity_id).ok_or((
        StatusCode::NOT_FOUND,
        "Target activity not found".to_string(),
    ))?;

    // --- Validation gate: reject future dates and invalid progress ---
    let actual_date = Utc::now().date_naive();
    ValidationEngine::validate_event_date(actual_date)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    ValidationEngine::validate_progress(Some(100.0))
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    // Create official ActualEvent
    let new_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id: proposal.project_id,
        activity_id: target_activity_id,
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
        idempotency_key: Some(format!("event-{}-{}", target_activity_id, actual_date)),
        created_by: Some(payload.reviewer_id),
        created_at: Utc::now(),
    };

    // Project to current state
    if let Some(state_entry) = act_states
        .iter_mut()
        .find(|s| s.activity_id == target_activity_id)
    {
        StateMachine::project_event(state_entry, &new_event, act.planned_finish_date);
    }

    // Create Approval record
    let approval = Approval {
        id: Uuid::new_v4(),
        project_id: proposal.project_id,
        event_id: Some(new_event.id),
        proposal_id: Some(proposal.id),
        action: "APPROVE".to_string(),
        reviewed_by: payload.reviewer_id,
        reviewed_at: Utc::now(),
        selected_activity_id: payload.selected_activity_id,
        comments: payload.comments.clone(),
        confidence_override: None,
    };
    approvals_store.push(approval);

    // Add to audit trail
    let audit = EventLedger::create_audit_event(
        proposal.project_id,
        "PROPOSAL_APPROVAL",
        proposal.id,
        "APPROVE_AND_COMMIT",
        Some(payload.reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({"status": "PENDING_REVIEW"})),
        Some(serde_json::json!({"status": "COMMITTED", "event_id": new_event.id, "comments": payload.comments})),
        None,
    );

    // Create outbox event for async delivery to external systems (PMIS / P6)
    let _outbox =
        EventLedger::create_outbox_event(proposal.project_id, "PROPOSAL_APPROVED", &new_event);

    events.push(new_event.clone());
    audit_trail.push(audit);

    Ok(Json(serde_json::json!({
        "status": "APPROVED",
        "event_id": new_event.id,
        "activity_code": act.code
    })))
}

pub async fn reject_proposal(
    State(state): State<AppState>,
    Path(proposal_id): Path<Uuid>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut proposals = state.proposals.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;

    let proposal = proposals
        .iter_mut()
        .find(|p| p.id == proposal_id)
        .ok_or((StatusCode::NOT_FOUND, "Proposal not found".to_string()))?;

    proposal.status = "REJECTED".to_string();

    // Create Approval record for the rejection
    let approval = Approval {
        id: Uuid::new_v4(),
        project_id: proposal.project_id,
        event_id: None,
        proposal_id: Some(proposal.id),
        action: "REJECT".to_string(),
        reviewed_by: payload.reviewer_id,
        reviewed_at: Utc::now(),
        selected_activity_id: None,
        comments: payload.comments.clone(),
        confidence_override: None,
    };
    approvals_store.push(approval);

    let audit = EventLedger::create_audit_event(
        proposal.project_id,
        "PROPOSAL_REJECTION",
        proposal.id,
        "REJECT",
        Some(payload.reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({"status": "PENDING_REVIEW"})),
        Some(serde_json::json!({"status": "REJECTED", "comments": payload.comments})),
        None,
    );
    audit_trail.push(audit);

    Ok(Json(
        serde_json::json!({"status": "REJECTED", "proposal_id": proposal_id}),
    ))
}

/// Override a proposal — planner selects a different target activity
pub async fn override_proposal(
    State(state): State<AppState>,
    Path(proposal_id): Path<Uuid>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let selected_activity_id = payload.selected_activity_id.ok_or((
        StatusCode::BAD_REQUEST,
        "selected_activity_id is required for override".to_string(),
    ))?;

    let mut proposals = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;
    let acts = state.activities.read().await;

    let proposal = proposals
        .iter_mut()
        .find(|p| p.id == proposal_id)
        .ok_or((StatusCode::NOT_FOUND, "Proposal not found".to_string()))?;

    let original_activity_id = proposal.activity_id;
    proposal.status = "OVERRIDDEN".to_string();

    // Validate that the override target activity exists and belongs to the same project
    let act = acts
        .iter()
        .find(|a| a.id == selected_activity_id && a.project_id == proposal.project_id)
        .ok_or((
            StatusCode::NOT_FOUND,
            "Override target activity not found in this project".to_string(),
        ))?;

    let actual_date = Utc::now().date_naive();
    ValidationEngine::validate_event_date(actual_date)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    // Create ActualEvent linked to the overridden activity
    let new_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id: proposal.project_id,
        activity_id: selected_activity_id,
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
        idempotency_key: Some(format!("override-{}-{}", selected_activity_id, actual_date)),
        created_by: Some(payload.reviewer_id),
        created_at: Utc::now(),
    };

    // Project to current state
    if let Some(state_entry) = act_states
        .iter_mut()
        .find(|s| s.activity_id == selected_activity_id)
    {
        StateMachine::project_event(state_entry, &new_event, act.planned_finish_date);
    }

    // Create Approval record with OVERRIDE action
    let approval = Approval {
        id: Uuid::new_v4(),
        project_id: proposal.project_id,
        event_id: Some(new_event.id),
        proposal_id: Some(proposal.id),
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
        proposal.project_id,
        "PROPOSAL_OVERRIDE",
        proposal.id,
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
        None,
    );

    let _outbox =
        EventLedger::create_outbox_event(proposal.project_id, "PROPOSAL_OVERRIDDEN", &new_event);

    events.push(new_event.clone());
    audit_trail.push(audit);

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
#[allow(dead_code)]
pub struct CommentPayload {
    pub reviewer_id: Uuid,
    pub comments: String,
}

pub async fn add_proposal_comment(
    State(state): State<AppState>,
    Path(proposal_id): Path<Uuid>,
    Json(payload): Json<CommentPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let proposals = state.proposals.read().await;
    let mut audit_trail = state.audit_trail.write().await;

    let proposal = proposals
        .iter()
        .find(|p| p.id == proposal_id)
        .ok_or((StatusCode::NOT_FOUND, "Proposal not found".to_string()))?;

    let audit = EventLedger::create_audit_event(
        proposal.project_id,
        "PROPOSAL_COMMENT",
        proposal.id,
        "COMMENT",
        Some(payload.reviewer_id),
        Some("PLANNER"),
        None,
        Some(serde_json::json!({"comments": payload.comments})),
        None,
    );
    audit_trail.push(audit);

    Ok(Json(
        serde_json::json!({"status": "COMMENT_ADDED", "proposal_id": proposal_id}),
    ))
}

/// Batch approve multiple proposals
#[derive(Deserialize)]
#[allow(dead_code)]
pub struct BatchApprovePayload {
    pub reviewer_id: Uuid,
    pub proposal_ids: Vec<Uuid>,
    pub comments: Option<String>,
}

pub async fn batch_approve_proposals(
    State(state): State<AppState>,
    Json(payload): Json<BatchApprovePayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut proposals = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;
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
            StateMachine::project_event(state_entry, &new_event, act.planned_finish_date);
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
            None,
        );

        results.push(serde_json::json!({
            "proposal_id": pid,
            "status": "APPROVED",
            "event_id": new_event.id,
            "activity_code": act.code
        }));

        events.push(new_event);
        audit_trail.push(audit);
    }

    Ok(Json(serde_json::json!({
        "batch_size": payload.proposal_ids.len(),
        "results": results
    })))
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

pub async fn export_schedule_p6(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let acts = state.activities.read().await;
    let states = state.activity_states.read().await;

    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<APBO:Project xmlns:APBO=\"http://xmlns.oracle.com/Primavera/P6/V24\">\n");
    xml.push_str("  <ProjectObjectId>PRD-HYD-PKG04</ProjectObjectId>\n  <Activities>\n");

    for a in acts.iter().filter(|a| a.project_id == project_id) {
        let st = states.iter().find(|s| s.activity_id == a.id);
        let progress = st.map(|s| s.current_progress_pct).unwrap_or(0.0);
        let status_str = st
            .map(|s| format!("{:?}", s.execution_status))
            .unwrap_or("NotStarted".to_string());
        xml.push_str(&format!(
            "    <Activity Id=\"{}\" Name=\"{}\" PlannedStart=\"{}\" PlannedFinish=\"{}\" ProgressPct=\"{}\" Status=\"{}\" />\n",
            a.code, a.name, a.planned_start_date, a.planned_finish_date, progress, status_str
        ));
    }

    xml.push_str("  </Activities>\n</APBO:Project>");
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

