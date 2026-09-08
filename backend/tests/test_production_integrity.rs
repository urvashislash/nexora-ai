use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use serde_json::json;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use backend::api::handlers::AppState;
use backend::api::middleware::{extract_client_key, generate_signed_jwt, get_jwt_secret};
use backend::api::routes::create_router;
use backend::domain::models::*;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_readiness_fails_503_when_database_is_none() {
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/readiness")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["status"], "not_ready");
    assert_eq!(json["dependencies"]["database"], "not_configured");
}

#[tokio::test]
async fn test_rate_limiter_extract_client_key_ignores_spoofed_x_user_id() {
    let spoofed_req = Request::builder()
        .header("x-user-id", "attacker-admin-id")
        .header("x-forwarded-for", "203.0.113.195")
        .body(Body::empty())
        .unwrap();

    let client_key = extract_client_key(spoofed_req.headers());
    // Must be keyed by IP, NOT spoofed user header!
    assert_eq!(client_key, "ip:203.0.113.195");
    assert!(!client_key.contains("attacker-admin-id"));
}

#[tokio::test]
async fn test_rate_limiter_extract_client_key_uses_verified_jwt_user_id() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let user_id = Uuid::new_v4();
    let token = generate_signed_jwt(user_id, "PLANNER", 3600).unwrap();

    let auth_req = Request::builder()
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header("x-user-id", "fake-spoofed-id")
        .body(Body::empty())
        .unwrap();

    let client_key = extract_client_key(auth_req.headers());
    // Must be keyed by the verified JWT user_id, not the spoofed header
    assert_eq!(client_key, format!("user:{}", user_id));
}

#[tokio::test]
async fn test_cors_preflight_does_not_permit_x_user_id() {
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let preflight_req = Request::builder()
        .method("OPTIONS")
        .uri("/api/v1/projects")
        .header("Origin", "http://localhost:5173")
        .header("Access-Control-Request-Method", "POST")
        .header(
            "Access-Control-Request-Headers",
            "authorization, content-type, x-user-id",
        )
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(preflight_req).await.unwrap();

    let allow_headers = response
        .headers()
        .get("access-control-allow-headers")
        .map(|h| h.to_str().unwrap_or_default())
        .unwrap_or_default();

    assert!(
        !allow_headers.to_lowercase().contains("x-user-id"),
        "CORS allow_headers must NOT permit x-user-id header"
    );
    assert!(
        !allow_headers.to_lowercase().contains("x-user-role"),
        "CORS allow_headers must NOT permit x-user-role header"
    );
}

#[tokio::test]
async fn test_actor_identity_enforced_from_jwt_in_proposal_approval() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let project_id = Uuid::new_v4();
    let observation_id = Uuid::new_v4();
    let activity_id = Uuid::new_v4();
    let proposal_id = Uuid::new_v4();

    // Populate in-memory proposal and activity for offline unit test mode
    {
        let mut proposals = state.proposals.write().await;
        proposals.push(MatchProposal {
            id: proposal_id,
            project_id,
            observation_id,
            activity_id,
            candidate_rank: 1,
            lexical_score: 0.9,
            semantic_score: 0.9,
            context_boost: 0.1,
            confidence_score: 0.95,
            match_tier: MatchTier::High,
            explanation: Some("High confidence match".into()),
            evidence_snippet: None,
            status: "PENDING_REVIEW".into(),
            created_at: chrono::Utc::now(),
        });

        let mut activities = state.activities.write().await;
        activities.push(Activity {
            id: activity_id,
            project_id,
            schedule_version_id: Uuid::new_v4(),
            wbs_id: Uuid::new_v4(),
            code: "ACT-01".into(),
            name: "Test Activity".into(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: chrono::Utc::now().date_naive(),
            planned_finish_date: chrono::Utc::now().date_naive(),
            planned_duration_days: 10,
            planned_quantity: Some(100.0),
            unit_of_measure: Some("M3".into()),
            location: None,
            zone: None,
            equipment_tag: None,
            weightage: 1.0,
            critical_path: false,
        });

        let mut states = state.activity_states.write().await;
        states.push(ActivityCurrentState {
            activity_id,
            project_id,
            execution_status: ExecutionStatus::NotStarted,
            actual_start_date: None,
            actual_finish_date: None,
            current_progress_pct: 0.0,
            cumulative_quantity: 0.0,
            last_event_id: None,
            last_event_date: None,
            is_critical_path_delayed: false,
            variance_days: 0,
            updated_at: chrono::Utc::now(),
        });
    }

    let legitimate_planner_id = Uuid::new_v4();
    let planner_token = generate_signed_jwt(legitimate_planner_id, "PLANNER", 3600).unwrap();

    let app = create_router(state.clone());

    // Send request with deceptive reviewer_id and reviewed_by in body
    let deceptive_body = json!({
        "comments": "Approving work",
        "reviewer_id": "00000000-0000-0000-0000-000000000001",
        "reviewed_by": "00000000-0000-0000-0000-000000000001"
    });

    let approve_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/approve", proposal_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", planner_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&deceptive_body).unwrap()))
        .unwrap();

    let response = app.oneshot(approve_req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    // Verify in audit trail that the actor is legitimate_planner_id, NOT the spoofed one in the body
    let audit_trail = state.audit_trail.read().await;
    let approval_audit = audit_trail
        .iter()
        .find(|a| a.action == "APPROVE_AND_COMMIT")
        .expect("Approval audit entry must exist");

    assert_eq!(
        approval_audit.actor_id,
        Some(legitimate_planner_id),
        "Audit record must derive actor strictly from verified JWT, ignoring client body"
    );
}

#[tokio::test]
async fn test_ingest_observations_disallows_client_supplied_auto_link() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let project_id = Uuid::new_v4();
    let activity_id = Uuid::new_v4();

    {
        let mut activities = state.activities.write().await;
        activities.push(Activity {
            id: activity_id,
            project_id,
            schedule_version_id: Uuid::new_v4(),
            wbs_id: Uuid::new_v4(),
            code: "ACT-01".into(),
            name: "Test Activity".into(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: chrono::Utc::now().date_naive(),
            planned_finish_date: chrono::Utc::now().date_naive(),
            planned_duration_days: 10,
            planned_quantity: Some(100.0),
            unit_of_measure: Some("M3".into()),
            location: None,
            zone: None,
            equipment_tag: None,
            weightage: 1.0,
            critical_path: false,
        });
    }

    let planner_id = Uuid::new_v4();
    let token = generate_signed_jwt(planner_id, "PLANNER", 3600).unwrap();

    let app = create_router(state.clone());

    // Client attempts to claim auto_link_eligible with 0.99 confidence
    let malicious_payload = json!({
        "items": [
            {
                "observation": {
                    "raw_text": "Completed concrete pouring zone A"
                },
                "proposal": {
                    "activity_id": activity_id,
                    "candidate_rank": 1,
                    "lexical_score": 0.99,
                    "semantic_score": 0.99,
                    "context_boost": 0.1,
                    "confidence_score": 0.99,
                    "match_tier": "HIGH",
                    "auto_link_eligible": true
                }
            }
        ]
    });

    let ingest_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/ingest", project_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&malicious_payload).unwrap()))
        .unwrap();

    let response = app.oneshot(ingest_req).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp_json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

    // Must be forced to review_required, and 0 auto_committed!
    assert_eq!(
        resp_json["auto_committed"], 0,
        "Zero events must be auto-linked from client ingestion"
    );
    assert_eq!(
        resp_json["review_required"], 1,
        "Client proposal must be forced to review_required"
    );

    let proposals = state.proposals.read().await;
    assert_eq!(proposals.len(), 1);
    assert_eq!(
        proposals[0].status, "PENDING_REVIEW",
        "Client cannot self-grant AUTO_LINK authority"
    );
}

#[tokio::test]
async fn test_clean_app_state_has_zero_seed_entities() {
    let state = AppState::empty(None, None, None);
    assert!(state.projects.read().await.is_empty());
    assert!(state.activities.read().await.is_empty());
    assert!(state.observations.read().await.is_empty());
    assert!(state.proposals.read().await.is_empty());
    assert!(state.events.read().await.is_empty());
    assert!(state.audit_trail.read().await.is_empty());
}

#[tokio::test]
async fn test_production_environment_fails_fast_on_missing_jwt_secret() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let orig_env = std::env::var("APP_ENV").ok();
    let orig_secret = std::env::var("JWT_SECRET").ok();
    let orig_supabase = std::env::var("SUPABASE_JWT_SECRET").ok();

    std::env::set_var("APP_ENV", "production");
    std::env::remove_var("JWT_SECRET");
    std::env::remove_var("SUPABASE_JWT_SECRET");

    let result = std::panic::catch_unwind(|| {
        get_jwt_secret();
    });

    // Restore env immediately
    if let Some(env) = orig_env {
        std::env::set_var("APP_ENV", env);
    } else {
        std::env::remove_var("APP_ENV");
    }
    if let Some(s) = orig_secret {
        std::env::set_var("JWT_SECRET", s);
    } else {
        std::env::remove_var("JWT_SECRET");
    }
    if let Some(s) = orig_supabase {
        std::env::set_var("SUPABASE_JWT_SECRET", s);
    } else {
        std::env::remove_var("SUPABASE_JWT_SECRET");
    }

    assert!(
        result.is_err(),
        "Must panic when JWT_SECRET is missing in production"
    );
}
