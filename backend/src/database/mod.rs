// =============================================================================
// Database Module - PostgreSQL Connection and Repository
// =============================================================================

use anyhow::Result;
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::sync::Arc;
use tracing::{error, info, warn};

/// Database connection pool wrapper
#[derive(Clone)]
pub struct Database {
    pool: Arc<PgPool>,
}

impl Database {
    /// Create a new database connection pool
    pub async fn new(database_url: &str) -> Result<Self> {
        info!("Initializing PostgreSQL connection pool...");

        let pool = PgPoolOptions::new()
            .max_connections(20) // Maximum number of connections
            .acquire_timeout(std::time::Duration::from_secs(30)) // Wait up to 30 seconds
            .idle_timeout(Some(std::time::Duration::from_secs(300))) // 5 minutes idle timeout
            .max_lifetime(Some(std::time::Duration::from_secs(3600))) // 1 hour max lifetime
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
    pub async fn load_projects(&self) -> Result<Vec<crate::domain::models::Project>> {
        use sqlx::Row;

        let rows = sqlx::query(
            "SELECT id, code, name, description, timezone, currency, created_at, updated_at FROM projects ORDER BY created_at DESC",
        )
        .fetch_all(&*self.pool)
        .await?;

        let mut projects = Vec::new();
        for r in rows {
            projects.push(crate::domain::models::Project {
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
}
