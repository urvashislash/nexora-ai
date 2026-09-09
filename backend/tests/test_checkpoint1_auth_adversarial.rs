use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde_json::json;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use backend::api::handlers::AppState;
use backend::api::middleware::{generate_signed_jwt, JwtClaims};
use backend::api::routes::create_router;
use backend::domain::models::*;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_forged_jwt_with_wrong_secret_is_rejected() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let user_id = Uuid::new_v4();
    let claims = JwtClaims {
        sub: user_id.to_string(),
        role: Some("ADMIN".to_string()),
        email: Some("attacker@evil.com".to_string()),
        exp: (chrono::Utc::now().timestamp() + 3600) as usize,
        user_metadata: None,
    };

    // Sign with attacker's custom secret
    let forged_token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"attacker-private-secret-key-1234567890"),
    )
    .unwrap();

    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/projects")
        .header(header::AUTHORIZATION, format!("Bearer {}", forged_token))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(
        res.status(),
        StatusCode::UNAUTHORIZED,
        "Forged JWT signed with incorrect secret must be rejected with 401"
    );
}

#[tokio::test]
async fn test_expired_jwt_is_rejected() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let user_id = Uuid::new_v4();
    // Token expired 120 seconds ago
    let expired_token = generate_signed_jwt(user_id, "ADMIN", -120).unwrap();

    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/projects")
        .header(header::AUTHORIZATION, format!("Bearer {}", expired_token))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(
        res.status(),
        StatusCode::UNAUTHORIZED,
        "Expired JWT must be rejected with 401"
    );
}

#[tokio::test]
async fn test_malformed_jwt_tokens_are_rejected() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let malformed_tokens = vec![
        "Bearer not.a.valid.jwt",
        "Bearer ",
        "Bearer",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corrupted_payload.invalid_sig",
        "Basic dXNlcjpwYXNz",
        "Token abcdef12345",
    ];

    for bad_token in malformed_tokens {
        let req = Request::builder()
            .method("GET")
            .uri("/api/v1/projects")
            .header(header::AUTHORIZATION, bad_token)
            .body(Body::empty())
            .unwrap();

        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(
            res.status(),
            StatusCode::UNAUTHORIZED,
            "Malformed auth header '{}' must be rejected with 401",
            bad_token
        );
    }
}

#[tokio::test]
async fn test_spoofed_identity_headers_rejected_without_valid_jwt() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/projects")
        .header("x-user-id", Uuid::new_v4().to_string())
        .header("x-user-role", "ADMIN")
        .header("x-actor-id", Uuid::new_v4().to_string())
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(
        res.status(),
        StatusCode::UNAUTHORIZED,
        "Spoofed client headers without valid JWT must return 401"
    );
}

#[tokio::test]
async fn test_spoofed_reported_by_in_observation_is_overridden_by_jwt() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());
    let project_id = Uuid::new_v4();
    {
        let mut projects = state.projects.write().await;
        projects.push(Project {
            id: project_id,
            code: "OBS-PROJ".into(),
            name: "Observation Test Project".into(),
            description: None,
            timezone: "UTC".into(),
            currency: "USD".into(),
            team_id: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        });
    }

    let legitimate_user_id = Uuid::new_v4();
    let token = generate_signed_jwt(legitimate_user_id, "ENGINEER", 3600).unwrap();

    let deceptive_reported_by = Uuid::parse_str("11111111-2222-3333-4444-555555555555").unwrap();

    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/observations", project_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "raw_text": "Completed pile testing on Section C",
                "reported_progress": 50.0,
                "reported_by": deceptive_reported_by
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let res_json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(
        res_json["reported_by"],
        legitimate_user_id.to_string(),
        "Observation reported_by must strictly equal legitimate JWT user ID"
    );

    let audit_trail = state.audit_trail.read().await;
    let obs_audit = audit_trail
        .iter()
        .find(|a| a.action == "CREATE_OBSERVATION")
        .expect("Observation audit record must exist");

    assert_eq!(
        obs_audit.actor_id,
        Some(legitimate_user_id),
        "Audit trail actor_id must strictly equal legitimate JWT user ID"
    );
}

#[tokio::test]
async fn test_spoofed_authorized_by_in_legal_hold_is_overridden_by_jwt() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());
    let project_id = Uuid::new_v4();

    let legitimate_admin_id = Uuid::new_v4();
    let token = generate_signed_jwt(legitimate_admin_id, "ADMIN", 3600).unwrap();

    let deceptive_authorized_by = Uuid::parse_str("99999999-8888-7777-6666-555555555555").unwrap();

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/projects/{}/audit-trail/legal-hold",
            project_id
        ))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "enabled": true,
                "reason": "Statutory compliance hold",
                "authorized_by": deceptive_authorized_by
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let audit_trail = state.audit_trail.read().await;
    let hold_audit = audit_trail
        .iter()
        .find(|a| a.action == "ENABLE_LEGAL_HOLD")
        .expect("Legal hold audit record must exist");

    assert_eq!(
        hold_audit.actor_id,
        Some(legitimate_admin_id),
        "Legal hold audit record must attribute actor strictly to verified JWT"
    );
}

#[tokio::test]
async fn test_spoofed_reviewed_by_in_proposal_approval_is_overridden_by_jwt() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let project_id = Uuid::new_v4();
    let proposal_id = Uuid::new_v4();
    let activity_id = Uuid::new_v4();

    {
        let mut proposals = state.proposals.write().await;
        proposals.push(MatchProposal {
            id: proposal_id,
            project_id,
            observation_id: Uuid::new_v4(),
            activity_id,
            candidate_rank: 1,
            lexical_score: 0.95,
            semantic_score: 0.95,
            context_boost: 0.1,
            confidence_score: 0.98,
            match_tier: MatchTier::High,
            explanation: Some("Direct Match".into()),
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
            code: "CIV-001".into(),
            name: "Foundation Pours".into(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: chrono::Utc::now().date_naive(),
            planned_finish_date: chrono::Utc::now().date_naive(),
            planned_duration_days: 5,
            planned_quantity: Some(50.0),
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
    let token = generate_signed_jwt(legitimate_planner_id, "PLANNER", 3600).unwrap();

    let app = create_router(state.clone());

    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/approve", proposal_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "comments": "Approved on site",
                "reviewer_id": "77777777-7777-7777-7777-777777777777",
                "reviewed_by": "77777777-7777-7777-7777-777777777777"
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let audit_trail = state.audit_trail.read().await;
    let approval_audit = audit_trail
        .iter()
        .find(|a| a.action == "APPROVE_AND_COMMIT")
        .expect("Approval audit entry must exist");

    assert_eq!(
        approval_audit.actor_id,
        Some(legitimate_planner_id),
        "Approval audit record must derive actor strictly from verified JWT"
    );
}

#[tokio::test]
async fn test_spoofed_role_in_jwt_metadata_cannot_bypass_role_permissions() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);
    let project_id = Uuid::new_v4();

    // User is actually a VIEWER, attempts to claim PLANNER authority in body or headers
    let viewer_id = Uuid::new_v4();
    let viewer_token = generate_signed_jwt(viewer_id, "VIEWER", 3600).unwrap();

    // Viewer attempts to import schedule (requires PLANNER permission)
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/schedule/import", project_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", viewer_token))
        .header("x-user-role", "PLANNER")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "activities": [] }).to_string()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(
        res.status(),
        StatusCode::FORBIDDEN,
        "User with VIEWER role token must receive 403 when attempting schedule import"
    );
}

#[tokio::test]
async fn test_cross_project_role_mismatch_disallows_unauthorized_mutations() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);
    let project_b = Uuid::new_v4();

    // User A has token with VIEWER role
    let user_a = Uuid::new_v4();
    let token_a = generate_signed_jwt(user_a, "VIEWER", 3600).unwrap();

    // 1. Attempt to import schedule on Project B -> 403 FORBIDDEN
    let req1 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/schedule/import", project_b))
        .header(header::AUTHORIZATION, format!("Bearer {}", token_a))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "activities": [] }).to_string()))
        .unwrap();

    let res1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(res1.status(), StatusCode::FORBIDDEN);

    // 2. Attempt to toggle legal hold on Project B -> 403 FORBIDDEN
    let req2 = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/projects/{}/audit-trail/legal-hold",
            project_b
        ))
        .header(header::AUTHORIZATION, format!("Bearer {}", token_a))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "enabled": true, "reason": "Unauthorized" }).to_string(),
        ))
        .unwrap();

    let res2 = app.oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::FORBIDDEN);
}
