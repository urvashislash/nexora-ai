use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::ledger::EventLedger;
use crate::domain::models::*;

use super::error::ApiError;
use super::helpers::PaginationParams;
use super::state::AppState;

// =============================================================================
// Audit Trail Handlers
// =============================================================================

pub async fn get_audit_trail(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    if let Some(ref db) = state.database {
        let limit = pagination.limit.unwrap_or(50) as i64;
        let page = pagination.page.unwrap_or(1).max(1) as i64;
        let offset = (page - 1) * limit;
        match db.list_audit_trail(project_id, limit, offset).await {
            Ok(db_trail) => {
                let paginated = pagination.apply(&db_trail);
                return (axum::http::StatusCode::OK, Json(paginated)).into_response();
            }
            Err(e) => {
                tracing::error!("Failed to query DB audit trail: {}", e);
                return (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": "Database query failed",
                        "details": e.to_string()
                    })),
                )
                    .into_response();
            }
        }
    }

    let trail = state.audit_trail.read().await;
    let filtered: Vec<AuditEvent> = trail
        .iter()
        .filter(|a| a.project_id == project_id)
        .cloned()
        .collect();
    let paginated = pagination.apply(&filtered);
    (axum::http::StatusCode::OK, Json(paginated)).into_response()
}

pub async fn verify_audit_chain(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    if let Some(ref db) = state.database {
        match db.verify_audit_chain(project_id).await {
            Ok((valid, total, broken_idx)) => {
                if valid {
                    return (
                        axum::http::StatusCode::OK,
                        Json(serde_json::json!({
                            "valid": true,
                            "total_events": total,
                            "verified_count": total,
                            "message": "Audit chain integrity fully verified against PostgreSQL"
                        })),
                    )
                        .into_response();
                } else {
                    return (
                        axum::http::StatusCode::OK,
                        Json(serde_json::json!({
                            "valid": false,
                            "total_events": total,
                            "verified_count": broken_idx.unwrap_or(0),
                            "broken_at_index": broken_idx,
                            "message": format!(
                                "Audit chain verification failed at event index {}",
                                broken_idx.unwrap_or(0)
                            )
                        })),
                    )
                        .into_response();
                }
            }
            Err(e) => {
                tracing::error!("Failed to verify DB audit chain: {}", e);
                return (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "valid": false,
                        "error": "Failed to verify audit chain against database",
                        "details": e.to_string()
                    })),
                )
                    .into_response();
            }
        }
    }

    let trail = state.audit_trail.read().await;
    let filtered: Vec<AuditEvent> = trail
        .iter()
        .filter(|a| a.project_id == project_id)
        .cloned()
        .collect();

    let result = EventLedger::verify_chain_integrity(&filtered);
    match result {
        Ok(()) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "valid": true,
                "total_events": filtered.len(),
                "verified_count": filtered.len(),
                "message": "Audit chain integrity fully verified"
            })),
        )
            .into_response(),
        Err(broken_idx) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "valid": false,
                "total_events": filtered.len(),
                "verified_count": broken_idx,
                "broken_at_index": broken_idx,
                "message": format!("Audit chain verification failed at event index {}", broken_idx)
            })),
        )
            .into_response(),
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
