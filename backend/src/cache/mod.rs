use deadpool_redis::{Config, Pool, Runtime};
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use uuid::Uuid;

/// Redis-backed cache with TTL and per-project invalidation.
///
/// Key schema:
///   `nexora:cache:{scope}:{project_id}` — project-scoped data
///   `nexora:cache:{scope}:global`       — non-scoped data
pub struct RedisCache {
    pool: Pool,
}

#[derive(Debug, Clone, Copy)]
pub struct CacheTtl {
    pub dashboard_secs: u64,
    pub activities_secs: u64,
    pub review_queue_secs: u64,
}

impl Default for CacheTtl {
    fn default() -> Self {
        Self {
            dashboard_secs: 30,
            activities_secs: 60,
            review_queue_secs: 15,
        }
    }
}

impl RedisCache {
    /// Creates a new Redis cache from a connection URL.
    ///
    /// Verifies connectivity on construction.
    pub async fn new(redis_url: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let cfg = Config::from_url(redis_url);
        let pool = cfg.create_pool(Some(Runtime::Tokio1))?;

        // Verify connectivity
        let mut conn = pool.get().await?;
        let pong: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await?;
        tracing::info!("Redis cache connected — PING returned: {}", pong);

        Ok(Self { pool })
    }

    /// Returns the raw pool for health checks and direct access.
    pub fn pool(&self) -> &Pool {
        &self.pool
    }

    fn key(scope: &str, project_id: Option<Uuid>) -> String {
        match project_id {
            Some(pid) => format!("nexora:cache:{}:{}", scope, pid),
            None => format!("nexora:cache:{}:global", scope),
        }
    }

    /// Gets a cached value, deserializing from JSON.
    pub async fn get<T: DeserializeOwned>(
        &self,
        scope: &str,
        project_id: Option<Uuid>,
    ) -> Option<T> {
        let mut conn = match self.pool.get().await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Redis cache get failed (pool): {}", e);
                return None;
            }
        };

        let key = Self::key(scope, project_id);
        let raw: Option<String> = match conn.get(&key).await {
            Ok(v) => v,
            Err(e) => {
                tracing::debug!("Redis cache MISS for {}: {}", key, e);
                return None;
            }
        };

        raw.and_then(|s| {
            serde_json::from_str(&s)
                .map_err(|e| {
                    tracing::warn!("Redis cache deserialization error for {}: {}", key, e);
                    e
                })
                .ok()
        })
    }

    /// Sets a cached value with a TTL, serializing to JSON.
    pub async fn set<T: Serialize>(
        &self,
        scope: &str,
        project_id: Option<Uuid>,
        value: &T,
        ttl_secs: u64,
    ) -> bool {
        let mut conn = match self.pool.get().await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Redis cache set failed (pool): {}", e);
                return false;
            }
        };

        let key = Self::key(scope, project_id);
        let json = match serde_json::to_string(value) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!("Redis cache serialization error for {}: {}", key, e);
                return false;
            }
        };

        match conn.set_ex::<_, _, ()>(&key, &json, ttl_secs).await {
            Ok(()) => {
                tracing::debug!("Redis cache SET {} (TTL {}s)", key, ttl_secs);
                true
            }
            Err(e) => {
                tracing::warn!("Redis cache SET failed for {}: {}", key, e);
                false
            }
        }
    }

    /// Invalidates all caches for a specific project.
    pub async fn invalidate_project(&self, project_id: Uuid) -> bool {
        let mut conn = match self.pool.get().await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Redis cache invalidation failed (pool): {}", e);
                return false;
            }
        };

        let scopes = ["dashboard", "activities", "review_queue"];
        let keys: Vec<String> = scopes
            .iter()
            .map(|s| Self::key(s, Some(project_id)))
            .collect();

        match conn.del::<_, ()>(&keys[..]).await {
            Ok(()) => {
                tracing::debug!(
                    "Redis cache invalidated {} keys for project {}",
                    keys.len(),
                    project_id
                );
                true
            }
            Err(e) => {
                tracing::warn!("Redis cache invalidation error for project {}: {}", project_id, e);
                false
            }
        }
    }

    /// Invalidates a single cache scope for a project.
    pub async fn invalidate(&self, scope: &str, project_id: Option<Uuid>) -> bool {
        let mut conn = match self.pool.get().await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Redis cache invalidation failed (pool): {}", e);
                return false;
            }
        };

        let key = Self::key(scope, project_id);
        match conn.del::<_, ()>(&key).await {
            Ok(()) => true,
            Err(e) => {
                tracing::warn!("Redis cache DEL failed for {}: {}", key, e);
                false
            }
        }
    }

    /// Simple PING for health checks.
    pub async fn ping(&self) -> bool {
        let mut conn = match self.pool.get().await {
            Ok(c) => c,
            Err(_) => return false,
        };
        // Use AsyncCommands trait which is implemented for deadpool_redis::Connection
        let result: Result<String, _> = redis::cmd("PING")
            .query_async(&mut conn)
            .await;
        result.is_ok()
    }
}
