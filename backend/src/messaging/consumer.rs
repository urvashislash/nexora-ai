use deadpool_lapin::Pool;
use lapin::options::{BasicAckOptions, BasicConsumeOptions, BasicNackOptions};
use lapin::types::FieldTable;
use serde::Deserialize;
use std::sync::Arc;
use tokio_stream::StreamExt;
use uuid::Uuid;

use crate::api::handlers::AppState;
use crate::cache::RedisCache;

const QUEUE_RESULT: &str = "ai_result_queue";

/// The message shape published by the Python AI worker on `document.result`.
#[derive(Debug, Deserialize)]
pub struct AIResultMessage {
    pub correlation_id: Option<String>,
    pub idempotency_key: Option<String>,
    pub project_id: Option<String>,
    pub document_id: Option<String>,
    pub job_id: Option<String>,
    pub status: String,
    pub evidence_fingerprint: Option<String>,
    pub observations: Option<Vec<serde_json::Value>>,
    pub proposals: Option<Vec<serde_json::Value>>,
    pub summary: Option<AIResultSummary>,
    // Failure fields
    pub error: Option<String>,
    pub error_type: Option<String>,
    pub attempts: Option<i32>,
    pub retryable: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct AIResultSummary {
    pub observations: Option<usize>,
    pub auto_link: Option<usize>,
    pub review_required: Option<usize>,
    pub rejected: Option<usize>,
}

/// Consumes AI processing results from RabbitMQ and updates application state.
pub struct ResultConsumer {
    pool: Pool,
    state: AppState,
    cache: Option<Arc<RedisCache>>,
}

impl ResultConsumer {
    pub fn new(pool: Pool, state: AppState, cache: Option<Arc<RedisCache>>) -> Self {
        Self { pool, state, cache }
    }

    /// Runs the consumer loop. Call via `tokio::spawn`.
    pub async fn run(self) {
        tracing::info!("Result consumer starting on queue: {}", QUEUE_RESULT);

        loop {
            match self.consume_loop().await {
                Ok(()) => {
                    tracing::info!("Result consumer loop ended, restarting...");
                }
                Err(e) => {
                    tracing::error!("Result consumer error: {}, restarting in 5s...", e);
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                }
            }
        }
    }

    async fn consume_loop(&self) -> Result<(), anyhow::Error> {
        let conn = self.pool.get().await?;
        let channel = conn.create_channel().await?;

        channel
            .basic_qos(10, lapin::options::BasicQosOptions::default())
            .await?;

        let mut consumer = channel
            .basic_consume(
                QUEUE_RESULT,
                "nexora-backend-consumer",
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await?;

        tracing::info!("Result consumer listening on {}", QUEUE_RESULT);

        while let Some(delivery_result) = consumer.next().await {
            match delivery_result {
                Ok(delivery) => {
                    let tag = delivery.delivery_tag;
                    match self.handle_delivery(&delivery.data).await {
                        Ok(()) => {
                            if let Err(e) = channel.basic_ack(tag, BasicAckOptions::default()).await
                            {
                                tracing::error!("Failed to ACK delivery {}: {}", tag, e);
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to process delivery {}: {}", tag, e);
                            let _ = channel
                                .basic_nack(
                                    tag,
                                    BasicNackOptions {
                                        requeue: true,
                                        ..Default::default()
                                    },
                                )
                                .await;
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Consumer delivery error: {}", e);
                    return Err(e.into());
                }
            }
        }

        Ok(())
    }

    async fn handle_delivery(&self, data: &[u8]) -> Result<(), anyhow::Error> {
        let message: AIResultMessage = serde_json::from_slice(data)?;

        let job_id = message.job_id.as_deref().unwrap_or("unknown");

        if message.status == "FAILED" {
            tracing::warn!(
                "AI job {} failed: {:?} (retryable: {:?})",
                job_id,
                message.error,
                message.retryable
            );
            return Ok(());
        }

        if message.status != "COMPLETED" {
            tracing::debug!("Ignoring AI result with status: {}", message.status);
            return Ok(());
        }

        let project_id_str = message.project_id.as_deref().unwrap_or_default();
        let project_id = project_id_str
            .parse::<Uuid>()
            .unwrap_or_else(|_| crate::api::handlers::parse_uuid_or_derive(project_id_str));

        let summary = message.summary.as_ref();
        let obs_count = summary.and_then(|s| s.observations).unwrap_or(0);
        let auto_count = summary.and_then(|s| s.auto_link).unwrap_or(0);
        let review_count = summary.and_then(|s| s.review_required).unwrap_or(0);

        tracing::info!(
            "AI job {} completed — {} observations, {} auto-linked, {} review-required",
            job_id,
            obs_count,
            auto_count,
            review_count
        );

        // Store the raw result in audit trail
        let mut audit_trail = self.state.audit_trail.write().await;
        let mut last_hash = self.state.last_audit_hash.write().await;

        let audit = crate::domain::ledger::EventLedger::create_audit_event(
            project_id,
            "AI_RESULT_INGESTED",
            Uuid::new_v4(),
            "INGEST_AI_RESULT",
            None,
            Some("AI_WORKER"),
            None,
            Some(serde_json::json!({
                "job_id": job_id,
                "observations": obs_count,
                "auto_link": auto_count,
                "review_required": review_count,
            })),
            last_hash.as_deref(),
        );
        *last_hash = Some(audit.payload_hash.clone());
        audit_trail.push(audit);

        // Invalidate caches for the affected project
        if let Some(cache) = &self.cache {
            let _ = cache.invalidate_project(project_id).await;
        }

        Ok(())
    }
}
