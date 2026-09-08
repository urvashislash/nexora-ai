use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use chrono::Utc;
use serde_json::json;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use backend::api::handlers::AppState;
use backend::api::middleware::generate_signed_jwt;
use backend::api::routes::create_router;
use backend::domain::validation::ValidationEngine;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_failure_injection_malicious_sql_injection_payload() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let admin_id = Uuid::new_v4();
    let admin_token = generate_signed_jwt(admin_id, "ADMIN", 3600).unwrap();

    // Malicious SQL injection in project code and description
    let sqli_payload = json!({
        "code": "PROJ'; DROP TABLE projects; --",
        "name": "Injection Test Project",
        "description": "'; DELETE FROM audit_events WHERE 1=1; --"
    });

    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/projects")
        .header(header::AUTHORIZATION, format!("Bearer {}", admin_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(sqli_payload.to_string()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    // System must either create safely parameterized entity or reject with validation error, NEVER crash or execute SQL
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(resp["code"], "PROJ'; DROP TABLE PROJECTS; --");
}

#[tokio::test]
async fn test_failure_injection_corrupt_floats_and_overflows() {
    // 1. NaN and Infinity in progress
    assert!(ValidationEngine::validate_progress(Some(f64::NAN)).is_err());
    assert!(ValidationEngine::validate_progress(Some(f64::INFINITY)).is_err());
    assert!(ValidationEngine::validate_progress(Some(f64::NEG_INFINITY)).is_err());

    // 2. Negative progress
    assert!(ValidationEngine::validate_progress(Some(-0.01)).is_err());

    // 3. Progress > 100%
    assert!(ValidationEngine::validate_progress(Some(100.001)).is_err());
}

#[tokio::test]
async fn test_failure_injection_rabbitmq_outage_does_not_block_document_ingestion() {
    let _guard = TEST_ENV_LOCK.lock().await;
    // AppState with rabbit_publisher = None (simulating RabbitMQ outage or unconfigured)
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let project_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let engineer_token = generate_signed_jwt(user_id, "ENGINEER", 3600).unwrap();

    let doc_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/documents", project_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", engineer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "filename": "critical_inspection.pdf",
                "size_bytes": 2048,
                "text_content": "Pier 14 concrete poured to grade",
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.oneshot(doc_req).await.unwrap();
    // Ingestion succeeds gracefully with job QUEUED; does not 500 panic due to RabbitMQ absence
    assert_eq!(res.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(resp["status"], "QUEUED");
    assert!(resp["job"]["id"].as_str().is_some());
}

#[tokio::test]
async fn test_failure_injection_invalid_date_sequence_transaction_guard() {
    let today = Utc::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);

    // Finish date strictly before start date must be rejected
    let res = ValidationEngine::validate_date_sequence(Some(today), Some(yesterday));
    assert!(res.is_err());
    assert!(res
        .unwrap_err()
        .to_string()
        .contains("cannot be before start date"));

    // Future event beyond tolerance must be rejected
    let far_future = today + chrono::Duration::days(30);
    let date_check = ValidationEngine::validate_event_date(far_future);
    assert!(date_check.is_err());
}
