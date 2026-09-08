use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use serde_json::json;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use backend::api::handlers::AppState;
use backend::api::middleware::{extract_project_id_from_path, generate_signed_jwt};
use backend::api::routes::create_router;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_extract_project_id_from_path_resolution() {
    let project_id = Uuid::new_v4();

    // Project scoped paths
    let path1 = format!("/api/v1/projects/{}/dashboard", project_id);
    assert_eq!(extract_project_id_from_path(&path1), Some(project_id));

    let path2 = format!("/api/v1/projects/{}/activities", project_id);
    assert_eq!(extract_project_id_from_path(&path2), Some(project_id));

    let path3 = format!("/api/v1/projects/{}/review-queue", project_id);
    assert_eq!(extract_project_id_from_path(&path3), Some(project_id));

    let path4 = format!("/api/v1/projects/{}", project_id);
    assert_eq!(extract_project_id_from_path(&path4), Some(project_id));

    // Non-project scoped paths
    assert_eq!(extract_project_id_from_path("/api/v1/projects"), None);
    assert_eq!(extract_project_id_from_path("/health"), None);
    assert_eq!(extract_project_id_from_path("/ready"), None);
    assert_eq!(
        extract_project_id_from_path(&format!("/api/v1/proposals/{}/approve", Uuid::new_v4())),
        None
    );
}

#[tokio::test]
async fn test_unauthenticated_requests_rejected_on_all_project_endpoints() {
    let state = AppState::empty(None, None, None);
    let app = create_router(state);
    let project_id = Uuid::new_v4();

    // 1. GET /api/v1/projects without auth must return 401 UNAUTHORIZED
    let req1 = Request::builder()
        .method("GET")
        .uri("/api/v1/projects")
        .body(Body::empty())
        .unwrap();
    let res1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(res1.status(), StatusCode::UNAUTHORIZED);

    // 2. GET /api/v1/projects/:id without auth must return 401 UNAUTHORIZED
    let req2 = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/projects/{}", project_id))
        .body(Body::empty())
        .unwrap();
    let res2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::UNAUTHORIZED);

    // 3. GET /api/v1/projects/:id/dashboard without auth must return 401 UNAUTHORIZED
    let req3 = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/projects/{}/dashboard", project_id))
        .body(Body::empty())
        .unwrap();
    let res3 = app.clone().oneshot(req3).await.unwrap();
    assert_eq!(res3.status(), StatusCode::UNAUTHORIZED);

    // 4. GET /api/v1/projects/:id/activities without auth must return 401 UNAUTHORIZED
    let req4 = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/projects/{}/activities", project_id))
        .body(Body::empty())
        .unwrap();
    let res4 = app.clone().oneshot(req4).await.unwrap();
    assert_eq!(res4.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_role_authority_and_permission_enforcement() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);
    let project_id = Uuid::new_v4();

    // User with VIEWER role token
    let viewer_id = Uuid::new_v4();
    let viewer_token = generate_signed_jwt(viewer_id, "VIEWER", 3600).unwrap();

    // A viewer cannot import schedule (requires PLANNER permission)
    let import_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/schedule/import", project_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", viewer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "activities": [] }).to_string()))
        .unwrap();

    let import_res = app.clone().oneshot(import_req).await.unwrap();
    assert_eq!(
        import_res.status(),
        StatusCode::FORBIDDEN,
        "Viewer must not be permitted to import schedule"
    );

    // A viewer cannot set legal hold (requires ADMIN permission)
    let hold_req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/projects/{}/audit-trail/legal-hold",
            project_id
        ))
        .header(header::AUTHORIZATION, format!("Bearer {}", viewer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "enabled": true, "reason": "Test" }).to_string(),
        ))
        .unwrap();

    let hold_res = app.clone().oneshot(hold_req).await.unwrap();
    assert_eq!(
        hold_res.status(),
        StatusCode::FORBIDDEN,
        "Viewer must not be permitted to modify legal hold"
    );

    // A planner cannot set legal hold (requires ADMIN permission)
    let planner_id = Uuid::new_v4();
    let planner_token = generate_signed_jwt(planner_id, "PLANNER", 3600).unwrap();

    let planner_hold_req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/projects/{}/audit-trail/legal-hold",
            project_id
        ))
        .header(header::AUTHORIZATION, format!("Bearer {}", planner_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "enabled": true, "reason": "Test" }).to_string(),
        ))
        .unwrap();

    let planner_hold_res = app.clone().oneshot(planner_hold_req).await.unwrap();
    assert_eq!(
        planner_hold_res.status(),
        StatusCode::FORBIDDEN,
        "Planner must not be permitted to modify legal hold without Admin permission"
    );
}

#[tokio::test]
async fn test_governance_retention_and_legal_hold_endpoints() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);
    let project_id = Uuid::new_v4();

    let admin_id = Uuid::new_v4();
    let admin_token = generate_signed_jwt(admin_id, "ADMIN", 3600).unwrap();

    // 1. Retention policy retrieval (Auditor/Admin permission)
    let retention_req = Request::builder()
        .method("GET")
        .uri(format!(
            "/api/v1/projects/{}/audit-trail/retention-policy",
            project_id
        ))
        .header(header::AUTHORIZATION, format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let retention_res = app.clone().oneshot(retention_req).await.unwrap();
    assert_eq!(retention_res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(retention_res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["policy"]["statutory_retention_days"], 2555);
    assert_eq!(json["policy"]["hot_retention_days"], 90);
    assert_eq!(json["policy"]["enforce_legal_hold"], true);

    // 2. Set legal hold with Admin token
    let hold_req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/projects/{}/audit-trail/legal-hold",
            project_id
        ))
        .header(header::AUTHORIZATION, format!("Bearer {}", admin_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "enabled": true,
                "reason": "Pending regulatory inquiry"
            })
            .to_string(),
        ))
        .unwrap();

    let hold_res = app.clone().oneshot(hold_req).await.unwrap();
    assert_eq!(hold_res.status(), StatusCode::OK);

    let hold_bytes = axum::body::to_bytes(hold_res.into_body(), usize::MAX)
        .await
        .unwrap();
    let hold_json: serde_json::Value = serde_json::from_slice(&hold_bytes).unwrap();
    assert_eq!(hold_json["legal_hold_active"], true);
    assert_eq!(hold_json["status"], "UPDATED");
}

#[tokio::test]
async fn test_authenticated_project_listing_in_memory_mode() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let user_id = Uuid::new_v4();
    let token = generate_signed_jwt(user_id, "ENGINEER", 3600).unwrap();

    let list_req = Request::builder()
        .method("GET")
        .uri("/api/v1/projects")
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let list_res = app.oneshot(list_req).await.unwrap();
    assert_eq!(list_res.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(list_res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert!(json.is_array());
    assert_eq!(json.as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn test_extract_project_id_edge_cases() {
    // Malformed UUIDs
    assert_eq!(
        extract_project_id_from_path("/api/v1/projects/not-a-uuid/dashboard"),
        None
    );
    assert_eq!(
        extract_project_id_from_path("/api/v1/projects/12345/activities"),
        None
    );
    assert_eq!(
        extract_project_id_from_path("/api/v1/projects/../admin"),
        None
    );
    assert_eq!(extract_project_id_from_path("/api/v1/projects/"), None);
    assert_eq!(extract_project_id_from_path(""), None);

    // Valid UUID with trailing slash or deep path
    let project_id = Uuid::new_v4();
    assert_eq!(
        extract_project_id_from_path(&format!("/api/v1/projects/{}/", project_id)),
        Some(project_id)
    );
    assert_eq!(
        extract_project_id_from_path(&format!("/api/v1/projects/{}/sub/path/here", project_id)),
        Some(project_id)
    );
}

#[tokio::test]
async fn test_rate_limiter_blocks_burst_over_threshold() {
    let _guard = TEST_ENV_LOCK.lock().await;
    std::env::set_var("RATE_LIMIT_MAX_REQUESTS", "5");
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let user_id = Uuid::new_v4();
    let token = generate_signed_jwt(user_id, "VIEWER", 3600).unwrap();

    // Fire 10 rapid requests (threshold is set to 5 req/min)
    let mut hit_429 = false;
    for _ in 0..10 {
        let req = Request::builder()
            .method("GET")
            .uri("/api/v1/projects")
            .header(header::AUTHORIZATION, format!("Bearer {}", token))
            .body(Body::empty())
            .unwrap();

        let res = app.clone().oneshot(req).await.unwrap();
        if res.status() == StatusCode::TOO_MANY_REQUESTS {
            hit_429 = true;
            break;
        }
    }

    std::env::remove_var("RATE_LIMIT_MAX_REQUESTS");

    assert!(
        hit_429,
        "Burst of requests over rate limit threshold must be throttled with 429 Too Many Requests"
    );
}
