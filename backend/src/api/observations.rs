use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::ledger::EventLedger;
use crate::domain::models::*;
use crate::domain::validation::ValidationEngine;

use super::error::ApiError;
use super::helpers::PaginationParams;
use super::state::AppState;

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

/// GET /api/v1/projects/:id/observations — list all observations for a project
pub async fn get_observations(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    let obs = state.observations.read().await;
    let filtered: Vec<WorkObservation> = obs
        .iter()
        .filter(|o| o.project_id == project_id)
        .cloned()
        .collect();
    let paginated = pagination.apply(&filtered);
    Json(paginated)
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

#[derive(serde::Serialize)]
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
                    let _ = crate::domain::state_machine::StateMachine::project_event(
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
