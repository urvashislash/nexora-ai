mod api;
mod cache;
mod database;
mod domain;
mod messaging;

use api::handlers::AppState;
use api::routes::create_router;
use cache::RedisCache;
use database::Database;
use messaging::consumer::ResultConsumer;
use messaging::publisher::{OutboxRelay, RabbitPublisher};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,backend=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting NEXORA AI Trust Plane Backend...");

    // -------------------------------------------------------------------------
    // Redis Cache
    // -------------------------------------------------------------------------
    let redis_url = std::env::var("REDIS_URL").ok();
    let redis_cache: Option<Arc<RedisCache>> = match &redis_url {
        Some(url) => match RedisCache::new(url).await {
            Ok(cache) => {
                tracing::info!("Redis cache initialized");
                Some(Arc::new(cache))
            }
            Err(e) => {
                tracing::warn!("Redis cache unavailable (continuing without cache): {}", e);
                None
            }
        },
        None => {
            tracing::warn!("REDIS_URL not set — running without Redis cache");
            None
        }
    };

    // -------------------------------------------------------------------------
    // PostgreSQL Database Connection
    // -------------------------------------------------------------------------
    let database_url = std::env::var("DATABASE_URL").ok();
    let database: Option<Arc<Database>> = match &database_url {
        Some(url) => match Database::new(url).await {
            Ok(db) => {
                tracing::info!("PostgreSQL database initialized");
                Some(Arc::new(db))
            }
            Err(e) => {
                tracing::warn!(
                    "PostgreSQL database unavailable (continuing without persistence): {}",
                    e
                );
                None
            }
        },
        None => {
            tracing::warn!("DATABASE_URL not set — running without PostgreSQL persistence");
            None
        }
    };

    // -------------------------------------------------------------------------
    // RabbitMQ Connection Pool
    // -------------------------------------------------------------------------
    let rabbit_url = std::env::var("RABBITMQ_URL").ok();
    let rabbit_pool = match &rabbit_url {
        Some(url) => match messaging::create_rabbit_pool(url).await {
            Ok(pool) => {
                tracing::info!("RabbitMQ pool initialized");
                Some(pool)
            }
            Err(e) => {
                tracing::warn!("RabbitMQ unavailable (continuing without messaging): {}", e);
                None
            }
        },
        None => {
            tracing::warn!("RABBITMQ_URL not set — running without RabbitMQ");
            None
        }
    };

    // -------------------------------------------------------------------------
    // Application State
    // -------------------------------------------------------------------------
    let publisher: Option<Arc<RabbitPublisher>> = rabbit_pool
        .as_ref()
        .map(|p| Arc::new(RabbitPublisher::new(p.clone())));

    // Declare topology if publisher is available
    if let Some(pub_ref) = &publisher {
        if let Err(e) = pub_ref.declare_topology().await {
            tracing::error!("Failed to declare RabbitMQ topology: {}", e);
        }
    }

    let state = AppState::new(publisher.clone(), redis_cache.clone(), database.clone());
    let app = create_router(state.clone());

    // -------------------------------------------------------------------------
    // Background Tasks: Result Consumer + Outbox Relay
    // -------------------------------------------------------------------------
    if let Some(pool) = rabbit_pool {
        // Spawn the result consumer
        let consumer = ResultConsumer::new(pool.clone(), state.clone(), redis_cache.clone());
        tokio::spawn(async move {
            consumer.run().await;
        });

        // Spawn the outbox relay
        if let Some(pub_ref) = publisher {
            let relay = OutboxRelay::new(
                pub_ref,
                state.outbox_events.clone(),
                std::time::Duration::from_secs(5),
            );
            tokio::spawn(async move {
                relay.run().await;
            });
        }
    }

    // -------------------------------------------------------------------------
    // HTTP Server
    // -------------------------------------------------------------------------
    let port = std::env::var("PORT")
        .or_else(|_| std::env::var("BACKEND_PORT"))
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .unwrap_or(3000);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
