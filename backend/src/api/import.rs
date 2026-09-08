// =============================================================================
// Schedule Import API (Primavera P6, MS Project, CSV Baseline Schedules)
// =============================================================================

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::api::error::ApiError;
use crate::api::helpers::parse_uuid_or_derive;
use crate::api::middleware::extract_auth_context;
use crate::api::state::AppState;
use crate::domain::models::*;
use crate::domain::validation::ValidationEngine;

/// POST /api/v1/projects/:id/import/preview
/// Validates incoming baseline schedule data without committing to database.
pub async fn preview_schedule_import(
    State(_state): State<AppState>,
    Path(project_id_raw): Path<String>,
    Json(payload): Json<ScheduleImportInput>,
) -> Result<impl IntoResponse, ApiError> {
    let project_id = parse_uuid_or_derive(&project_id_raw);

    let mut validation_errors = Vec::new();
    let mut validation_warnings = Vec::new();

    if payload.activities.is_empty() {
        validation_errors.push("Payload contains no activities".to_string());
    }

    // Convert inputs into domain activities for validation
    let mut dummy_activities = Vec::new();
    let mut code_to_id = HashMap::new();
    let mut disciplines_set = HashSet::new();

    for a in &payload.activities {
        let act_id = Uuid::new_v4();
        code_to_id.insert(a.code.clone(), act_id);
        disciplines_set.insert(format!("{:?}", a.discipline).to_uppercase());

        let duration = (a.planned_finish_date - a.planned_start_date).num_days().max(0) as i32;

        dummy_activities.push(Activity {
            id: act_id,
            project_id,
            schedule_version_id: Uuid::nil(),
            wbs_id: Uuid::nil(),
            code: a.code.clone(),
            name: a.name.clone(),
            description: a.description.clone(),
            discipline: a.discipline,
            planned_start_date: a.planned_start_date,
            planned_finish_date: a.planned_finish_date,
            planned_duration_days: duration,
            planned_quantity: a.planned_quantity,
            unit_of_measure: a.unit_of_measure.clone(),
            location: a.location.clone(),
            zone: a.zone.clone(),
            equipment_tag: None,
            weightage: a.weightage.unwrap_or(1.0),
            critical_path: a.critical_path.unwrap_or(false),
        });
    }

    // Validate activities
    if let Err(err) = ValidationEngine::validate_p6_baseline_activities(&dummy_activities) {
        validation_errors.push(format!("Activity validation error: {}", err));
    }

    // Validate dependencies if provided
    let mut dummy_dependencies = Vec::new();
    if let Some(ref deps) = payload.dependencies {
        for dep in deps {
            let pred_id = code_to_id.get(&dep.predecessor_code);
            let succ_id = code_to_id.get(&dep.successor_code);

            match (pred_id, succ_id) {
                (Some(&p), Some(&s)) => {
                    dummy_dependencies.push(ActivityDependency {
                        id: Uuid::new_v4(),
                        schedule_version_id: Uuid::nil(),
                        predecessor_id: p,
                        successor_id: s,
                        dependency_type: DependencyType::Fs,
                        lag_days: dep.lag_days.unwrap_or(0),
                    });
                }
                (None, _) => {
                    validation_warnings.push(format!(
                        "Predecessor code '{}' not found in activities",
                        dep.predecessor_code
                    ));
                }
                (_, None) => {
                    validation_warnings.push(format!(
                        "Successor code '{}' not found in activities",
                        dep.successor_code
                    ));
                }
            }
        }

        if let Err(err) =
            ValidationEngine::validate_p6_schedule_network(&dummy_activities, &dummy_dependencies)
        {
            validation_errors.push(format!("Schedule network error: {}", err));
        }
    }

    let earliest_start_date = dummy_activities
        .iter()
        .map(|a| a.planned_start_date)
        .min();
    let latest_finish_date = dummy_activities
        .iter()
        .map(|a| a.planned_finish_date)
        .max();
    let critical_path_count = dummy_activities.iter().filter(|a| a.critical_path).count();

    let sample_activities = payload.activities.iter().take(5).cloned().collect();
    let disciplines = disciplines_set.into_iter().collect();

    let preview = ScheduleImportPreview {
        version_label: payload.version_label,
        total_activities: payload.activities.len(),
        total_dependencies: dummy_dependencies.len(),
        earliest_start_date,
        latest_finish_date,
        critical_path_count,
        disciplines,
        sample_activities,
        validation_errors,
        validation_warnings,
    };

    Ok(Json(preview))
}

/// POST /api/v1/projects/:id/import/commit
/// Validates and commits the imported schedule version into PostgreSQL.
pub async fn commit_schedule_import(
    State(state): State<AppState>,
    Path(project_id_raw): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<ScheduleImportInput>,
) -> Result<impl IntoResponse, ApiError> {
    let project_id = parse_uuid_or_derive(&project_id_raw);
    let auth = extract_auth_context(&headers);
    let actor_id = auth.as_ref().map(|a| a.user_id);
    let actor_role = auth.as_ref().map(|a| format!("{:?}", a.role));

    if payload.activities.is_empty() {
        return Err(ApiError::bad_request("Activities list cannot be empty"));
    }

    if let Some(ref db) = state.database {
        let (version_id, count) = db
            .commit_schedule_version_tx(project_id, payload, actor_id, actor_role.as_deref())
            .await
            .map_err(|e| ApiError::internal(format!("Failed to commit schedule version: {}", e)))?;

        return Ok((
            StatusCode::CREATED,
            Json(serde_json::json!({
                "status": "COMMITTED",
                "project_id": project_id,
                "schedule_version_id": version_id,
                "activities_imported": count,
            })),
        ));
    }

    // In-memory fallback
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "status": "COMMITTED_IN_MEMORY",
            "project_id": project_id,
            "schedule_version_id": Uuid::new_v4(),
            "activities_imported": payload.activities.len(),
        })),
    ))
}
