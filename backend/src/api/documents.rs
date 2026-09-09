use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::api::error::ApiError;
use crate::api::middleware::extract_auth_context;
use crate::api::state::AppState;
use crate::domain::models::*;
use crate::messaging::publisher::ProcessDocumentJob;

/// POST /api/v1/projects/:id/documents
/// Ingests a new evidence document, creates a durable processing job in PostgreSQL,
/// and enqueues it to RabbitMQ for AI worker processing.
pub async fn create_document(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Json(input): Json<DocumentCreateInput>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers);
    let uploaded_by = auth.as_ref().map(|a| a.user_id);

    if input.filename.trim().is_empty() {
        return Err(ApiError::bad_request("filename cannot be empty"));
    }

    let (doc, job) = if let Some(db) = &state.database {
        db.create_document_and_job(project_id, &input, uploaded_by)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to record document: {}", e)))?
    } else {
        if state.require_database {
            return Err(ApiError::service_unavailable(
                "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
            ));
        }

        // In-memory fallback
        let doc_id = Uuid::new_v4();
        let job_id = Uuid::new_v4();
        let now = Utc::now();
        let mime = input
            .mime_type
            .clone()
            .unwrap_or_else(|| "application/octet-stream".to_string());
        let storage_key = input.storage_key.clone().unwrap_or_else(|| {
            format!(
                "{}/reports/{}_{}",
                project_id,
                now.timestamp(),
                input.filename
            )
        });
        let storage_bucket = input
            .storage_bucket
            .clone()
            .unwrap_or_else(|| "evidence-documents".to_string());

        let doc = Document {
            id: doc_id,
            project_id,
            filename: input.filename.clone(),
            mime_type: mime,
            size_bytes: input.size_bytes,
            storage_bucket,
            storage_key,
            checksum_sha256: input.checksum_sha256.clone(),
            source_type: input
                .source_type
                .clone()
                .unwrap_or_else(|| "DAILY_REPORT".to_string()),
            classification: "INTERNAL".to_string(),
            uploaded_by: None,
            uploaded_at: now,
            processing_status: "QUEUED".to_string(),
        };

        let job = DocumentJob {
            id: job_id,
            document_id: doc_id,
            job_type: "EXTRACT".to_string(),
            status: "QUEUED".to_string(),
            attempt_count: 0,
            max_attempts: 3,
            error_code: None,
            error_message: None,
            created_at: now,
            started_at: None,
            completed_at: None,
        };

        (doc, job)
    };

    // If RabbitMQ is online, dispatch job payload
    if let Some(publisher) = &state.rabbit_publisher {
        let acts_guard = state.activities.read().await;
        let activities_val =
            serde_json::to_value(&*acts_guard).unwrap_or_else(|_| serde_json::json!([]));

        let process_job = ProcessDocumentJob {
            job_id: job.id,
            correlation_id: job.id.to_string(),
            project_id,
            document_id: doc.id,
            text_content: input.text_content,
            content_base64: input.content_base64,
            storage_key: Some(doc.storage_key.clone()),
            storage_bucket: Some(doc.storage_bucket.clone()),
            filename: Some(doc.filename.clone()),
            mime_type: Some(doc.mime_type.clone()),
            source_type: doc.source_type.clone(),
            attempt: 1,
            activities: activities_val,
        };

        if let Err(e) = publisher.publish_document_job(&process_job).await {
            tracing::warn!("Failed to publish document job to RabbitMQ: {}", e);
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "document": doc,
            "job": job,
            "status": "QUEUED",
            "message": "Document registered and durable extraction job queued"
        })),
    ))
}

/// GET /api/v1/projects/:id/documents
/// Lists all evidence documents registered for a project.
pub async fn list_documents(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    if let Some(db) = &state.database {
        let docs = db
            .list_documents(project_id)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to list documents: {}", e)))?;
        return Ok(Json(serde_json::json!({ "documents": docs })));
    }

    Ok(Json(serde_json::json!({ "documents": [] })))
}

/// GET /api/v1/jobs/:id
/// Fetches the status and metadata of a durable document processing job.
pub async fn get_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers).ok_or_else(|| {
        ApiError::unauthorized(
            "Missing, expired, or cryptographically invalid authentication token",
        )
    })?;

    if let Some(db) = &state.database {
        let (job, project_id) = db
            .get_document_job_with_project(job_id)
            .await
            .map_err(|_| ApiError::not_found("Job not found"))?;

        match db.verify_project_membership(project_id, auth.user_id).await {
            Ok(Some(_)) => {}
            Ok(None) => {
                return Err(ApiError::forbidden(
                    "User is not an active member of the project owning this job",
                ));
            }
            Err(e) => {
                return Err(ApiError::internal(format!(
                    "Membership verification failed: {}",
                    e
                )));
            }
        }

        return Ok(Json(serde_json::json!({ "job": job })));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    // Default mock response if running without PostgreSQL
    Ok(Json(serde_json::json!({
        "job": {
            "id": job_id,
            "status": "COMPLETED",
            "attempt_count": 1,
            "max_attempts": 3
        }
    })))
}
