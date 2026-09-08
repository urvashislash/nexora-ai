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
async fn test_concurrent_proposal_approval_double_spend_prevention() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);

    let project_id = Uuid::new_v4();
    let activity_id = Uuid::new_v4();
    let proposal_id = Uuid::new_v4();

    {
        let mut projects = state.projects.write().await;
        projects.push(Project {
            id: project_id,
            code: "PROJ-CONC".into(),
            name: "Concurrency Test Project".into(),
            description: None,
            timezone: "UTC".into(),
            currency: "USD".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });

        let mut activities = state.activities.write().await;
        activities.push(Activity {
            id: activity_id,
            project_id,
            schedule_version_id: Uuid::new_v4(),
            wbs_id: Uuid::new_v4(),
            code: "ACT-01".into(),
            name: "Foundation Pouring".into(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: Utc::now().date_naive(),
            planned_finish_date: Utc::now().date_naive(),
            planned_duration_days: 10,
            planned_quantity: Some(100.0),
            unit_of_measure: Some("M3".into()),
            location: None,
            zone: None,
            equipment_tag: None,
            weightage: 1.0,
            critical_path: false,
        });

        let mut act_states = state.activity_states.write().await;
        act_states.push(ActivityCurrentState {
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
            updated_at: Utc::now(),
        });

        let mut proposals = state.proposals.write().await;
        proposals.push(MatchProposal {
            id: proposal_id,
            project_id,
            observation_id: Uuid::new_v4(),
            activity_id,
            candidate_rank: 1,
            lexical_score: 0.9,
            semantic_score: 0.9,
            context_boost: 0.1,
            confidence_score: 0.95,
            match_tier: MatchTier::High,
            explanation: Some("High confidence".into()),
            evidence_snippet: None,
            status: "PENDING_REVIEW".into(),
            created_at: Utc::now(),
        });
    }

    let planner_id = Uuid::new_v4();
    let planner_token = generate_signed_jwt(planner_id, "PLANNER", 3600).unwrap();

    let mut handles = Vec::new();
    let app = create_router(state.clone());

    // Launch 10 concurrent requests to approve the same proposal
    for i in 0..10 {
        let app_clone = app.clone();
        let token_clone = planner_token.clone();
        let handle = tokio::spawn(async move {
            let req = Request::builder()
                .method("POST")
                .uri(format!("/api/v1/proposals/{}/approve", proposal_id))
                .header(header::AUTHORIZATION, format!("Bearer {}", token_clone))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "comments": format!("Concurrent attempt {}", i)
                    })
                    .to_string(),
                ))
                .unwrap();

            let res = app_clone.oneshot(req).await.unwrap();
            res.status()
        });
        handles.push(handle);
    }

    let mut success_count = 0;
    let mut conflict_count = 0;

    for h in handles {
        let status = h.await.unwrap();
        if status == StatusCode::OK {
            success_count += 1;
        } else if status == StatusCode::CONFLICT || status == StatusCode::BAD_REQUEST {
            conflict_count += 1;
        }
    }

    // Exactly 1 approval must succeed due to idempotency key / single commitment gate
    assert_eq!(success_count, 1, "Exactly one approval must succeed");
    assert_eq!(
        conflict_count, 9,
        "All duplicate approvals must be rejected"
    );

    // Exactly one event and audit record must exist
    let events = state.events.read().await;
    assert_eq!(
        events.len(),
        1,
        "Exactly one actual event must be committed"
    );

    let approvals = state.approvals.read().await;
    assert_eq!(
        approvals.len(),
        1,
        "Exactly one approval record must be created"
    );
}

#[tokio::test]
async fn test_high_throughput_concurrent_observations_chain_continuity() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());

    let project_id = Uuid::new_v4();
    let supervisor_id = Uuid::new_v4();
    let token = generate_signed_jwt(supervisor_id, "SUPERVISOR", 3600).unwrap();

    let mut handles = Vec::new();
    for i in 0..15 {
        let app_clone = app.clone();
        let token_clone = token.clone();
        let handle = tokio::spawn(async move {
            let req = Request::builder()
                .method("POST")
                .uri(format!("/api/v1/projects/{}/observations", project_id))
                .header(header::AUTHORIZATION, format!("Bearer {}", token_clone))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "raw_text": format!("Batch observation log #{}", i),
                        "reported_progress": (i as f64) * 5.0,
                    })
                    .to_string(),
                ))
                .unwrap();

            let res = app_clone.oneshot(req).await.unwrap();
            res.status()
        });
        handles.push(handle);
    }

    for h in handles {
        let status = h.await.unwrap();
        assert_eq!(status, StatusCode::CREATED);
    }

    let obs = state.observations.read().await;
    assert_eq!(obs.len(), 15, "All 15 observations must be recorded");

    let audit = state.audit_trail.read().await;
    assert_eq!(
        audit.len(),
        15,
        "All 15 observations must have audit entries"
    );
}
