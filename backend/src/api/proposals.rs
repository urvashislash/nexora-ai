use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::ledger::EventLedger;
use crate::domain::models::*;
use crate::domain::state_machine::StateMachine;
use crate::domain::validation::ValidationEngine;

use super::error::ApiError;
use super::helpers::{
    default_reviewer_id, deserialize_string_or_uuid_vec, empty_string_is_none, parse_uuid_or_derive,
};
use super::middleware::extract_auth_context;
use super::state::AppState;

// =============================================================================
// Decision Payloads
// =============================================================================

#[derive(Deserialize)]
pub struct DecisionPayload {
    #[serde(default)]
    pub reviewer_id: Option<Uuid>,
    #[serde(default)]
    pub reviewed_by: Option<Uuid>,
    pub comments: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default, deserialize_with = "empty_string_is_none")]
    pub selected_activity_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct CommentPayload {
    #[serde(default)]
    pub reviewer_id: Option<Uuid>,
    #[serde(default)]
    pub reviewed_by: Option<Uuid>,
    pub comments: String,
}

#[derive(Deserialize)]
pub struct BatchApprovePayload {
    #[serde(default)]
    pub reviewer_id: Option<Uuid>,
    #[serde(default)]
    pub reviewed_by: Option<Uuid>,
    #[serde(default, deserialize_with = "deserialize_string_or_uuid_vec")]
    pub proposal_ids: Vec<Uuid>,
    pub comments: Option<String>,
}

// =============================================================================
// Approval / Rejection / Override Handlers
// =============================================================================

pub async fn approve_proposal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(proposal_id_raw): Path<String>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let reviewer_id = extract_auth_context(&headers)
        .map(|auth| auth.user_id)
        .or(payload.reviewer_id)
        .or(payload.reviewed_by)
        .unwrap_or_else(default_reviewer_id);

    let proposal_id = parse_uuid_or_derive(&proposal_id_raw);

    // If database is available, execute PostgreSQL transaction
    if let Some(ref db) = state.database {
        let event_id = db
            .approve_proposal_tx(
                proposal_id,
                reviewer_id,
                payload.selected_activity_id,
                payload.comments.clone(),
            )
            .await
            .map_err(|e| {
                tracing::error!("approve_proposal_tx failed: {}", e);
                ApiError::bad_request(format!("Approval failed: {}", e))
            })?;

        return Ok(Json(serde_json::json!({
            "status": "APPROVED",
            "event_id": event_id,
            "proposal_id": proposal_id,
        })));
    }

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
            let projects_guard = state.projects.read().await;
            let default_project = projects_guard
                .first()
                .map(|p| p.id)
                .ok_or_else(|| ApiError::not_found("No projects found in application state"))?;
            let default_act = match payload.selected_activity_id {
                Some(id) => id,
                None => acts.first().map(|a| a.id).ok_or_else(|| {
                    ApiError::not_found("No activities found in application state")
                })?,
            };
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
        created_by: Some(reviewer_id),
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
        reviewed_by: reviewer_id,
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
        Some(reviewer_id),
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
    headers: HeaderMap,
    Path(proposal_id_raw): Path<String>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let reviewer_id = extract_auth_context(&headers)
        .map(|auth| auth.user_id)
        .or(payload.reviewer_id)
        .or(payload.reviewed_by)
        .unwrap_or_else(default_reviewer_id);

    let comments = payload.comments.or(payload.reason);

    let proposal_id = parse_uuid_or_derive(&proposal_id_raw);

    if let Some(db) = &state.database {
        db.reject_proposal_tx(proposal_id, reviewer_id, comments.clone())
            .await
            .map_err(|e| {
                tracing::error!("reject_proposal_tx failed: {}", e);
                ApiError::bad_request(format!("Rejection failed: {}", e))
            })?;

        if let Some(cache) = &state.redis_cache {
            let proposals = state.proposals.read().await;
            if let Some(p) = proposals.iter().find(|p| p.id == proposal_id) {
                cache.invalidate_project(p.project_id).await;
            }
        }
        return Ok(Json(serde_json::json!({
            "status": "REJECTED",
            "proposal_id": proposal_id,
            "message": "Proposal rejected transactionally in PostgreSQL"
        })));
    }

    let mut proposals = state.proposals.write().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut approvals_store = state.approvals.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;
    let acts = state.activities.read().await;

    let project_id = if let Some(p) = proposals.iter_mut().find(|p| p.id == proposal_id) {
        p.status = "REJECTED".to_string();
        p.project_id
    } else {
        let projects_guard = state.projects.read().await;
        let default_project = projects_guard
            .first()
            .map(|p| p.id)
            .ok_or_else(|| ApiError::not_found("No projects found in application state"))?;
        let default_act_id = acts
            .first()
            .map(|a| a.id)
            .ok_or_else(|| ApiError::not_found("No activities found in application state"))?;
        let new_prop = MatchProposal {
            id: proposal_id,
            project_id: default_project,
            observation_id: Uuid::new_v4(),
            activity_id: default_act_id,
            candidate_rank: 1,
            lexical_score: 0.50,
            semantic_score: 0.50,
            context_boost: 0.0,
            confidence_score: 0.50,
            match_tier: MatchTier::Low,
            explanation: Some("Proposal rejected by Lead Planner".to_string()),
            evidence_snippet: comments.clone(),
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
        reviewed_by: reviewer_id,
        reviewed_at: Utc::now(),
        selected_activity_id: None,
        comments: comments.clone(),
        confidence_override: None,
    };
    approvals_store.push(approval);

    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_REJECTION",
        proposal_id,
        "REJECT",
        Some(reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({"status": "PENDING_REVIEW"})),
        Some(serde_json::json!({"status": "REJECTED", "comments": comments})),
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
    headers: HeaderMap,
    Path(proposal_id_raw): Path<String>,
    Json(payload): Json<DecisionPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let reviewer_id = extract_auth_context(&headers)
        .map(|auth| auth.user_id)
        .or(payload.reviewer_id)
        .or(payload.reviewed_by)
        .unwrap_or_else(default_reviewer_id);

    let comments = payload.comments.clone().or_else(|| payload.reason.clone());

    let proposal_id = parse_uuid_or_derive(&proposal_id_raw);
    let selected_activity_id = payload
        .selected_activity_id
        .ok_or_else(|| ApiError::bad_request("selected_activity_id is required for override"))?;

    if let Some(db) = &state.database {
        let event_id = db
            .approve_proposal_tx(
                proposal_id,
                reviewer_id,
                Some(selected_activity_id),
                comments.clone(),
            )
            .await
            .map_err(|e| {
                tracing::error!("approve_proposal_tx (override) failed: {}", e);
                ApiError::bad_request(format!("Override failed: {}", e))
            })?;

        if let Some(cache) = &state.redis_cache {
            let proposals = state.proposals.read().await;
            if let Some(p) = proposals.iter().find(|p| p.id == proposal_id) {
                cache.invalidate_project(p.project_id).await;
            }
        }
        return Ok(Json(serde_json::json!({
            "status": "OVERRIDDEN",
            "proposal_id": proposal_id,
            "event_id": event_id,
            "selected_activity_id": selected_activity_id,
            "message": "Proposal target overridden transactionally in PostgreSQL"
        })));
    }

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
            let projects_guard = state.projects.read().await;
            let default_project = projects_guard
                .first()
                .map(|p| p.id)
                .ok_or_else(|| ApiError::not_found("No projects found in application state"))?;
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
        created_by: Some(reviewer_id),
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
        reviewed_by: reviewer_id,
        reviewed_at: Utc::now(),
        selected_activity_id: Some(selected_activity_id),
        comments: comments.clone(),
        confidence_override: None,
    };
    approvals_store.push(approval);

    // Audit trail
    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_OVERRIDE",
        proposal_id,
        "OVERRIDE_AND_COMMIT",
        Some(reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({
            "status": "PENDING_REVIEW",
            "original_activity_id": original_activity_id
        })),
        Some(serde_json::json!({
            "status": "OVERRIDDEN",
            "selected_activity_id": selected_activity_id,
            "event_id": new_event.id,
            "comments": comments
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
pub async fn add_proposal_comment(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(proposal_id_raw): Path<String>,
    Json(payload): Json<CommentPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let reviewer_id = extract_auth_context(&headers)
        .map(|auth| auth.user_id)
        .or(payload.reviewer_id)
        .or(payload.reviewed_by)
        .unwrap_or_else(default_reviewer_id);

    let proposal_id = parse_uuid_or_derive(&proposal_id_raw);
    let proposals = state.proposals.read().await;
    let mut audit_trail = state.audit_trail.write().await;
    let mut last_hash_lock = state.last_audit_hash.write().await;

    let project_id = if let Some(p) = proposals.iter().find(|p| p.id == proposal_id) {
        p.project_id
    } else {
        let projects_guard = state.projects.read().await;
        projects_guard
            .first()
            .map(|p| p.id)
            .ok_or_else(|| ApiError::not_found("No projects found in application state"))?
    };

    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_COMMENT",
        proposal_id,
        "COMMENT",
        Some(reviewer_id),
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

pub async fn batch_approve_proposals(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BatchApprovePayload>,
) -> Result<impl IntoResponse, ApiError> {
    let reviewer_id = extract_auth_context(&headers)
        .map(|auth| auth.user_id)
        .or(payload.reviewer_id)
        .or(payload.reviewed_by)
        .unwrap_or_else(default_reviewer_id);

    if let Some(db) = &state.database {
        let mut approved_count = 0;
        let mut errors = Vec::new();

        for pid in &payload.proposal_ids {
            match db
                .approve_proposal_tx(*pid, reviewer_id, None, payload.comments.clone())
                .await
            {
                Ok(_) => {
                    approved_count += 1;
                }
                Err(e) => {
                    errors.push(format!("Proposal {}: {}", pid, e));
                }
            }
        }

        return Ok(Json(serde_json::json!({
            "approved_count": approved_count,
            "errors": errors,
        })));
    }

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
            created_by: Some(reviewer_id),
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
            reviewed_by: reviewer_id,
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
            Some(reviewer_id),
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
