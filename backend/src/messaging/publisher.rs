use deadpool_lapin::Pool;
use lapin::options::{
    BasicPublishOptions, ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
};
use lapin::types::FieldTable;
use lapin::{BasicProperties, ExchangeKind};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::domain::models::OutboxEvent;

const EXCHANGE: &str = "nexora.jobs";
const QUEUE_PROCESSING: &str = "ai_processing_queue";
const QUEUE_RESULT: &str = "ai_result_queue";

/// Payload published to `document.process` for the AI worker to consume.
#[derive(Debug, Serialize)]
pub struct ProcessDocumentJob {
    pub job_id: Uuid,
    pub correlation_id: String,
    pub project_id: Uuid,
    pub document_id: Uuid,
    pub text_content: Option<String>,
    pub content_base64: Option<String>,
    pub storage_key: Option<String>,
    pub storage_bucket: Option<String>,
    pub filename: Option<String>,
    pub mime_type: Option<String>,
    pub source_type: String,
    pub attempt: i32,
    pub activities: serde_json::Value,
}

/// Reliable publisher wrapping a lapin connection pool.
pub struct RabbitPublisher {
    pool: Pool,
}

impl RabbitPublisher {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    /// Declares the exchange and queue topology (idempotent).
    pub async fn declare_topology(&self) -> Result<(), lapin::Error> {
        let conn = self.pool.get().await.map_err(|e| {
            tracing::error!("Failed to get RabbitMQ connection: {}", e);
            lapin::Error::InvalidChannelState(lapin::ChannelState::Error)
        })?;
        let channel = conn.create_channel().await?;

        channel
            .exchange_declare(
                EXCHANGE,
                ExchangeKind::Direct,
                ExchangeDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await?;

        // Processing queue
        channel
            .queue_declare(
                QUEUE_PROCESSING,
                QueueDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await?;
        channel
            .queue_bind(
                QUEUE_PROCESSING,
                EXCHANGE,
                "document.process",
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await?;

        // Result queue
        channel
            .queue_declare(
                QUEUE_RESULT,
                QueueDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await?;
        channel
            .queue_bind(
                QUEUE_RESULT,
                EXCHANGE,
                "document.result",
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await?;

        tracing::info!(
            "RabbitMQ topology declared: exchange={}, queues=[{}, {}]",
            EXCHANGE,
            QUEUE_PROCESSING,
            QUEUE_RESULT
        );
        Ok(())
    }

    /// Publishes a document processing job to the AI worker queue.
    pub async fn publish_document_job(
        &self,
        job: &ProcessDocumentJob,
    ) -> Result<(), anyhow::Error> {
        let conn = self.pool.get().await?;
        let channel = conn.create_channel().await?;
        channel
            .confirm_select(lapin::options::ConfirmSelectOptions::default())
            .await?;

        let payload = serde_json::to_vec(job)?;
        let confirm = channel
            .basic_publish(
                EXCHANGE,
                "document.process",
                BasicPublishOptions::default(),
                &payload,
                BasicProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2) // persistent
                    .with_correlation_id(job.correlation_id.clone().into()),
            )
            .await?
            .await?;

        if confirm.is_ack() {
            tracing::info!("Published document job {} to RabbitMQ", job.job_id);
        } else {
            tracing::warn!("RabbitMQ did not ACK document job {}", job.job_id);
        }

        Ok(())
    }

    /// Publishes a generic outbox event payload to RabbitMQ.
    pub async fn publish_outbox_event(&self, event: &OutboxEvent) -> Result<(), anyhow::Error> {
        let conn = self.pool.get().await?;
        let channel = conn.create_channel().await?;
        channel
            .confirm_select(lapin::options::ConfirmSelectOptions::default())
            .await?;

        let routing_key = match event.event_type.as_str() {
            "PROPOSAL_APPROVED" | "BATCH_PROPOSAL_APPROVED" => "document.result",
            "PROPOSAL_OVERRIDDEN" => "document.result",
            "AUTO_LINKED_EVENT" => "document.result",
            _ => "document.result",
        };

        let payload = serde_json::to_vec(&event.payload)?;
        let confirm = channel
            .basic_publish(
                EXCHANGE,
                routing_key,
                BasicPublishOptions::default(),
                &payload,
                BasicProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2)
                    .with_correlation_id(event.id.to_string().into()),
            )
            .await?
            .await?;

        if confirm.is_ack() {
            tracing::info!(
                "Outbox event {} ({}) relayed to RabbitMQ",
                event.id,
                event.event_type
            );
        } else {
            tracing::warn!("RabbitMQ NACK for outbox event {}", event.id);
        }

        Ok(())
    }
}

/// Background task that periodically drains pending outbox events and publishes them.
pub struct OutboxRelay {
    publisher: Arc<RabbitPublisher>,
    outbox: Arc<RwLock<Vec<OutboxEvent>>>,
    poll_interval: std::time::Duration,
}

impl OutboxRelay {
    pub fn new(
        publisher: Arc<RabbitPublisher>,
        outbox: Arc<RwLock<Vec<OutboxEvent>>>,
        poll_interval: std::time::Duration,
    ) -> Self {
        Self {
            publisher,
            outbox,
            poll_interval,
        }
    }

    /// Runs the outbox relay loop. Call via `tokio::spawn`.
    pub async fn run(self) {
        tracing::info!(
            "Outbox relay started — polling every {:?}",
            self.poll_interval
        );

        loop {
            self.relay_pending().await;
            tokio::time::sleep(self.poll_interval).await;
        }
    }

    async fn relay_pending(&self) {
        let mut outbox = self.outbox.write().await;
        let pending_indices: Vec<usize> = outbox
            .iter()
            .enumerate()
            .filter(|(_, e)| e.status == "PENDING" || e.status == "RETRY")
            .map(|(i, _)| i)
            .collect();

        if pending_indices.is_empty() {
            return;
        }

        tracing::info!("Outbox relay: {} events pending", pending_indices.len());

        for idx in pending_indices {
            let event = &outbox[idx];
            match self.publisher.publish_outbox_event(event).await {
                Ok(()) => {
                    crate::domain::ledger::EventLedger::mark_outbox_processed(&mut outbox[idx]);
                }
                Err(e) => {
                    tracing::error!("Outbox relay failed for event {}: {}", outbox[idx].id, e);
                    crate::domain::ledger::EventLedger::mark_outbox_failed(
                        &mut outbox[idx],
                        3, // max retries
                    );
                }
            }
        }
    }
}
