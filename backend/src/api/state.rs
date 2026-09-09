use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::cache::{CacheTtl, RedisCache};
use crate::database::Database;
use crate::domain::models::*;
use crate::messaging::publisher::RabbitPublisher;

// =============================================================================
// Application State
// =============================================================================

#[derive(Clone)]
pub struct AppState {
    pub projects: Arc<RwLock<Vec<Project>>>,
    pub teams: Arc<RwLock<Vec<Team>>>,
    pub team_members: Arc<RwLock<Vec<TeamMember>>>,
    pub team_invitations: Arc<RwLock<Vec<TeamInvitation>>>,
    pub activities: Arc<RwLock<Vec<Activity>>>,
    pub activity_states: Arc<RwLock<Vec<ActivityCurrentState>>>,
    pub observations: Arc<RwLock<Vec<WorkObservation>>>,
    pub proposals: Arc<RwLock<Vec<MatchProposal>>>,
    pub events: Arc<RwLock<Vec<ActualEvent>>>,
    pub approvals: Arc<RwLock<Vec<Approval>>>,
    pub audit_trail: Arc<RwLock<Vec<AuditEvent>>>,
    pub outbox_events: Arc<RwLock<Vec<OutboxEvent>>>,
    pub last_audit_hash: Arc<RwLock<Option<String>>>,
    pub audit_archives: Arc<RwLock<Vec<crate::domain::ledger::AuditArchiveBatch>>>,
    pub legal_holds: Arc<RwLock<std::collections::HashMap<Uuid, bool>>>,
    // --- Infrastructure ---
    pub rabbit_publisher: Option<Arc<RabbitPublisher>>,
    pub redis_cache: Option<Arc<RedisCache>>,
    pub database: Option<Arc<Database>>,
    pub cache_ttl: CacheTtl,
    pub require_database: bool,
}

impl AppState {
    fn is_production_configured() -> bool {
        std::env::var("APP_ENV")
            .or_else(|_| std::env::var("ENVIRONMENT"))
            .map(|v| {
                let s = v.to_lowercase();
                s == "production" || s == "prod" || s == "beta"
            })
            .or_else(|_| std::env::var("REQUIRE_DATABASE").map(|v| v == "true" || v == "1"))
            .unwrap_or(false)
    }

    /// Builder method to override require_database setting (useful for failure tests)
    pub fn with_require_database(mut self, req: bool) -> Self {
        self.require_database = req;
        self
    }

    /// Creates a new AppState populated with initial seed demo data.
    pub fn new(
        rabbit_publisher: Option<Arc<RabbitPublisher>>,
        redis_cache: Option<Arc<RedisCache>>,
        database: Option<Arc<Database>>,
    ) -> Self {
        let (projects, activities, states) = super::seed::get_seed_demo_data();
        let require_database = Self::is_production_configured();
        Self {
            projects: Arc::new(RwLock::new(projects)),
            teams: Arc::new(RwLock::new(Vec::new())),
            team_members: Arc::new(RwLock::new(Vec::new())),
            team_invitations: Arc::new(RwLock::new(Vec::new())),
            activities: Arc::new(RwLock::new(activities)),
            activity_states: Arc::new(RwLock::new(states)),
            observations: Arc::new(RwLock::new(Vec::new())),
            proposals: Arc::new(RwLock::new(Vec::new())),
            events: Arc::new(RwLock::new(Vec::new())),
            approvals: Arc::new(RwLock::new(Vec::new())),
            audit_trail: Arc::new(RwLock::new(Vec::new())),
            outbox_events: Arc::new(RwLock::new(Vec::new())),
            last_audit_hash: Arc::new(RwLock::new(None)),
            audit_archives: Arc::new(RwLock::new(Vec::new())),
            legal_holds: Arc::new(RwLock::new(std::collections::HashMap::new())),
            rabbit_publisher,
            redis_cache,
            database,
            cache_ttl: CacheTtl::default(),
            require_database,
        }
    }

    /// Creates a completely empty AppState without any seed data.
    pub fn empty(
        rabbit_publisher: Option<Arc<RabbitPublisher>>,
        redis_cache: Option<Arc<RedisCache>>,
        database: Option<Arc<Database>>,
    ) -> Self {
        Self {
            projects: Arc::new(RwLock::new(Vec::new())),
            teams: Arc::new(RwLock::new(Vec::new())),
            team_members: Arc::new(RwLock::new(Vec::new())),
            team_invitations: Arc::new(RwLock::new(Vec::new())),
            activities: Arc::new(RwLock::new(Vec::new())),
            activity_states: Arc::new(RwLock::new(Vec::new())),
            observations: Arc::new(RwLock::new(Vec::new())),
            proposals: Arc::new(RwLock::new(Vec::new())),
            events: Arc::new(RwLock::new(Vec::new())),
            approvals: Arc::new(RwLock::new(Vec::new())),
            audit_trail: Arc::new(RwLock::new(Vec::new())),
            outbox_events: Arc::new(RwLock::new(Vec::new())),
            last_audit_hash: Arc::new(RwLock::new(None)),
            audit_archives: Arc::new(RwLock::new(Vec::new())),
            legal_holds: Arc::new(RwLock::new(std::collections::HashMap::new())),
            rabbit_publisher,
            redis_cache,
            database,
            cache_ttl: CacheTtl::default(),
            require_database: Self::is_production_configured(),
        }
    }

    /// Creates AppState with demo data for standalone tests and local runs.
    pub fn new_with_demo_data() -> Self {
        Self::new(None, None, None)
    }
}
