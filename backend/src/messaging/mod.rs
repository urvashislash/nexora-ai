pub mod publisher;
pub mod consumer;

use deadpool_lapin::{Manager, Pool};
use lapin::ConnectionProperties;

/// Creates a deadpool-lapin connection pool from a RabbitMQ URL.
///
/// Supports both `amqp://` (plain) and `amqps://` (TLS) URLs.
pub async fn create_rabbit_pool(url: &str) -> Result<Pool, Box<dyn std::error::Error>> {
    let manager = Manager::new(url, ConnectionProperties::default());
    let pool = Pool::builder(manager).max_size(4).build()?;

    // Verify connectivity on startup
    let conn = pool.get().await?;
    let channel = conn.create_channel().await?;
    tracing::info!(
        "RabbitMQ pool created — connected to vhost {:?}",
        channel.status().state()
    );
    drop(channel);

    Ok(pool)
}
