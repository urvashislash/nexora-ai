mod api;
mod domain;

use api::handlers::AppState;
use api::routes::create_router;
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,backend=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting NEXORA AI Trust Plane Backend...");

    let state = AppState::new_with_demo_data();
    let app = create_router(state);

    let port = std::env::var("BACKEND_PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .unwrap_or(3000);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
