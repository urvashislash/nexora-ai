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
    pub async fn get_project_member_role(
        &self,
        project_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<UserRole>> {
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
        creator_email: Option<&str>,
        creator_name: Option<&str>,
    ) -> Result<Project> {
        let mut tx = self.pool.begin().await?;

        let project_id = Uuid::new_v4();
        let code = input.code.trim().to_uppercase();
        let name = input.name.trim().to_string();
        let timezone = input
            .timezone
            .clone()
            .unwrap_or_else(|| "Asia/Kolkata".to_string());
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
        let default_email = format!("user-{}@nexora.ai", &creator_id.to_string()[..8]);
        let member_email = creator_email.unwrap_or(&default_email);
        let member_name = creator_name.unwrap_or("Project Admin");

        sqlx::query(
            "INSERT INTO project_members (id, project_id, user_id, email, full_name, role, is_active, created_at) VALUES ($1, $2, $3, $4, $5, 'ADMIN', true, $6)"
        )
        .bind(member_id)
        .bind(project_id)
        .bind(creator_id)
        .bind(member_email)
        .bind(member_name)
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
                let discipline_str = serde_json::to_string(&act.discipline)?
                    .trim_matches('"')
                    .to_string();

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
    pub async fn list_activities_with_state(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<ActivityWithState>> {
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
            let discipline: Discipline =
                serde_json::from_value(serde_json::Value::String(disc_str))
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
                let execution_status: ExecutionStatus =
                    serde_json::from_value(serde_json::Value::String(status_str))
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
                    is_critical_path_delayed: r
                        .try_get("is_critical_path_delayed")
                        .unwrap_or(false),
                    variance_days: r.try_get("variance_days").unwrap_or(0),
                    updated_at: r
                        .try_get("s_updated_at")
                        .unwrap_or_else(|_| chrono::Utc::now()),
                })
            } else {
                None
            };

            results.push(ActivityWithState {
                activity: act,
                state,
            });
        }

        Ok(results)
    }

    /// Persists a work observation into PostgreSQL
    pub async fn insert_observation(&self, obs: &WorkObservation) -> Result<()> {
        let disc_str = obs.discipline.map(|d| {
            serde_json::to_string(&d)
                .unwrap_or_default()
                .trim_matches('"')
                .to_string()
        });
        let event_type_str = obs.event_type.map(|e| {
            serde_json::to_string(&e)
                .unwrap_or_default()
                .trim_matches('"')
                .to_string()
        });

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
    pub async fn list_observations(
        &self,
        project_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<WorkObservation>> {
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
            let disc: Option<Discipline> = r
                .try_get::<Option<String>, _>("discipline")?
                .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok());
            let event_type: Option<EventType> = r
                .try_get::<Option<String>, _>("event_type")?
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
                metadata: r
                    .try_get("metadata")
                    .unwrap_or_else(|_| serde_json::json!({})),
            });
        }

        Ok(list)
    }

    /// Transactionally persists an observation and records an immutable SHA-256 audit entry
    pub async fn create_observation_tx(
        &self,
        obs: &WorkObservation,
        actor_id: Option<Uuid>,
        actor_role: Option<&str>,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        let disc_str = obs.discipline.map(|d| {
            serde_json::to_string(&d)
                .unwrap_or_default()
                .trim_matches('"')
                .to_string()
        });
        let event_type_str = obs.event_type.map(|e| {
            serde_json::to_string(&e)
                .unwrap_or_default()
                .trim_matches('"')
                .to_string()
        });

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
        .execute(&mut *tx)
        .await?;

        let prev_hash: Option<String> = sqlx::query_scalar(
            "SELECT payload_hash FROM audit_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(obs.project_id)
        .fetch_optional(&mut *tx)
        .await?;

        let now = Utc::now();
        let payload_hash = EventLedger::compute_hash(
            &obs.id,
            "CREATE_OBSERVATION",
            &serde_json::json!({
                "raw_text": obs.raw_text,
                "discipline": obs.discipline,
                "progress": obs.reported_progress,
                "location": obs.location,
            }),
            prev_hash.as_deref(),
            &now,
        );

        let audit_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, actor_id, actor_role, payload_hash, previous_hash, created_at)
             VALUES ($1, $2, 'WORK_OBSERVATION', $3, 'CREATE_OBSERVATION', $4, $5, $6, $7, $8)"
        )
        .bind(audit_id)
        .bind(obs.project_id)
        .bind(obs.id)
        .bind(actor_id)
        .bind(actor_role.unwrap_or("SUPERVISOR"))
        .bind(&payload_hash)
        .bind(prev_hash)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    /// Fetches all actual events for a project
    pub async fn list_actual_events(
        &self,
        project_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ActualEvent>> {
        let rows = sqlx::query(
            "SELECT id, project_id, activity_id, observation_id, match_proposal_id, event_type, actual_date, actual_progress_pct, actual_quantity, delay_reason, delay_days, lifecycle_status, verification_status, idempotency_key, created_by, created_at
             FROM actual_events WHERE project_id = $1 ORDER BY actual_date DESC, created_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(project_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await?;

        let mut events = Vec::new();
        for r in rows {
            let evt_type_str: String = r.try_get("event_type")?;
            let lifecycle_str: String = r.try_get("lifecycle_status")?;
            let verif_str: String = r.try_get("verification_status")?;

            let event_type = match evt_type_str.to_uppercase().as_str() {
                "START" => EventType::Start,
                "PROGRESS" => EventType::Progress,
                "FINISH" => EventType::Finish,
                "DELAY" => EventType::Delay,
                "BLOCKER" => EventType::Blocker,
                "INSPECTION" => EventType::Inspection,
                _ => EventType::Finish,
            };

            let lifecycle_status = match lifecycle_str.to_uppercase().as_str() {
                "PROPOSED" => LifecycleStatus::Proposed,
                "MATCHED" => LifecycleStatus::Matched,
                "REVIEW_REQUIRED" => LifecycleStatus::ReviewRequired,
                "APPROVED" => LifecycleStatus::Approved,
                "COMMITTED" => LifecycleStatus::Committed,
                "REJECTED" => LifecycleStatus::Rejected,
                _ => LifecycleStatus::Committed,
            };

            let verification_status = match verif_str.to_uppercase().as_str() {
                "SYSTEM_VERIFIED" => VerificationStatus::SystemVerified,
                "HUMAN_VERIFIED" => VerificationStatus::HumanVerified,
                _ => VerificationStatus::Unverified,
            };

            events.push(ActualEvent {
                id: r.try_get("id")?,
                project_id: r.try_get("project_id")?,
                activity_id: r.try_get("activity_id")?,
                observation_id: r.try_get("observation_id")?,
                match_proposal_id: r.try_get("match_proposal_id")?,
                event_type,
                actual_date: r.try_get("actual_date")?,
                actual_progress_pct: r.try_get("actual_progress_pct")?,
                actual_quantity: r.try_get("actual_quantity")?,
                delay_reason: r.try_get("delay_reason")?,
                delay_days: r.try_get("delay_days")?,
                lifecycle_status,
                verification_status,
                idempotency_key: r.try_get("idempotency_key")?,
                created_by: r.try_get("created_by")?,
                created_at: r.try_get("created_at")?,
            });
        }
        Ok(events)
    }

    /// Atomically persists an AI processing result into PostgreSQL
    pub async fn ingest_ai_result_tx(
        &self,
        project_id: Uuid,
        job_id: Option<&str>,
        observations: &[WorkObservation],
        proposals: &[MatchProposal],
        auto_events: &[(ActualEvent, Option<chrono::NaiveDate>)],
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        // 1. Insert observations
        for obs in observations {
            let disc_str = obs.discipline.map(|d| {
                serde_json::to_string(&d)
                    .unwrap_or_default()
                    .trim_matches('"')
                    .to_string()
            });
            let evt_str = obs.event_type.map(|e| {
                serde_json::to_string(&e)
                    .unwrap_or_default()
                    .trim_matches('"')
                    .to_string()
            });
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
            .bind(evt_str)
            .bind(obs.reported_progress)
            .bind(obs.reported_quantity)
            .bind(&obs.unit_of_measure)
            .bind(&obs.metadata)
            .execute(&mut *tx)
            .await?;
        }

        // 2. Insert proposals
        for prop in proposals {
            let tier_str = serde_json::to_string(&prop.match_tier)
                .unwrap_or_else(|_| "\"MEDIUM\"".to_string())
                .trim_matches('"')
                .to_string();

            sqlx::query(
                "INSERT INTO match_proposals (id, project_id, observation_id, activity_id, candidate_rank, lexical_score, semantic_score, context_boost, confidence_score, match_tier, explanation, evidence_snippet, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 ON CONFLICT (id) DO NOTHING"
            )
            .bind(prop.id)
            .bind(prop.project_id)
            .bind(prop.observation_id)
            .bind(prop.activity_id)
            .bind(prop.candidate_rank)
            .bind(prop.lexical_score)
            .bind(prop.semantic_score)
            .bind(prop.context_boost)
            .bind(prop.confidence_score)
            .bind(&tier_str)
            .bind(&prop.explanation)
            .bind(&prop.evidence_snippet)
            .bind(&prop.status)
            .bind(prop.created_at)
            .execute(&mut *tx)
            .await?;
        }

        // 3. Insert auto-linked actual events and update activity current state
        let now = Utc::now();
        for (evt, planned_finish) in auto_events {
            let evt_type_str = serde_json::to_string(&evt.event_type)
                .unwrap_or_else(|_| "\"FINISH\"".to_string())
                .trim_matches('"')
                .to_string();
            let lifecycle_str = serde_json::to_string(&evt.lifecycle_status)
                .unwrap_or_else(|_| "\"COMMITTED\"".to_string())
                .trim_matches('"')
                .to_string();
            let verif_str = serde_json::to_string(&evt.verification_status)
                .unwrap_or_else(|_| "\"SYSTEM_VERIFIED\"".to_string())
                .trim_matches('"')
                .to_string();

            sqlx::query(
                "INSERT INTO actual_events (id, project_id, activity_id, observation_id, match_proposal_id, event_type, actual_date, actual_progress_pct, actual_quantity, delay_reason, delay_days, lifecycle_status, verification_status, idempotency_key, created_by, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 ON CONFLICT (id) DO NOTHING"
            )
            .bind(evt.id)
            .bind(evt.project_id)
            .bind(evt.activity_id)
            .bind(evt.observation_id)
            .bind(evt.match_proposal_id)
            .bind(&evt_type_str)
            .bind(evt.actual_date)
            .bind(evt.actual_progress_pct)
            .bind(evt.actual_quantity)
            .bind(&evt.delay_reason)
            .bind(evt.delay_days)
            .bind(&lifecycle_str)
            .bind(&verif_str)
            .bind(&evt.idempotency_key)
            .bind(evt.created_by)
            .bind(evt.created_at)
            .execute(&mut *tx)
            .await?;

            let progress = evt.actual_progress_pct.unwrap_or(100.0);
            let exec_status = if progress >= 100.0 {
                "COMPLETED"
            } else {
                "IN_PROGRESS"
            };
            let variance_days = planned_finish
                .map(|pf| (evt.actual_date - pf).num_days() as i32)
                .unwrap_or(0);

            sqlx::query(
                "UPDATE activity_current_state SET execution_status = $1, actual_finish_date = $2, current_progress_pct = GREATEST(current_progress_pct, $3), last_event_id = $4, last_event_date = $5, variance_days = $6, updated_at = $7 WHERE activity_id = $8"
            )
            .bind(exec_status)
            .bind(evt.actual_date)
            .bind(progress)
            .bind(evt.id)
            .bind(evt.actual_date)
            .bind(variance_days)
            .bind(now)
            .bind(evt.activity_id)
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                "INSERT INTO outbox_events (id, project_id, event_type, payload, status, retry_count, created_at)
                 VALUES ($1, $2, 'AUTO_LINKED_EVENT', $3, 'PENDING', 0, $4)"
            )
            .bind(Uuid::new_v4())
            .bind(project_id)
            .bind(serde_json::to_value(evt).unwrap_or(serde_json::json!({})))
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }

        // 4. Update document_jobs if job_id was provided
        if let Some(jid) = job_id {
            if let Ok(job_uuid) = Uuid::parse_str(jid) {
                sqlx::query(
                    "UPDATE document_jobs SET status = 'COMPLETED', completed_at = $1 WHERE id = $2"
                )
                .bind(now)
                .bind(job_uuid)
                .execute(&mut *tx)
                .await?;
            }
        }

        // 5. Insert audit event
        let prev_hash: Option<String> = sqlx::query_scalar(
            "SELECT payload_hash FROM audit_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await?;

        let audit_id = Uuid::new_v4();
        let payload_hash = EventLedger::compute_hash(
            &project_id,
            "INGEST_AI_RESULT",
            &serde_json::json!({
                "job_id": job_id,
                "observations_count": observations.len(),
                "proposals_count": proposals.len(),
                "auto_linked_count": auto_events.len(),
            }),
            prev_hash.as_deref(),
            &now,
        );

        sqlx::query(
            "INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, actor_id, actor_role, payload_hash, previous_hash, created_at)
             VALUES ($1, $2, 'AI_INGEST', $3, 'INGEST_AI_RESULT', NULL, 'AI_WORKER', $4, $5, $6)"
        )
        .bind(audit_id)
        .bind(project_id)
        .bind(audit_id)
        .bind(&payload_hash)
        .bind(prev_hash)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
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
        let existing_start: Option<chrono::NaiveDate> =
            act_state_row.try_get("actual_start_date")?;

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
        let action = if override_activity_id.is_some() {
            "OVERRIDE"
        } else {
            "APPROVE"
        };
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
    pub async fn list_audit_trail(
        &self,
        project_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<AuditEvent>> {
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
    pub async fn verify_audit_chain(
        &self,
        project_id: Uuid,
    ) -> Result<(bool, usize, Option<usize>)> {
        let events = self.list_audit_trail(project_id, 10000, 0).await?;
        let count = events.len();
        match EventLedger::verify_chain_integrity(&events) {
            Ok(()) => Ok((true, count, None)),
            Err(broken_idx) => Ok((false, count, Some(broken_idx))),
        }
    }

    /// Computes dashboard KPIs directly from PostgreSQL projections
    pub async fn get_dashboard_kpis(
        &self,
        project_id: Uuid,
    ) -> Result<crate::api::dashboard::DashboardKPIs> {
        let obs_count: i64 =
            sqlx::query_scalar("SELECT count(*) FROM work_observations WHERE project_id = $1")
                .bind(project_id)
                .fetch_one(&*self.pool)
                .await?;

        let events_count: i64 =
            sqlx::query_scalar("SELECT count(*) FROM actual_events WHERE project_id = $1")
                .bind(project_id)
                .fetch_one(&*self.pool)
                .await?;

        let prop_row = sqlx::query(
            "SELECT 
                count(*) FILTER (WHERE status = 'AUTO_LINKED') as auto_linked,
                count(*) FILTER (WHERE status = 'PENDING_REVIEW') as review_queue,
                count(*) FILTER (WHERE match_tier = 'UNMATCHED') as unmatched
             FROM match_proposals WHERE project_id = $1",
        )
        .bind(project_id)
        .fetch_one(&*self.pool)
        .await?;

        let auto_linked: i64 = prop_row.try_get("auto_linked")?;
        let review_queue: i64 = prop_row.try_get("review_queue")?;
        let unmatched: i64 = prop_row.try_get("unmatched")?;

        let act_row = sqlx::query(
            "SELECT 
                count(*) FILTER (WHERE execution_status = 'COMPLETED') as completed,
                count(*) FILTER (WHERE execution_status = 'IN_PROGRESS') as in_progress,
                coalesce(sum(current_progress_pct), 0.0) as total_progress,
                count(*) as total_count
             FROM activity_current_state WHERE project_id = $1",
        )
        .bind(project_id)
        .fetch_one(&*self.pool)
        .await?;

        let completed: i64 = act_row.try_get("completed")?;
        let in_progress: i64 = act_row.try_get("in_progress")?;
        let total_progress: f64 = act_row.try_get("total_progress")?;
        let total_count: i64 = act_row.try_get("total_count")?;

        let overall_pct = if total_count > 0 {
            total_progress / (total_count as f64)
        } else {
            0.0
        };

        Ok(crate::api::dashboard::DashboardKPIs {
            total_observations: obs_count as usize,
            extracted_events: events_count as usize,
            auto_linked_events: auto_linked as usize,
            review_queue_count: review_queue as usize,
            unmatched_count: unmatched as usize,
            completed_activities: completed as usize,
            in_progress_activities: in_progress as usize,
            overall_progress_pct: (overall_pct * 100.0).round() / 100.0,
        })
    }

    /// Fetches review queue items with joined observation and activity from PostgreSQL
    pub async fn list_review_queue(&self, project_id: Uuid) -> Result<Vec<ReviewQueueItem>> {
        let rows = sqlx::query(
            "SELECT 
                mp.id, mp.project_id, mp.observation_id, mp.activity_id, mp.candidate_rank,
                mp.lexical_score, mp.semantic_score, mp.context_boost, mp.confidence_score,
                mp.match_tier, mp.explanation, mp.evidence_snippet, mp.status, mp.created_at,
                wo.raw_text as obs_raw_text, wo.normalized_text as obs_normalized_text,
                wo.discipline as obs_discipline, wo.location as obs_location, wo.zone as obs_zone,
                wo.equipment_tag as obs_equipment_tag, wo.event_type as obs_event_type,
                wo.reported_progress as obs_reported_progress, wo.reported_quantity as obs_reported_quantity,
                wo.unit_of_measure as obs_unit_of_measure, wo.metadata as obs_metadata,
                wo.observed_at as obs_observed_at, wo.recorded_at as obs_recorded_at,
                a.code as act_code, a.name as act_name, a.discipline as act_discipline,
                a.planned_start_date as act_start, a.planned_finish_date as act_finish,
                a.planned_duration_days as act_duration, a.weightage as act_weightage,
                a.critical_path as act_critical
             FROM match_proposals mp
             LEFT JOIN work_observations wo ON mp.observation_id = wo.id
             LEFT JOIN activities a ON mp.activity_id = a.id
             WHERE mp.project_id = $1 AND mp.status = 'PENDING_REVIEW'
             ORDER BY mp.created_at DESC"
        )
        .bind(project_id)
        .fetch_all(&*self.pool)
        .await?;

        let mut items = Vec::new();
        for r in rows {
            let match_tier_str: String = r.try_get("match_tier")?;
            let match_tier = match match_tier_str.to_uppercase().as_str() {
                "HIGH" => MatchTier::High,
                "MEDIUM" => MatchTier::Medium,
                "LOW" => MatchTier::Low,
                _ => MatchTier::Unmatched,
            };

            let proposal = MatchProposal {
                id: r.try_get("id")?,
                project_id: r.try_get("project_id")?,
                observation_id: r.try_get("observation_id")?,
                activity_id: r.try_get("activity_id")?,
                candidate_rank: r.try_get("candidate_rank")?,
                lexical_score: r.try_get("lexical_score")?,
                semantic_score: r.try_get("semantic_score")?,
                context_boost: r.try_get("context_boost")?,
                confidence_score: r.try_get("confidence_score")?,
                match_tier,
                explanation: r.try_get("explanation").ok(),
                evidence_snippet: r.try_get("evidence_snippet").ok(),
                status: r.try_get("status")?,
                created_at: r.try_get("created_at")?,
            };

            let observation = if let Ok(raw_text) = r.try_get::<String, _>("obs_raw_text") {
                let disc: Option<Discipline> = r
                    .try_get::<Option<String>, _>("obs_discipline")?
                    .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok());
                let evt: Option<EventType> = r
                    .try_get::<Option<String>, _>("obs_event_type")?
                    .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok());

                Some(WorkObservation {
                    id: proposal.observation_id,
                    project_id,
                    document_id: None,
                    reported_by: None,
                    observed_at: r.try_get("obs_observed_at").ok().flatten(),
                    recorded_at: r.try_get("obs_recorded_at").unwrap_or_else(|_| Utc::now()),
                    discipline: disc,
                    location: r.try_get("obs_location").ok().flatten(),
                    zone: r.try_get("obs_zone").ok().flatten(),
                    equipment_tag: r.try_get("obs_equipment_tag").ok().flatten(),
                    raw_text,
                    normalized_text: r.try_get("obs_normalized_text").ok().flatten(),
                    event_type: evt,
                    reported_progress: r.try_get("obs_reported_progress").ok().flatten(),
                    reported_quantity: r.try_get("obs_reported_quantity").ok().flatten(),
                    unit_of_measure: r.try_get("obs_unit_of_measure").ok().flatten(),
                    metadata: r
                        .try_get("obs_metadata")
                        .unwrap_or_else(|_| serde_json::json!({})),
                })
            } else {
                None
            };

            let activity = if let Ok(code) = r.try_get::<String, _>("act_code") {
                let disc_str: String = r.try_get("act_discipline")?;
                let discipline = serde_json::from_value(serde_json::Value::String(disc_str))
                    .unwrap_or(Discipline::General);

                Some(Activity {
                    id: proposal.activity_id,
                    project_id,
                    schedule_version_id: Uuid::nil(),
                    wbs_id: Uuid::nil(),
                    code,
                    name: r.try_get("act_name")?,
                    description: None,
                    discipline,
                    planned_start_date: r.try_get("act_start")?,
                    planned_finish_date: r.try_get("act_finish")?,
                    planned_duration_days: r.try_get("act_duration")?,
                    planned_quantity: None,
                    unit_of_measure: None,
                    location: None,
                    zone: None,
                    equipment_tag: None,
                    weightage: r.try_get("act_weightage").unwrap_or(1.0),
                    critical_path: r.try_get("act_critical").unwrap_or(false),
                })
            } else {
                None
            };

            items.push(ReviewQueueItem {
                proposal,
                observation,
                activity,
            });
        }

        Ok(items)
    }

    /// Transactionally rejects a match proposal
    pub async fn reject_proposal_tx(
        &self,
        proposal_id: Uuid,
        reviewer_id: Uuid,
        comments: Option<String>,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        let prop_row =
            sqlx::query("SELECT project_id, status FROM match_proposals WHERE id = $1 FOR UPDATE")
                .bind(proposal_id)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or_else(|| anyhow::anyhow!("Proposal not found"))?;

        let project_id: Uuid = prop_row.try_get("project_id")?;
        let status: String = prop_row.try_get("status")?;
        if status == "REJECTED" {
            return Ok(());
        }

        sqlx::query("UPDATE match_proposals SET status = 'REJECTED' WHERE id = $1")
            .bind(proposal_id)
            .execute(&mut *tx)
            .await?;

        let approval_id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO approvals (id, project_id, proposal_id, action, reviewed_by, reviewed_at, comments)
             VALUES ($1, $2, $3, 'REJECT', $4, $5, $6)"
        )
        .bind(approval_id)
        .bind(project_id)
        .bind(proposal_id)
        .bind(reviewer_id)
        .bind(now)
        .bind(comments.as_deref().unwrap_or("Rejected via Trust Plane"))
        .execute(&mut *tx)
        .await?;

        let prev_hash: Option<String> = sqlx::query_scalar(
            "SELECT payload_hash FROM audit_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await?;

        let audit = EventLedger::create_audit_event(
            project_id,
            "PROPOSAL_REJECTION",
            proposal_id,
            "REJECT",
            Some(reviewer_id),
            Some("PLANNER"),
            Some(serde_json::json!({"status": "PENDING_REVIEW"})),
            Some(serde_json::json!({"status": "REJECTED", "comments": comments})),
            prev_hash.as_deref(),
        );

        sqlx::query(
            "INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, actor_id, actor_role, before_state, after_state, payload_hash, previous_hash, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"
        )
        .bind(audit.id)
        .bind(audit.project_id)
        .bind(&audit.entity_type)
        .bind(audit.entity_id)
        .bind(&audit.action)
        .bind(audit.actor_id)
        .bind(&audit.actor_role)
        .bind(&audit.before_state)
        .bind(&audit.after_state)
        .bind(&audit.payload_hash)
        .bind(&audit.previous_hash)
        .bind(audit.created_at)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    /// Creates a document record and an associated durable document_jobs entry transactionally
    pub async fn create_document_and_job(
        &self,
        project_id: Uuid,
        input: &DocumentCreateInput,
        uploaded_by: Option<Uuid>,
    ) -> Result<(Document, DocumentJob)> {
        let mut tx = self.pool.begin().await?;

        let doc_id = Uuid::new_v4();
        let now = Utc::now();
        let mime_type = input
            .mime_type
            .clone()
            .unwrap_or_else(|| "application/octet-stream".to_string());
        let storage_bucket = input
            .storage_bucket
            .clone()
            .unwrap_or_else(|| "evidence-documents".to_string());
        let storage_key = input.storage_key.clone().unwrap_or_else(|| {
            format!(
                "{}/reports/{}_{}",
                project_id,
                now.timestamp(),
                input.filename
            )
        });
        let source_type = input
            .source_type
            .clone()
            .unwrap_or_else(|| "DAILY_REPORT".to_string());
        let classification = "INTERNAL".to_string();
        let processing_status = "QUEUED".to_string();

        sqlx::query(
            "INSERT INTO documents (id, project_id, filename, mime_type, size_bytes, storage_bucket, storage_key, checksum_sha256, source_type, classification, uploaded_by, uploaded_at, processing_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)"
        )
        .bind(doc_id)
        .bind(project_id)
        .bind(&input.filename)
        .bind(&mime_type)
        .bind(input.size_bytes)
        .bind(&storage_bucket)
        .bind(&storage_key)
        .bind(&input.checksum_sha256)
        .bind(&source_type)
        .bind(&classification)
        .bind(uploaded_by)
        .bind(now)
        .bind(&processing_status)
        .execute(&mut *tx)
        .await?;

        let job_id = Uuid::new_v4();
        let job_type = "EXTRACT".to_string();
        let job_status = "QUEUED".to_string();

        sqlx::query(
            "INSERT INTO document_jobs (id, document_id, job_type, status, attempt_count, max_attempts, created_at)
             VALUES ($1, $2, $3, $4, 0, 3, $5)"
        )
        .bind(job_id)
        .bind(doc_id)
        .bind(&job_type)
        .bind(&job_status)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let doc = Document {
            id: doc_id,
            project_id,
            filename: input.filename.clone(),
            mime_type,
            size_bytes: input.size_bytes,
            storage_bucket,
            storage_key,
            checksum_sha256: input.checksum_sha256.clone(),
            source_type,
            classification,
            uploaded_by,
            uploaded_at: now,
            processing_status,
        };

        let job = DocumentJob {
            id: job_id,
            document_id: doc_id,
            job_type,
            status: job_status,
            attempt_count: 0,
            max_attempts: 3,
            error_code: None,
            error_message: None,
            created_at: now,
            started_at: None,
            completed_at: None,
        };

        Ok((doc, job))
    }

    /// Fetches all documents for a project
    pub async fn list_documents(&self, project_id: Uuid) -> Result<Vec<Document>> {
        let rows = sqlx::query(
            "SELECT id, project_id, filename, mime_type, size_bytes, storage_bucket, storage_key, checksum_sha256, source_type, classification, uploaded_by, uploaded_at, processing_status
             FROM documents WHERE project_id = $1 ORDER BY uploaded_at DESC"
        )
        .bind(project_id)
        .fetch_all(&*self.pool)
        .await?;

        let mut list = Vec::new();
        for r in rows {
            list.push(Document {
                id: r.try_get("id")?,
                project_id: r.try_get("project_id")?,
                filename: r.try_get("filename")?,
                mime_type: r.try_get("mime_type")?,
                size_bytes: r.try_get("size_bytes")?,
                storage_bucket: r.try_get("storage_bucket")?,
                storage_key: r.try_get("storage_key")?,
                checksum_sha256: r.try_get("checksum_sha256")?,
                source_type: r.try_get("source_type")?,
                classification: r.try_get("classification")?,
                uploaded_by: r.try_get("uploaded_by")?,
                uploaded_at: r.try_get("uploaded_at")?,
                processing_status: r.try_get("processing_status")?,
            });
        }
        Ok(list)
    }

    /// Fetches a document processing job by ID
    pub async fn get_document_job(&self, job_id: Uuid) -> Result<DocumentJob> {
        let r = sqlx::query(
            "SELECT id, document_id, job_type, status, attempt_count, max_attempts, error_code, error_message, created_at, started_at, completed_at
             FROM document_jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&*self.pool)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Job not found"))?;

        Ok(DocumentJob {
            id: r.try_get("id")?,
            document_id: r.try_get("document_id")?,
            job_type: r.try_get("job_type")?,
            status: r.try_get("status")?,
            attempt_count: r.try_get("attempt_count")?,
            max_attempts: r.try_get("max_attempts")?,
            error_code: r.try_get("error_code")?,
            error_message: r.try_get("error_message")?,
            created_at: r.try_get("created_at")?,
            started_at: r.try_get("started_at")?,
            completed_at: r.try_get("completed_at")?,
        })
    }

    /// Fetches all active project memberships for a specific user
    pub async fn list_user_project_memberships(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<UserProjectMembership>> {
        let rows = sqlx::query(
            "SELECT pm.project_id, p.code as project_code, p.name as project_name, pm.role
             FROM project_members pm
             JOIN projects p ON p.id = pm.project_id
             WHERE pm.user_id = $1 AND pm.is_active = true
             ORDER BY p.name ASC",
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await?;

        let mut list = Vec::new();
        for r in rows {
            list.push(UserProjectMembership {
                project_id: r.try_get("project_id")?,
                project_code: r.try_get("project_code")?,
                project_name: r.try_get("project_name")?,
                role: r.try_get("role")?,
            });
        }
        Ok(list)
    }

    /// Fetches all members of a project
    pub async fn list_project_members(&self, project_id: Uuid) -> Result<Vec<ProjectMember>> {
        let rows = sqlx::query(
            "SELECT id, project_id, user_id, email, full_name, role, is_active, created_at
             FROM project_members
             WHERE project_id = $1
             ORDER BY full_name ASC",
        )
        .bind(project_id)
        .fetch_all(&*self.pool)
        .await?;

        let mut list = Vec::new();
        for r in rows {
            list.push(ProjectMember {
                id: r.try_get("id")?,
                project_id: r.try_get("project_id")?,
                user_id: r.try_get("user_id")?,
                email: r.try_get("email")?,
                full_name: r.try_get("full_name")?,
                role: r.try_get("role")?,
                is_active: r.try_get("is_active")?,
                created_at: r.try_get("created_at")?,
            });
        }
        Ok(list)
    }

    /// Adds or updates a project member with audit logging
    #[allow(clippy::too_many_arguments)]
    pub async fn add_or_update_project_member(
        &self,
        project_id: Uuid,
        user_id: Uuid,
        email: &str,
        full_name: &str,
        role: &str,
        actor_id: Option<Uuid>,
        actor_role: Option<&str>,
    ) -> Result<ProjectMember> {
        let mut tx = self.pool.begin().await?;

        let row = sqlx::query(
            "INSERT INTO project_members (project_id, user_id, email, full_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5, true)
             ON CONFLICT (project_id, user_id)
             DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, email = EXCLUDED.email, is_active = true
             RETURNING id, project_id, user_id, email, full_name, role, is_active, created_at"
        )
        .bind(project_id)
        .bind(user_id)
        .bind(email)
        .bind(full_name)
        .bind(role)
        .fetch_one(&mut *tx)
        .await?;

        let member = ProjectMember {
            id: row.try_get("id")?,
            project_id: row.try_get("project_id")?,
            user_id: row.try_get("user_id")?,
            email: row.try_get("email")?,
            full_name: row.try_get("full_name")?,
            role: row.try_get("role")?,
            is_active: row.try_get("is_active")?,
            created_at: row.try_get("created_at")?,
        };

        let now = Utc::now();
        let prev_hash: Option<String> = sqlx::query_scalar(
            "SELECT payload_hash FROM audit_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await?;

        let audit_id = Uuid::new_v4();
        let payload_hash = EventLedger::compute_hash(
            &member.id,
            "MEMBER_ASSIGNED",
            &serde_json::json!({
                "project_id": project_id,
                "user_id": user_id,
                "email": email,
                "role": role,
            }),
            prev_hash.as_deref(),
            &now,
        );

        sqlx::query(
            "INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, actor_id, actor_role, payload_hash, previous_hash, created_at)
             VALUES ($1, $2, 'PROJECT_MEMBER', $3, 'MEMBER_ASSIGNED', $4, $5, $6, $7, $8)"
        )
        .bind(audit_id)
        .bind(project_id)
        .bind(member.id)
        .bind(actor_id)
        .bind(actor_role)
        .bind(&payload_hash)
        .bind(prev_hash)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(member)
    }

    /// Deactivates a project member with audit logging
    pub async fn deactivate_project_member(
        &self,
        project_id: Uuid,
        user_id: Uuid,
        actor_id: Option<Uuid>,
        actor_role: Option<&str>,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        let updated = sqlx::query(
            "UPDATE project_members SET is_active = false WHERE project_id = $1 AND user_id = $2 RETURNING id"
        )
        .bind(project_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(row) = updated {
            let member_id: Uuid = row.try_get("id")?;
            let now = Utc::now();
            let prev_hash: Option<String> = sqlx::query_scalar(
                "SELECT payload_hash FROM audit_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1"
            )
            .bind(project_id)
            .fetch_optional(&mut *tx)
            .await?;

            let audit_id = Uuid::new_v4();
            let payload_hash = EventLedger::compute_hash(
                &member_id,
                "MEMBER_DEACTIVATED",
                &serde_json::json!({
                    "project_id": project_id,
                    "user_id": user_id,
                    "is_active": false,
                }),
                prev_hash.as_deref(),
                &now,
            );

            sqlx::query(
                "INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, actor_id, actor_role, payload_hash, previous_hash, created_at)
                 VALUES ($1, $2, 'PROJECT_MEMBER', $3, 'MEMBER_DEACTIVATED', $4, $5, $6, $7, $8)"
            )
            .bind(audit_id)
            .bind(project_id)
            .bind(member_id)
            .bind(actor_id)
            .bind(actor_role)
            .bind(&payload_hash)
            .bind(prev_hash)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    /// Atomically commits an imported schedule version, WBS, activities, and initial state
    pub async fn commit_schedule_version_tx(
        &self,
        project_id: Uuid,
        input: ScheduleImportInput,
        actor_id: Option<Uuid>,
        actor_role: Option<&str>,
    ) -> Result<(Uuid, usize)> {
        let mut tx = self.pool.begin().await?;

        // Determine next version number
        let next_v: i32 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(version_number), 0) + 1 FROM schedule_versions WHERE project_id = $1"
        )
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?;

        let version_type = input.version_type.unwrap_or_else(|| "REVISED".to_string());
        let version_id: Uuid = sqlx::query_scalar(
            "INSERT INTO schedule_versions (project_id, version_number, version_label, version_type, is_active, approved_by, approved_at)
             VALUES ($1, $2, $3, $4, true, $5, now())
             RETURNING id"
        )
        .bind(project_id)
        .bind(next_v)
        .bind(&input.version_label)
        .bind(&version_type)
        .bind(actor_id)
        .fetch_one(&mut *tx)
        .await?;

        // Mark previous schedule versions as inactive
        sqlx::query(
            "UPDATE schedule_versions SET is_active = false WHERE project_id = $1 AND id != $2",
        )
        .bind(project_id)
        .bind(version_id)
        .execute(&mut *tx)
        .await?;

        // Create Root WBS Node
        let root_wbs_id: Uuid = sqlx::query_scalar(
            "INSERT INTO wbs_nodes (project_id, schedule_version_id, wbs_code, name, level, path)
             VALUES ($1, $2, 'WBS-IMP-0', 'Imported Schedule Root', 1, '1')
             RETURNING id",
        )
        .bind(project_id)
        .bind(version_id)
        .fetch_one(&mut *tx)
        .await?;

        let mut inserted_count = 0;
        let now = Utc::now();
        for act in &input.activities {
            let act_id = Uuid::new_v4();
            let planned_duration = (act.planned_finish_date - act.planned_start_date)
                .num_days()
                .max(1) as i32;
            let discipline_str = serde_json::to_string(&act.discipline)?
                .trim_matches('"')
                .to_string();

            sqlx::query(
                "INSERT INTO activities (
                    id, project_id, schedule_version_id, wbs_id, code, name, description, discipline,
                    planned_start_date, planned_finish_date, planned_duration_days, planned_quantity,
                    unit_of_measure, location, zone, weightage, critical_path, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)"
            )
            .bind(act_id)
            .bind(project_id)
            .bind(version_id)
            .bind(root_wbs_id)
            .bind(&act.code)
            .bind(&act.name)
            .bind(&act.description)
            .bind(&discipline_str)
            .bind(act.planned_start_date)
            .bind(act.planned_finish_date)
            .bind(planned_duration)
            .bind(act.planned_quantity)
            .bind(&act.unit_of_measure)
            .bind(&act.location)
            .bind(&act.zone)
            .bind(act.weightage.unwrap_or(1.0))
            .bind(act.critical_path.unwrap_or(false))
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                "INSERT INTO activity_current_state (
                    activity_id, project_id, execution_status, current_progress_pct, cumulative_quantity, is_critical_path_delayed, variance_days, updated_at
                ) VALUES ($1, $2, 'NOT_STARTED', 0.0, 0.0, false, 0, $3)
                ON CONFLICT (activity_id) DO NOTHING"
            )
            .bind(act_id)
            .bind(project_id)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            inserted_count += 1;
        }

        // Audit the schedule import
        let prev_hash: Option<String> = sqlx::query_scalar(
            "SELECT payload_hash FROM audit_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await?;

        let audit_id = Uuid::new_v4();
        let payload_hash = EventLedger::compute_hash(
            &version_id,
            "SCHEDULE_IMPORTED",
            &serde_json::json!({
                "project_id": project_id,
                "version_id": version_id,
                "version_number": next_v,
                "version_label": input.version_label,
                "activities_count": inserted_count,
            }),
            prev_hash.as_deref(),
            &now,
        );

        sqlx::query(
            "INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, actor_id, actor_role, payload_hash, previous_hash, created_at)
             VALUES ($1, $2, 'SCHEDULE_VERSION', $3, 'SCHEDULE_IMPORTED', $4, $5, $6, $7, $8)"
        )
        .bind(audit_id)
        .bind(project_id)
        .bind(version_id)
        .bind(actor_id)
        .bind(actor_role.unwrap_or("PLANNER"))
        .bind(&payload_hash)
        .bind(prev_hash)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // Create Outbox Event
        let outbox_payload = serde_json::json!({
            "event_type": "SCHEDULE_REVISED",
            "project_id": project_id,
            "version_id": version_id,
            "activities_count": inserted_count,
            "timestamp": Utc::now()
        });
        sqlx::query(
            "INSERT INTO outbox_events (project_id, event_type, payload, status)
             VALUES ($1, 'event.project_changed', $2, 'PENDING')",
        )
        .bind(project_id)
        .bind(outbox_payload)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok((version_id, inserted_count))
    }
}
