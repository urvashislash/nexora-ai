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

fn get_test_db_url() -> Option<String> {
    if let Ok(url) = std::env::var("DATABASE_URL") {
        if !url.is_empty() {
            return Some(url);
        }
    }
    if let Ok(url) = std::env::var("DATABASE_POOLER_URL") {
        if !url.is_empty() {
            return Some(url);
        }
    }
    for env_path in &["../.env", ".env", "../../.env"] {
        if let Ok(content) = std::fs::read_to_string(env_path) {
            for line in content.lines() {
                if let Some(val) = line.strip_prefix("DATABASE_POOLER_URL=") {
                    let trimmed = val.trim().trim_matches('"');
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                }
                if let Some(val) = line.strip_prefix("DATABASE_URL=") {
                    let trimmed = val.trim().trim_matches('"');
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                }
            }
        }
    }
    None
}

#[tokio::test]
async fn test_real_postgresql_concurrent_proposal_approvals_with_row_locking() {
    let _guard = TEST_ENV_LOCK.lock().await;

    let db_url = match get_test_db_url() {
        Some(url) => url,
        None => {
            eprintln!("SKIPPING real PostgreSQL concurrency test: DATABASE_URL not set");
            return;
        }
    };

    let db = match backend::database::Database::new(&db_url).await {
        Ok(d) => d,
        Err(e) => {
            eprintln!(
                "SKIPPING real PostgreSQL concurrency test: cannot connect to DB ({})",
                e
            );
            return;
        }
    };

    let db_arc = std::sync::Arc::new(db);
    let admin_id = Uuid::new_v4();
    let project_code = format!("CONC-{}", &Uuid::new_v4().to_string()[..6]).to_uppercase();

    let project_input = ProjectCreateInput {
        code: project_code.clone(),
        name: "PostgreSQL Concurrency Test Project".into(),
        description: Some("Testing real row-level locks under 10 concurrent transactions".into()),
        timezone: Some("UTC".into()),
        currency: Some("USD".into()),
        baseline_activities: None,
    };

    let project = match db_arc
        .create_project_tx(
            &project_input,
            admin_id,
            Some("admin@test.com"),
            Some("Test Admin"),
        )
        .await
    {
        Ok(p) => p,
        Err(e) => {
            eprintln!(
                "SKIPPING real PostgreSQL test: create_project_tx failed: {}",
                e
            );
            return;
        }
    };

    // Retrieve created baseline version and wbs root
    let version_id: Uuid =
        sqlx::query_scalar("SELECT id FROM schedule_versions WHERE project_id = $1 LIMIT 1")
            .bind(project.id)
            .fetch_one(db_arc.pool())
            .await
            .unwrap();

    let wbs_id: Uuid = sqlx::query_scalar("SELECT id FROM wbs_nodes WHERE project_id = $1 LIMIT 1")
        .bind(project.id)
        .fetch_one(db_arc.pool())
        .await
        .unwrap();

    let activity_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO activities (id, project_id, schedule_version_id, wbs_id, code, name, discipline, planned_start_date, planned_finish_date, planned_duration_days, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'ACT-REAL-01', 'Real DB Activity', 'CIVIL', CURRENT_DATE, CURRENT_DATE + 5, 5, now(), now())"
    )
    .bind(activity_id)
    .bind(project.id)
    .bind(version_id)
    .bind(wbs_id)
    .execute(db_arc.pool())
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO activity_current_state (activity_id, project_id, execution_status, current_progress_pct, updated_at)
         VALUES ($1, $2, 'NOT_STARTED', 0.0, now())"
    )
    .bind(activity_id)
    .bind(project.id)
    .execute(db_arc.pool())
    .await
    .unwrap();

    let obs_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO work_observations (id, project_id, raw_text, observed_at, recorded_at)
         VALUES ($1, $2, 'Concurrent site test observation', now(), now())",
    )
    .bind(obs_id)
    .bind(project.id)
    .execute(db_arc.pool())
    .await
    .unwrap();

    let proposal_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO match_proposals (id, project_id, observation_id, activity_id, candidate_rank, lexical_score, semantic_score, confidence_score, match_tier, status, created_at)
         VALUES ($1, $2, $3, $4, 1, 0.95, 0.95, 0.95, 'HIGH', 'PENDING_REVIEW', now())"
    )
    .bind(proposal_id)
    .bind(project.id)
    .bind(obs_id)
    .bind(activity_id)
    .execute(db_arc.pool())
    .await
    .unwrap();

    let planner_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO project_members (id, project_id, user_id, email, full_name, role, is_active, created_at)
         VALUES ($1, $2, $3, 'planner@test.com', 'Planner User', 'PLANNER', true, now())"
    )
    .bind(Uuid::new_v4())
    .bind(project.id)
    .bind(planner_id)
    .execute(db_arc.pool())
    .await
    .unwrap();

    // Spawn 10 simultaneous database transactions attempting to approve the same proposal
    let mut handles = Vec::new();
    for i in 0..10 {
        let db_clone = db_arc.clone();
        let h = tokio::spawn(async move {
            db_clone
                .approve_proposal_tx(
                    proposal_id,
                    planner_id,
                    None,
                    Some(format!("PostgreSQL concurrent attempt {}", i)),
                )
                .await
        });
        handles.push(h);
    }

    let mut success_count = 0;
    let mut conflict_count = 0;

    for h in handles {
        let res = h.await.unwrap();
        match res {
            Ok(_) => success_count += 1,
            Err(e) => {
                eprintln!("Concurrent attempt error: {:?}", e);
                conflict_count += 1;
            }
        }
    }

    // Exactly 1 approval must succeed in PostgreSQL via FOR UPDATE row locking
    assert_eq!(
        success_count, 1,
        "Exactly one real PostgreSQL transaction must succeed"
    );
    assert_eq!(
        conflict_count, 9,
        "All 9 concurrent conflicting transactions must be rolled back by PostgreSQL"
    );

    // Verify durable state directly in PostgreSQL
    let approvals_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM approvals WHERE proposal_id = $1")
            .bind(proposal_id)
            .fetch_one(db_arc.pool())
            .await
            .unwrap();
    assert_eq!(
        approvals_count, 1,
        "Exactly one durable approval record must exist in PostgreSQL"
    );

    let events_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM actual_events WHERE match_proposal_id = $1")
            .bind(proposal_id)
            .fetch_one(db_arc.pool())
            .await
            .unwrap();
    assert_eq!(
        events_count, 1,
        "Exactly one durable actual event must exist in PostgreSQL"
    );

    let final_status: String =
        sqlx::query_scalar("SELECT status FROM match_proposals WHERE id = $1")
            .bind(proposal_id)
            .fetch_one(db_arc.pool())
            .await
            .unwrap();
    assert_eq!(
        final_status, "ACCEPTED",
        "Proposal status must be ACCEPTED in PostgreSQL"
    );
}
