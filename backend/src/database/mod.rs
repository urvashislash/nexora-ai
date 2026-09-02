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

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Execute a query with connection retry logic
    pub async fn execute_with_retry<F, R>(&self, operation: F) -> Result<R>
    where
        F: Fn(&PgPool) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<R>> + Send>>,
    {
        let pool = self.pool.clone();

        // Simple retry logic - try up to 3 times
        let mut attempts = 0;
        loop {
            let result = operation(&pool).await;
            match result {
                Ok(res) => return Ok(res),
                Err(e) => {
                    attempts += 1;
                    if attempts >= 3 {
                        return Err(e);
                    }
                    warn!(
                        "Database operation failed, retrying (attempt {}): {}",
                        attempts, e
                    );
                    tokio::time::sleep(std::time::Duration::from_millis(100 * attempts)).await;
                }
            }
        }
    }
}
