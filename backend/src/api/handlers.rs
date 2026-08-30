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
            Activity {
                id: Uuid::parse_str("d0000000-0000-0000-0000-000000000006").unwrap(),
                project_id,
                schedule_version_id,
                wbs_id,
                code: "MEC-3200".to_string(),
                name: "Pump Alignment and Baseplate Grouting - Crude Charge Pump P-101A".to_string(),
                description: Some(
                    "Mechanical alignment, dial indicator runout check and epoxy grouting".to_string(),
                ),
                discipline: Discipline::Mechanical,
                planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 20).unwrap(),
                planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
                planned_duration_days: 5,
                planned_quantity: Some(1.0),
                unit_of_measure: Some("Units".to_string()),
                location: Some("Pump House 1".to_string()),
                zone: Some("Zone 1".to_string()),
                equipment_tag: Some("P-101A".to_string()),
                weightage: 1.6,
                critical_path: false,
            },
            Activity {
                id: Uuid::parse_str("d0000000-0000-0000-0000-000000000007").unwrap(),
                project_id,
                schedule_version_id,
                wbs_id,
                code: "ELE-4100".to_string(),
                name: "Cable Tray Bracket Mounting and Ladder Traying - Rack B Tier 3".to_string(),
                description: Some(
                    "Electrical cable tray bracket welding and ladder tray installation".to_string(),
                ),
                discipline: Discipline::Electrical,
                planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 22).unwrap(),
                planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
                planned_duration_days: 6,
                planned_quantity: Some(120.0),
                unit_of_measure: Some("M".to_string()),
                location: Some("Pipe Rack B".to_string()),
                zone: Some("Zone 2".to_string()),
                equipment_tag: Some("RACK-B-T3".to_string()),
                weightage: 1.3,
                critical_path: false,
            },
            Activity {
                id: Uuid::parse_str("d0000000-0000-0000-0000-000000000008").unwrap(),
                project_id,
                schedule_version_id,
                wbs_id,
                code: "INS-5100".to_string(),
                name: "Bench Calibration and Impulse Tubing Hookup - Pressure Transmitter PT-101".to_string(),
                description: Some(
                    "5-point calibration and stainless steel 1/2 inch impulse tubing hookup".to_string(),
                ),
                discipline: Discipline::Instrumentation,
                planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
                planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 29).unwrap(),
                planned_duration_days: 4,
                planned_quantity: Some(4.0),
                unit_of_measure: Some("Tags".to_string()),
                location: Some("CDU Area 100".to_string()),
                zone: Some("Zone 1".to_string()),
                equipment_tag: Some("PT-101".to_string()),
                weightage: 1.1,
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

    // Add to audit trail
    let audit = EventLedger::create_audit_event(
        proposal.project_id,
        "PROPOSAL_APPROVAL",
        proposal.id,
        "APPROVE_AND_COMMIT",
        Some(payload.reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({"status": "PENDING_REVIEW"})),
        Some(serde_json::json!({"status": "COMMITTED", "event_id": new_event.id})),
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

    let proposal = proposals
        .iter_mut()
        .find(|p| p.id == proposal_id)
        .ok_or((StatusCode::NOT_FOUND, "Proposal not found".to_string()))?;

    proposal.status = "REJECTED".to_string();

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

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct OverridePayload {
    pub reviewer_id: Uuid,
    pub selected_activity_id: Uuid,
    pub actual_date: Option<NaiveDate>,
    pub actual_progress_pct: Option<f64>,
    pub comments: Option<String>,
}

pub async fn override_proposal(
    State(state): State<AppState>,
    Path(proposal_id): Path<Uuid>,
    Json(payload): Json<OverridePayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut proposals = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let acts = state.activities.read().await;

    let proposal = proposals
        .iter_mut()
        .find(|p| p.id == proposal_id)
        .ok_or((StatusCode::NOT_FOUND, "Proposal not found".to_string()))?;

    let original_activity_id = proposal.activity_id;
    proposal.status = "OVERRIDDEN".to_string();
    proposal.activity_id = payload.selected_activity_id;

    let act = acts
        .iter()
        .find(|a| a.id == payload.selected_activity_id)
        .ok_or((
            StatusCode::NOT_FOUND,
            "Target activity not found".to_string(),
        ))?;

    let actual_date = payload.actual_date.unwrap_or_else(|| Utc::now().date_naive());
    let progress_pct = payload.actual_progress_pct.unwrap_or(100.0);

    ValidationEngine::validate_event_date(actual_date)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    ValidationEngine::validate_progress(Some(progress_pct))
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let new_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id: proposal.project_id,
        activity_id: payload.selected_activity_id,
        observation_id: Some(proposal.observation_id),
        match_proposal_id: Some(proposal.id),
        event_type: if progress_pct >= 100.0 {
            EventType::Finish
        } else {
            EventType::Progress
        },
        actual_date,
        actual_progress_pct: Some(progress_pct),
        actual_quantity: act.planned_quantity,
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: Some(format!(
            "event-override-{}-{}",
            payload.selected_activity_id, actual_date
        )),
        created_by: Some(payload.reviewer_id),
        created_at: Utc::now(),
    };

    if let Some(state_entry) = act_states
        .iter_mut()
        .find(|s| s.activity_id == payload.selected_activity_id)
    {
        StateMachine::project_event(state_entry, &new_event, act.planned_finish_date);
    }

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
            "status": "COMMITTED",
            "event_id": new_event.id,
            "selected_activity_id": payload.selected_activity_id,
            "comments": payload.comments
        })),
        None,
    );

    events.push(new_event.clone());
    audit_trail.push(audit);

    Ok(Json(serde_json::json!({
        "status": "OVERRIDDEN",
        "event_id": new_event.id,
        "activity_code": act.code
    })))
}

#[derive(Deserialize, Clone)]
#[allow(dead_code)]
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
#[allow(dead_code)]
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
#[allow(dead_code)]
pub struct IngestItem {
    pub observation: IngestObservationPayload,
    pub proposal: Option<IngestProposalPayload>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct IngestRequest {
    pub document_id: Option<Uuid>,
    pub items: Vec<IngestItem>,
}

#[derive(Serialize)]
#[allow(dead_code)]
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
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut obs_list = state.observations.write().await;
    let mut prop_list = state.proposals.write().await;
    let mut events = state.events.write().await;
    let mut act_states = state.activity_states.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let acts = state.activities.read().await;

    let mut auto_committed = 0;
    let mut review_required = 0;
    let mut unmatched = 0;

    for item in payload.items {
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

        if let Some(prop_data) = item.proposal {
            let prop_id = Uuid::new_v4();
            let act_opt = acts.iter().find(|a| a.id == prop_data.activity_id);

            if prop_data.auto_link_eligible && act_opt.is_some() {
                let act = act_opt.unwrap();
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
                    StateMachine::project_event(state_entry, &new_event, act.planned_finish_date);
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
                    explanation: prop_data.explanation,
                    evidence_snippet: prop_data.evidence_snippet,
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
                    None,
                );
                events.push(new_event);
                audit_trail.push(audit);
                auto_committed += 1;
            } else if prop_data.match_tier != MatchTier::Unmatched && act_opt.is_some() {
                let act = act_opt.unwrap();
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
                    explanation: prop_data.explanation,
                    evidence_snippet: prop_data.evidence_snippet,
                    status: "PENDING_REVIEW".to_string(),
                    created_at: Utc::now(),
                };
                prop_list.push(proposal);
                review_required += 1;
            } else {
                unmatched += 1;
            }
        } else {
            unmatched += 1;
        }
    }

    Ok(Json(IngestResponse {
        project_id,
        total_ingested: auto_committed + review_required + unmatched,
        auto_committed,
        review_required,
        unmatched,
    }))
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
