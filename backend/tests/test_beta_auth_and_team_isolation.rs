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
use backend::domain::models::*;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_team_creation_and_membership_isolation() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());

    let user_a_id = Uuid::new_v4();
    let user_b_id = Uuid::new_v4();

    let token_a = generate_signed_jwt(user_a_id, "PLANNER", 3600).unwrap();
    let token_b = generate_signed_jwt(user_b_id, "PLANNER", 3600).unwrap();

    // 1. User A creates Team Alpha via POST /api/v1/teams
    let create_team_req = Request::builder()
        .method("POST")
        .uri("/api/v1/teams")
        .header(header::AUTHORIZATION, format!("Bearer {}", token_a))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Alpha Infrastructure",
                "slug": "alpha-infra"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.clone().oneshot(create_team_req).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let team_a: Team = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(team_a.name, "Alpha Infrastructure");
    assert_eq!(team_a.created_by, user_a_id);

    // 2. User A lists their teams -> Sees Team Alpha
    let list_req_a = Request::builder()
        .method("GET")
        .uri("/api/v1/teams")
        .header(header::AUTHORIZATION, format!("Bearer {}", token_a))
        .body(Body::empty())
        .unwrap();
    let response_a = app.clone().oneshot(list_req_a).await.unwrap();
    assert_eq!(response_a.status(), StatusCode::OK);
    let list_bytes_a = axum::body::to_bytes(response_a.into_body(), usize::MAX)
        .await
        .unwrap();
    let teams_a: Vec<Team> = serde_json::from_slice(&list_bytes_a).unwrap();
    assert_eq!(teams_a.len(), 1);
    assert_eq!(teams_a[0].id, team_a.id);

    // 3. User B lists their teams -> Zero teams (Strict isolation)
    let list_req_b = Request::builder()
        .method("GET")
        .uri("/api/v1/teams")
        .header(header::AUTHORIZATION, format!("Bearer {}", token_b))
        .body(Body::empty())
        .unwrap();
    let response_b = app.clone().oneshot(list_req_b).await.unwrap();
    assert_eq!(response_b.status(), StatusCode::OK);
    let list_bytes_b = axum::body::to_bytes(response_b.into_body(), usize::MAX)
        .await
        .unwrap();
    let teams_b: Vec<Team> = serde_json::from_slice(&list_bytes_b).unwrap();
    assert!(teams_b.is_empty());

    // 4. User B attempts to access Team Alpha directly by ID -> 404/403 uninformative denial
    let get_team_req_b = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/teams/{}", team_a.id))
        .header(header::AUTHORIZATION, format!("Bearer {}", token_b))
        .body(Body::empty())
        .unwrap();
    let get_response_b = app.clone().oneshot(get_team_req_b).await.unwrap();
    assert!(
        get_response_b.status() == StatusCode::NOT_FOUND
            || get_response_b.status() == StatusCode::FORBIDDEN
    );
}

#[tokio::test]
async fn test_cross_team_project_and_resource_uninformative_denial() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());

    let user_a_id = Uuid::new_v4();
    let user_b_id = Uuid::new_v4();
    let team_a_id = Uuid::new_v4();
    let team_b_id = Uuid::new_v4();
    let project_a_id = Uuid::new_v4();

    // Populate team A, team B, and project A
    {
        let mut teams = state.teams.write().await;
        teams.push(Team {
            id: team_a_id,
            name: "Team A".into(),
            slug: "team-a".into(),
            created_by: user_a_id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        teams.push(Team {
            id: team_b_id,
            name: "Team B".into(),
            slug: "team-b".into(),
            created_by: user_b_id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });

        let mut team_members = state.team_members.write().await;
        team_members.push(TeamMember {
            id: Uuid::new_v4(),
            team_id: team_a_id,
            user_id: user_a_id,
            email: Some("user_a@nexora.test".into()),
            full_name: Some("User A".into()),
            role: "OWNER".into(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        team_members.push(TeamMember {
            id: Uuid::new_v4(),
            team_id: team_b_id,
            user_id: user_b_id,
            email: Some("user_b@nexora.test".into()),
            full_name: Some("User B".into()),
            role: "OWNER".into(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });

        let mut projects = state.projects.write().await;
        projects.push(Project {
            id: project_a_id,
            code: "PROJ-ALPHA".into(),
            name: "Alpha Highway".into(),
            description: Some("Confidential highway expansion".into()),
            timezone: "UTC".into(),
            currency: "USD".into(),
            team_id: Some(team_a_id),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }

    let token_b = generate_signed_jwt(user_b_id, "PLANNER", 3600).unwrap();

    // User B attempts to get project A via /api/v1/projects/:id -> Must receive 404/403 uninformative denial
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/projects/{}", project_a_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", token_b))
        .body(Body::empty())
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    assert!(
        resp.status() == StatusCode::NOT_FOUND || resp.status() == StatusCode::FORBIDDEN,
        "User B from Team B must not be able to view Team A's project, got {}",
        resp.status()
    );
}

#[tokio::test]
async fn test_team_invitations_authorization_and_lifecycle() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());

    let owner_id = Uuid::new_v4();
    let engineer_id = Uuid::new_v4();
    let team_id = Uuid::new_v4();

    // Set up team with an Owner and an Engineer
    {
        let mut teams = state.teams.write().await;
        teams.push(Team {
            id: team_id,
            name: "Metro Consortium".into(),
            slug: "metro-consortium".into(),
            created_by: owner_id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });

        let mut team_members = state.team_members.write().await;
        team_members.push(TeamMember {
            id: Uuid::new_v4(),
            team_id,
            user_id: owner_id,
            email: Some("owner@nexora.test".into()),
            full_name: Some("Owner".into()),
            role: "OWNER".into(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        team_members.push(TeamMember {
            id: Uuid::new_v4(),
            team_id,
            user_id: engineer_id,
            email: Some("engineer@nexora.test".into()),
            full_name: Some("Engineer".into()),
            role: "ENGINEER".into(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }

    let owner_token = generate_signed_jwt(owner_id, "PLANNER", 3600).unwrap();
    let engineer_token = generate_signed_jwt(engineer_id, "ENGINEER", 3600).unwrap();

    // 1. Non-admin (Engineer) attempts to invite a new member -> 403 Forbidden
    let unauth_invite_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/teams/{}/invitations", team_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", engineer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "email": "planner@nexora.test",
                "role": "PLANNER"
            })
            .to_string(),
        ))
        .unwrap();

    let unauth_resp = app.clone().oneshot(unauth_invite_req).await.unwrap();
    assert_eq!(unauth_resp.status(), StatusCode::FORBIDDEN);

    // 2. Owner invites new member -> 201 Created
    let auth_invite_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/teams/{}/invitations", team_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", owner_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "email": "planner@nexora.test",
                "role": "PLANNER"
            })
            .to_string(),
        ))
        .unwrap();

    let auth_resp = app.clone().oneshot(auth_invite_req).await.unwrap();
    assert_eq!(auth_resp.status(), StatusCode::CREATED);

    let invite_bytes = axum::body::to_bytes(auth_resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let invitation: TeamInvitation = serde_json::from_slice(&invite_bytes).unwrap();
    assert_eq!(invitation.email, "planner@nexora.test");
    assert_eq!(invitation.status, "PENDING");
    assert!(!invitation.token.is_empty());

    // 3. Revoke invitation
    let revoke_req = Request::builder()
        .method("DELETE")
        .uri(format!(
            "/api/v1/teams/{}/invitations/{}",
            team_id, invitation.id
        ))
        .header(header::AUTHORIZATION, format!("Bearer {}", owner_token))
        .body(Body::empty())
        .unwrap();

    let revoke_resp = app.clone().oneshot(revoke_req).await.unwrap();
    assert_eq!(revoke_resp.status(), StatusCode::OK);

    // 4. Verify invitation status is now REVOKED
    let invitations = state.team_invitations.read().await;
    let found = invitations.iter().find(|i| i.id == invitation.id).unwrap();
    assert_eq!(found.status, "REVOKED");
}

#[tokio::test]
async fn test_rbac_matrix_enforcement() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());

    let project_id = Uuid::new_v4();
    let proposal_id = Uuid::new_v4();

    {
        let mut projects = state.projects.write().await;
        projects.push(Project {
            id: project_id,
            code: "RBAC-PROJ".into(),
            name: "RBAC Test Project".into(),
            description: None,
            timezone: "UTC".into(),
            currency: "USD".into(),
            team_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }

    // 1. Viewer attempting to approve a proposal -> 403 Forbidden
    let viewer_id = Uuid::new_v4();
    let viewer_token = generate_signed_jwt(viewer_id, "VIEWER", 3600).unwrap();

    let approve_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/approve", proposal_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", viewer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "comments": "Viewer approval attempt"
            })
            .to_string(),
        ))
        .unwrap();

    let approve_resp = app.clone().oneshot(approve_req).await.unwrap();
    assert_eq!(
        approve_resp.status(),
        StatusCode::FORBIDDEN,
        "Viewer role must be forbidden from approving proposals"
    );

    // 2. Engineer attempting an admin-only legal retention toggle -> 403 Forbidden
    let engineer_id = Uuid::new_v4();
    let engineer_token = generate_signed_jwt(engineer_id, "ENGINEER", 3600).unwrap();

    let retention_req = Request::builder()
        .method("POST")
        .uri("/api/v1/audit/retention/legal-hold")
        .header(header::AUTHORIZATION, format!("Bearer {}", engineer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "project_id": project_id,
                "enabled": true,
                "reason": "Engineer attempt"
            })
            .to_string(),
        ))
        .unwrap();

    let retention_resp = app.clone().oneshot(retention_req).await.unwrap();
    assert_eq!(
        retention_resp.status(),
        StatusCode::FORBIDDEN,
        "Engineer role must be forbidden from administrative legal retention operations"
    );

    // 3. Viewer attempting schedule import commit -> 403 Forbidden
    let import_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/import/commit", project_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", viewer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "version_label": "REV-01",
                "activities": []
            })
            .to_string(),
        ))
        .unwrap();

    let import_resp = app.clone().oneshot(import_req).await.unwrap();
    assert_eq!(
        import_resp.status(),
        StatusCode::FORBIDDEN,
        "Viewer role must be forbidden from importing schedules"
    );

    // 4. Viewer attempting team deletion -> 403 Forbidden
    let delete_team_req = Request::builder()
        .method("DELETE")
        .uri(format!("/api/v1/teams/{}", Uuid::new_v4()))
        .header(header::AUTHORIZATION, format!("Bearer {}", viewer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "confirm_name": "Test Team"
            })
            .to_string(),
        ))
        .unwrap();

    let delete_team_resp = app.clone().oneshot(delete_team_req).await.unwrap();
    assert_eq!(
        delete_team_resp.status(),
        StatusCode::FORBIDDEN,
        "Viewer role must be forbidden from deleting teams"
    );
}

#[tokio::test]
async fn test_cross_project_document_isolation_uninformative_denial() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());

    let user_a_id = Uuid::new_v4();
    let project_b_id = Uuid::new_v4();
    let token_a = generate_signed_jwt(user_a_id, "PLANNER", 3600).unwrap();

    // User A attempts to list or query documents from Project B where they are not a member
    let doc_req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/projects/{}/documents", project_b_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", token_a))
        .body(Body::empty())
        .unwrap();

    let doc_resp = app.clone().oneshot(doc_req).await.unwrap();
    assert!(
        doc_resp.status() == StatusCode::FORBIDDEN || doc_resp.status() == StatusCode::NOT_FOUND,
        "Project A user must receive uninformative 403/404 when querying Project B documents, got {}",
        doc_resp.status()
    );
}
