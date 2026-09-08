// =============================================================================
// Database Module - PostgreSQL Connection and Repository Operations
// =============================================================================

use anyhow::Result;
use chrono::Utc;
use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::domain::ledger::EventLedger;
use crate::domain::models::*;

/// Database connection pool wrapper providing transactional database access
#[derive(Clone)]
pub struct Database {
    pool: Arc<PgPool>,
}

impl Database {
    /// Create a new database connection pool
    pub async fn new(database_url: &str) -> Result<Self> {
        info!("Initializing PostgreSQL connection pool...");

        let pool = PgPoolOptions::new()
            .max_connections(20)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .idle_timeout(Some(std::time::Duration::from_secs(300)))
            .max_lifetime(Some(std::time::Duration::from_secs(3600)))
            .connect(database_url)
            .await
            .map_err(|e| {
                error!("Failed to create PostgreSQL connection pool: {}", e);
                e
            })?;

        // Test the connection
        sqlx::query_scalar::<_, i32>("SELECT 1")
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                error!("Failed to test PostgreSQL connection: {}", e);
                e
            })?;

        info!("PostgreSQL connection pool initialized successfully");

        Ok(Self {
            pool: Arc::new(pool),
        })
    }

    /// Access underlying PgPool
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Checks if essential tables exist in the connected database
    pub async fn check_schema_health(&self) -> Result<bool> {
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('projects', 'activities', 'work_observations', 'audit_events')",
        )
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        Ok(count >= 4)
    }

    /// Counts total projects currently in PostgreSQL
    pub async fn count_projects(&self) -> Result<i64> {
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM projects")
            .fetch_one(&*self.pool)
            .await?;
        Ok(count)
    }

    /// Loads all active projects from PostgreSQL
    pub async fn load_projects(&self) -> Result<Vec<Project>> {
        let rows = sqlx::query(
            "SELECT id, code, name, description, timezone, currency, created_at, updated_at FROM projects ORDER BY created_at DESC",
        )
        .fetch_all(&*self.pool)
        .await?;

        let mut projects = Vec::new();
        for r in rows {
            projects.push(Project {
                id: r.try_get("id")?,
                code: r.try_get("code")?,
                name: r.try_get("name")?,
                description: r.try_get("description")?,
                timezone: r.try_get("timezone")?,
                currency: r.try_get("currency")?,
                created_at: r.try_get("created_at")?,
                updated_at: r.try_get("updated_at")?,
            });
        }

        Ok(projects)
    }

    /// Fetches a single project by ID
    pub async fn get_project(&self, id: Uuid) -> Result<Option<Project>> {
        let row = sqlx::query(
            "SELECT id, code, name, description, timezone, currency, created_at, updated_at FROM projects WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&*self.pool)
        .await?;

        if let Some(r) = row {
            Ok(Some(Project {
                id: r.try_get("id")?,
                code: r.try_get("code")?,
                name: r.try_get("name")?,
                description: r.try_get("description")?,
                timezone: r.try_get("timezone")?,
                currency: r.try_get("currency")?,
                created_at: r.try_get("created_at")?,
                updated_at: r.try_get("updated_at")?,
            }))
        } else {
            Ok(None)
        }
    }

    /// Fetches the user role in a project from project_members table
    pub async fn get_project_member_role(&self, project_id: Uuid, user_id: Uuid) -> Result<Option<UserRole>> {
        let role_str: Option<String> = sqlx::query_scalar(
            "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2 AND is_active = true LIMIT 1",
        )
        .bind(project_id)
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await?;

        Ok(role_str.and_then(|r| crate::api::middleware::parse_role_from_str(&r)))
    }

    /// Transactionally creates a project with its initial membership, schedule version, WBS root, and activities
    pub async fn create_project_tx(
        &self,
        input: &ProjectCreateInput,
        creator_id: Uuid,
    ) -> Result<Project> {
        let mut tx = self.pool.begin().await?;

        let project_id = Uuid::new_v4();
        let code = input.code.trim().to_uppercase();
        let name = input.name.trim().to_string();
        let timezone = input.timezone.clone().unwrap_or_else(|| "Asia/Kolkata".to_string());
        let currency = input.currency.clone().unwrap_or_else(|| "INR".to_string());
        let now = Utc::now();

        // 1. Insert into projects
        sqlx::query(
            "INSERT INTO projects (id, code, name, description, timezone, currency, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
        )
        .bind(project_id)
        .bind(&code)
        .bind(&name)
        .bind(&input.description)
        .bind(&timezone)
        .bind(&currency)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // 2. Insert creator into project_members as ADMIN
        let member_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO project_members (id, project_id, user_id, email, full_name, role, is_active, created_at) VALUES ($1, $2, $3, $4, $5, 'ADMIN', true, $6)"
        )
        .bind(member_id)
        .bind(project_id)
        .bind(creator_id)
        .bind("lead.planner@nexora.ai")
        .bind("Lead Planner")
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // 3. Insert baseline schedule version
        let version_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO schedule_versions (id, project_id, version_number, version_label, version_type, is_active, created_at) VALUES ($1, $2, 1, 'Baseline Revision 0', 'BASELINE', true, $3)"
        )
        .bind(version_id)
        .bind(project_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // 4. Insert root WBS node
        let wbs_id = Uuid::new_v4();
        let root_wbs_code = format!("{}.1", code);
        sqlx::query(
            "INSERT INTO wbs_nodes (id, project_id, schedule_version_id, wbs_code, name, level, path, created_at) VALUES ($1, $2, $3, $4, 'General Execution', 1, $5, $6)"
        )
        .bind(wbs_id)
        .bind(project_id)
        .bind(version_id)
        .bind(&root_wbs_code)
        .bind(&root_wbs_code)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // 5. Insert baseline activities and initial state (if provided)
        if let Some(activities) = &input.baseline_activities {
            for act in activities {
                let activity_id = Uuid::new_v4();
                let discipline_str = serde_json::to_string(&act.discipline)?.trim_matches('"').to_string();

                sqlx::query(
                    "INSERT INTO activities (id, project_id, schedule_version_id, wbs_id, code, name, description, discipline, planned_start_date, planned_finish_date, planned_duration_days, planned_quantity, unit_of_measure, location, zone, equipment_tag, weightage, critical_path, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)"
                )
                .bind(activity_id)
                .bind(project_id)
                .bind(version_id)
                .bind(wbs_id)
                .bind(&act.code)
                .bind(&act.name)
                .bind(&act.description)
                .bind(&discipline_str)
                .bind(act.planned_start_date)
                .bind(act.planned_finish_date)
                .bind(act.planned_duration_days)
                .bind(act.planned_quantity)
                .bind(&act.unit_of_measure)
                .bind(&act.location)
                .bind(&act.zone)
                .bind(&act.equipment_tag)
                .bind(act.weightage.unwrap_or(1.0))
                .bind(act.critical_path.unwrap_or(false))
                .bind(now)
                .bind(now)
                .execute(&mut *tx)
                .await?;

                sqlx::query(
                    "INSERT INTO activity_current_state (activity_id, project_id, execution_status, current_progress_pct, cumulative_quantity, is_critical_path_delayed, variance_days, updated_at) VALUES ($1, $2, 'NOT_STARTED', 0.0, 0.0, false, 0, $3)"
                )
                .bind(activity_id)
                .bind(project_id)
                .bind(now)
                .execute(&mut *tx)
                .await?;
            }
        }

        // 6. Record initial audit event
        let audit_id = Uuid::new_v4();
        let payload_hash = EventLedger::compute_hash(
            &project_id,
            "CREATE_PROJECT",
            &serde_json::json!({
                "action": "CREATE_PROJECT",
                "project_id": project_id,
                "code": code,
            }),
            None,
            &now,
        );

        sqlx::query(
            "INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, actor_id, actor_role, payload_hash, previous_hash, created_at) VALUES ($1, $2, 'PROJECT', $3, 'CREATE_PROJECT', $4, 'ADMIN', $5, NULL, $6)"
        )
        .bind(audit_id)
        .bind(project_id)
        .bind(project_id)
        .bind(creator_id)
        .bind(&payload_hash)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(Project {
            id: project_id,
            code,
            name,
            description: input.description.clone(),
            timezone,
            currency,
            created_at: now,
            updated_at: now,
        })
    }

    /// Fetches all activities joined with current state for a project
    pub async fn list_activities_with_state(&self, project_id: Uuid) -> Result<Vec<ActivityWithState>> {
        let query = "
            SELECT 
                a.id as a_id, a.project_id, a.schedule_version_id, a.wbs_id, a.code, a.name, a.description,
                a.discipline, a.planned_start_date, a.planned_finish_date, a.planned_duration_days,
                a.planned_quantity, a.unit_of_measure, a.location, a.zone, a.equipment_tag, a.weightage,
                a.critical_path, a.created_at as a_created_at, a.updated_at as a_updated_at,
                s.execution_status, s.actual_start_date, s.actual_finish_date, s.current_progress_pct,
                s.cumulative_quantity, s.last_event_id, s.last_event_date, s.is_critical_path_delayed,
                s.variance_days, s.updated_at as s_updated_at
            FROM activities a
            LEFT JOIN activity_current_state s ON a.id = s.activity_id
            WHERE a.project_id = $1
            ORDER BY a.planned_start_date ASC";

        let rows = sqlx::query(query)
            .bind(project_id)
            .fetch_all(&*self.pool)
            .await?;

        let mut results = Vec::new();
        for r in rows {
            let disc_str: String = r.try_get("discipline")?;
            let discipline: Discipline = serde_json::from_value(serde_json::Value::String(disc_str))
                .unwrap_or(Discipline::General);

            let act = Activity {
                id: r.try_get("a_id")?,
                project_id: r.try_get("project_id")?,
                schedule_version_id: r.try_get("schedule_version_id")?,
                wbs_id: r.try_get("wbs_id")?,
                code: r.try_get("code")?,
                name: r.try_get("name")?,
                description: r.try_get("description")?,
                discipline,
                planned_start_date: r.try_get("planned_start_date")?,
                planned_finish_date: r.try_get("planned_finish_date")?,
                planned_duration_days: r.try_get("planned_duration_days")?,
                planned_quantity: r.try_get("planned_quantity")?,
                unit_of_measure: r.try_get("unit_of_measure")?,
                location: r.try_get("location")?,
                zone: r.try_get("zone")?,
                equipment_tag: r.try_get("equipment_tag")?,
                weightage: r.try_get("weightage")?,
                critical_path: r.try_get("critical_path")?,
            };

            let state = if let Ok(status_str) = r.try_get::<String, _>("execution_status") {
                let execution_status: ExecutionStatus = serde_json::from_value(serde_json::Value::String(status_str))
                    .unwrap_or(ExecutionStatus::NotStarted);
                Some(ActivityCurrentState {
                    activity_id: act.id,
                    project_id,
                    execution_status,
                    actual_start_date: r.try_get("actual_start_date").ok(),
                    actual_finish_date: r.try_get("actual_finish_date").ok(),
                    current_progress_pct: r.try_get("current_progress_pct").unwrap_or(0.0),
                    cumulative_quantity: r.try_get("cumulative_quantity").unwrap_or(0.0),
                    last_event_id: r.try_get("last_event_id").ok(),
                    last_event_date: r.try_get("last_event_date").ok(),
                    is_critical_path_delayed: r.try_get("is_critical_path_delayed").unwrap_or(false),
                    variance_days: r.try_get("variance_days").unwrap_or(0),
                    updated_at: r.try_get("s_updated_at").unwrap_or_else(|_| chrono::Utc::now()),
                })
            } else {
                None
            };

            results.push(ActivityWithState { activity: act, state });
        }

        Ok(results)
    }

    /// Persists a work observation into PostgreSQL
    pub async fn insert_observation(&self, obs: &WorkObservation) -> Result<()> {
        let disc_str = obs.discipline.map(|d| serde_json::to_string(&d).unwrap_or_default().trim_matches('"').to_string());
        let event_type_str = obs.event_type.map(|e| serde_json::to_string(&e).unwrap_or_default().trim_matches('"').to_string());

        sqlx::query(
            "INSERT INTO work_observations (id, project_id, document_id, reported_by, observed_at, recorded_at, discipline, location, zone, equipment_tag, raw_text, normalized_text, event_type, reported_progress, reported_quantity, unit_of_measure, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             ON CONFLICT (id) DO NOTHING"
        )
        .bind(obs.id)
        .bind(obs.project_id)
        .bind(obs.document_id)
        .bind(obs.reported_by)
        .bind(obs.observed_at)
        .bind(obs.recorded_at)
        .bind(disc_str)
        .bind(&obs.location)
        .bind(&obs.zone)
        .bind(&obs.equipment_tag)
        .bind(&obs.raw_text)
        .bind(&obs.normalized_text)
        .bind(event_type_str)
        .bind(obs.reported_progress)
        .bind(obs.reported_quantity)
        .bind(&obs.unit_of_measure)
        .bind(&obs.metadata)
        .execute(&*self.pool)
        .await?;

        Ok(())
    }

    /// Fetches observations for a project
    pub async fn list_observations(&self, project_id: Uuid, limit: i64, offset: i64) -> Result<Vec<WorkObservation>> {
        let rows = sqlx::query(
            "SELECT id, project_id, document_id, reported_by, observed_at, recorded_at, discipline, location, zone, equipment_tag, raw_text, normalized_text, event_type, reported_progress, reported_quantity, unit_of_measure, metadata
             FROM work_observations WHERE project_id = $1 ORDER BY recorded_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(project_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await?;

        let mut list = Vec::new();
        for r in rows {
            let disc: Option<Discipline> = r.try_get::<Option<String>, _>("discipline")?
                .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok());
            let event_type: Option<EventType> = r.try_get::<Option<String>, _>("event_type")?
                .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok());

            list.push(WorkObservation {
                id: r.try_get("id")?,
                project_id: r.try_get("project_id")?,
                document_id: r.try_get("document_id")?,
                reported_by: r.try_get("reported_by")?,
                observed_at: r.try_get("observed_at")?,
                recorded_at: r.try_get("recorded_at")?,
                discipline: disc,
                location: r.try_get("location")?,
                zone: r.try_get("zone")?,
                equipment_tag: r.try_get("equipment_tag")?,
                raw_text: r.try_get("raw_text")?,
                normalized_text: r.try_get("normalized_text")?,
                event_type,
                reported_progress: r.try_get("reported_progress")?,
                reported_quantity: r.try_get("reported_quantity")?,
                unit_of_measure: r.try_get("unit_of_measure")?,
                metadata: r.try_get("metadata").unwrap_or_else(|_| serde_json::json!({})),
            });
        }

        Ok(list)
    }

    /// Transactionally approves a match proposal: inserts approval, actual event, updates activity current state, records audit and outbox
    pub async fn approve_proposal_tx(
        &self,
        proposal_id: Uuid,
        reviewer_id: Uuid,
        override_activity_id: Option<Uuid>,
        comments: Option<String>,
    ) -> Result<Uuid> {
        let mut tx = self.pool.begin().await?;

        // 1. Lock proposal
        let prop_row = sqlx::query(
            "SELECT project_id, observation_id, activity_id, status FROM match_proposals WHERE id = $1 FOR UPDATE"
        )
        .bind(proposal_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Proposal not found"))?;

        let status: String = prop_row.try_get("status")?;
        if status == "ACCEPTED" {
            return Err(anyhow::anyhow!("Proposal has already been approved"));
        }

        let project_id: Uuid = prop_row.try_get("project_id")?;
        let obs_id: Uuid = prop_row.try_get("observation_id")?;
        let orig_act_id: Uuid = prop_row.try_get("activity_id")?;
        let target_act_id = override_activity_id.unwrap_or(orig_act_id);

        // 2. Lock target activity current state
        let act_state_row = sqlx::query(
            "SELECT current_progress_pct, execution_status, actual_start_date FROM activity_current_state WHERE activity_id = $1 FOR UPDATE"
        )
        .bind(target_act_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Activity state not found"))?;

        let current_progress: f64 = act_state_row.try_get("current_progress_pct")?;
        let existing_start: Option<chrono::NaiveDate> = act_state_row.try_get("actual_start_date")?;

        let now = Utc::now();
        let actual_date = now.date_naive();
        let new_progress = 100.0f64.max(current_progress);
        let new_status = "COMPLETED";

        let event_id = Uuid::new_v4();
        let idempotency_key = format!("event-{}-{}-{}", target_act_id, actual_date, proposal_id);

        // 3. Insert into actual_events
        sqlx::query(
            "INSERT INTO actual_events (id, project_id, activity_id, observation_id, match_proposal_id, event_type, actual_date, actual_progress_pct, lifecycle_status, verification_status, idempotency_key, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, 'FINISH', $6, $7, 'COMMITTED', 'HUMAN_VERIFIED', $8, $9, $10)"
        )
        .bind(event_id)
        .bind(project_id)
        .bind(target_act_id)
        .bind(obs_id)
        .bind(proposal_id)
        .bind(actual_date)
        .bind(new_progress)
        .bind(&idempotency_key)
        .bind(reviewer_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // 4. Update activity_current_state
        let start_date = existing_start.unwrap_or(actual_date);
        sqlx::query(
            "UPDATE activity_current_state SET execution_status = $1, actual_start_date = $2, actual_finish_date = $3, current_progress_pct = $4, last_event_id = $5, last_event_date = $6, updated_at = $7 WHERE activity_id = $8"
        )
        .bind(new_status)
        .bind(start_date)
        .bind(actual_date)
        .bind(new_progress)
        .bind(event_id)
        .bind(actual_date)
        .bind(now)
        .bind(target_act_id)
        .execute(&mut *tx)
        .await?;

        // 5. Insert approval
        let approval_id = Uuid::new_v4();
        let action = if override_activity_id.is_some() { "OVERRIDE" } else { "APPROVE" };
        sqlx::query(
            "INSERT INTO approvals (id, project_id, event_id, proposal_id, action, reviewed_by, reviewed_at, selected_activity_id, comments)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
        )
        .bind(approval_id)
        .bind(project_id)
        .bind(event_id)
        .bind(proposal_id)
        .bind(action)
        .bind(reviewer_id)
        .bind(now)
        .bind(target_act_id)
        .bind(comments.unwrap_or_else(|| "Approved via Trust Plane".to_string()))
        .execute(&mut *tx)
        .await?;

        // 6. Update proposal status
        sqlx::query("UPDATE match_proposals SET status = 'ACCEPTED' WHERE id = $1")
            .bind(proposal_id)
            .execute(&mut *tx)
            .await?;

        // 7. Insert Audit Event with hash
        let prev_hash: Option<String> = sqlx::query_scalar(
            "SELECT payload_hash FROM audit_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await?;

        let audit_id = Uuid::new_v4();
        let payload_hash = EventLedger::compute_hash(
            &target_act_id,
            "APPROVE_PROPOSAL",
            &serde_json::json!({
                "proposal_id": proposal_id,
                "event_id": event_id,
                "progress_pct": new_progress,
                "status": new_status,
            }),
            prev_hash.as_deref(),
            &now,
        );

        sqlx::query(
            "INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, actor_id, actor_role, payload_hash, previous_hash, created_at)
             VALUES ($1, $2, 'PROPOSAL', $3, 'APPROVE_PROPOSAL', $4, 'PLANNER', $5, $6, $7)"
        )
        .bind(audit_id)
        .bind(project_id)
        .bind(proposal_id)
        .bind(reviewer_id)
        .bind(&payload_hash)
        .bind(prev_hash)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // 8. Insert Outbox Event with dedicated routing key
        let outbox_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO outbox_events (id, project_id, event_type, payload, status, retry_count, created_at)
             VALUES ($1, $2, 'PROPOSAL_APPROVED', $3, 'PENDING', 0, $4)"
        )
        .bind(outbox_id)
        .bind(project_id)
        .bind(serde_json::json!({
            "event_id": event_id,
            "project_id": project_id,
            "activity_id": target_act_id,
            "actual_date": actual_date,
            "progress_pct": new_progress,
        }))
        .bind(now)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(event_id)
    }

    /// Fetches audit trail from PostgreSQL
    pub async fn list_audit_trail(&self, project_id: Uuid, limit: i64, offset: i64) -> Result<Vec<AuditEvent>> {
        let rows = sqlx::query(
            "SELECT id, project_id, entity_type, entity_id, action, actor_id, actor_role, before_state, after_state, payload_hash, previous_hash, created_at
             FROM audit_events WHERE project_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3"
        )
        .bind(project_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await?;

        let mut list = Vec::new();
        for r in rows {
            list.push(AuditEvent {
                id: r.try_get("id")?,
                project_id: r.try_get("project_id")?,
                entity_type: r.try_get("entity_type")?,
                entity_id: r.try_get("entity_id")?,
                action: r.try_get("action")?,
                actor_id: r.try_get("actor_id")?,
                actor_role: r.try_get("actor_role")?,
                before_state: r.try_get("before_state").ok(),
                after_state: r.try_get("after_state").ok(),
                payload_hash: r.try_get("payload_hash")?,
                previous_hash: r.try_get("previous_hash")?,
                created_at: r.try_get("created_at")?,
            });
        }

        Ok(list)
    }

    /// Verifies the cryptographic integrity of the entire audit chain in PostgreSQL
    pub async fn verify_audit_chain(&self, project_id: Uuid) -> Result<Result<(), usize>> {
        let events = self.list_audit_trail(project_id, 10000, 0).await?;
        Ok(EventLedger::verify_chain_integrity(&events))
    }
}
