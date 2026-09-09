use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use serde_json::json;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use backend::api::handlers::AppState;
use backend::api::middleware::generate_signed_jwt;
use backend::api::routes::create_router;
use backend::domain::models::*;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_jwt_role_spoofing_does_not_bypass_team_or_project_isolation() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());

    let user_a_id = Uuid::new_v4();
    let attacker_b_id = Uuid::new_v4();

    let token_a = generate_signed_jwt(user_a_id, "PLANNER", 3600).unwrap();
    // Attacker B attempts to forge an "ADMIN" role claim in their JWT token
    let attacker_admin_token = generate_signed_jwt(attacker_b_id, "ADMIN", 3600).unwrap();

    // 1. User A creates Team Alpha
    let create_team_req = Request::builder()
        .method("POST")
        .uri("/api/v1/teams")
        .header(header::AUTHORIZATION, format!("Bearer {}", token_a))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Team Alpha Safe",
                "slug": "team-alpha-safe"
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(create_team_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let team_a: Team = serde_json::from_slice(&axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap()).unwrap();

    // 2. User A creates Project Alpha under Team Alpha
    let create_proj_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/teams/{}/projects", team_a.id))
        .header(header::AUTHORIZATION, format!("Bearer {}", token_a))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "code": "PRJ-A",
                "name": "Project Alpha Secret",
                "team_id": team_a.id
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(create_proj_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let proj_a: Project = serde_json::from_slice(&axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap()).unwrap();

    // 3. Attacker B tries to GET Team Alpha using forged ADMIN JWT -> MUST BE REJECTED (404 Not Found to prevent tenant disclosure)
    let get_team_req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/teams/{}", team_a.id))
        .header(header::AUTHORIZATION, format!("Bearer {}", attacker_admin_token))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(get_team_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 4. Attacker B tries to list Team Alpha's projects using forged ADMIN JWT -> MUST BE REJECTED
    let list_proj_req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/teams/{}/projects", team_a.id))
        .header(header::AUTHORIZATION, format!("Bearer {}", attacker_admin_token))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(list_proj_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 5. Attacker B tries to create project in Team Alpha using forged ADMIN JWT -> MUST BE REJECTED (403 Forbidden)
    let attack_create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/teams/{}/projects", team_a.id))
        .header(header::AUTHORIZATION, format!("Bearer {}", attacker_admin_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "code": "PRJ-HACK",
                "name": "Hacked Project",
                "team_id": team_a.id
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(attack_create_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);

    // 6. Attacker B tries to direct-fetch Project Alpha via /api/v1/projects/:id -> MUST BE REJECTED (404)
    let get_proj_req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/projects/{}", proj_a.id))
        .header(header::AUTHORIZATION, format!("Bearer {}", attacker_admin_token))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(get_proj_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_unauthenticated_mutations_and_previews_are_rejected() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let dummy_project_id = Uuid::new_v4();
    let dummy_proposal_id = Uuid::new_v4();

    // 1. Unauthenticated schedule preview -> 401
    let preview_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/import/preview", dummy_project_id))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "format": "CSV",
                "raw_content": "ActivityID,Name\nA1,Test\n"
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(preview_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 2. Unauthenticated schedule commit -> 401
    let commit_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/import/commit", dummy_project_id))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "activities": []
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(commit_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 3. Unauthenticated proposal approve -> 401
    let approve_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/approve", dummy_proposal_id))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({}).to_string()))
        .unwrap();

    let res = app.clone().oneshot(approve_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 4. Unauthenticated proposal reject -> 401
    let reject_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/reject", dummy_proposal_id))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "reason": "test" }).to_string()))
        .unwrap();

    let res = app.clone().oneshot(reject_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 5. Unauthenticated proposal override -> 401
    let override_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/override", dummy_proposal_id))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "new_activity_id": "ACT-1", "reason": "test" }).to_string()))
        .unwrap();

    let res = app.clone().oneshot(override_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_require_database_prevents_silent_in_memory_fallbacks() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let mut state = AppState::empty(None, None, None);
    // Explicitly enforce PostgreSQL persistence
    state.require_database = true;

    let app = create_router(state);
    let user_id = Uuid::new_v4();
    let token = generate_signed_jwt(user_id, "OWNER", 3600).unwrap();

    // 1. Attempt team creation without database -> 503 SERVICE UNAVAILABLE
    let create_team_req = Request::builder()
        .method("POST")
        .uri("/api/v1/teams")
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Beta Team",
                "slug": "beta-team"
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(create_team_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);

    // 2. Attempt listing teams without database -> 503 SERVICE UNAVAILABLE
    let list_teams_req = Request::builder()
        .method("GET")
        .uri("/api/v1/teams")
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(list_teams_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);

    // 3. Attempt listing projects without database -> 503 SERVICE UNAVAILABLE
    let list_projects_req = Request::builder()
        .method("GET")
        .uri("/api/v1/projects")
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(list_projects_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);

    // 4. Attempt project creation without database -> 503 SERVICE UNAVAILABLE
    let proj_req = Request::builder()
        .method("POST")
        .uri("/api/v1/projects")
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "code": "BETA-PRJ",
                "name": "Beta Project",
                "team_id": Uuid::new_v4()
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(proj_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
}
