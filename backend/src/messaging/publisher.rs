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

pub const EXCHANGE: &str = "nexora.jobs";
pub const QUEUE_PROCESSING: &str = "ai_processing_queue";
pub const QUEUE_RESULT: &str = "ai_result_queue";
pub const QUEUE_EVENTS: &str = "nexora_events_queue";

pub const ROUTING_KEY_DOCUMENT_PROCESS: &str = "document.process";
pub const ROUTING_KEY_DOCUMENT_RESULT: &str = "document.result";
pub const ROUTING_KEY_ACTIVITY_COMMITTED: &str = "event.activity_committed";
pub const ROUTING_KEY_PROPOSAL_CREATED: &str = "event.proposal_created";
pub const ROUTING_KEY_PROJECT_CHANGED: &str = "event.project_changed";

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
                ROUTING_KEY_DOCUMENT_PROCESS,
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
                ROUTING_KEY_DOCUMENT_RESULT,
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await?;

        // Events queue
        channel
            .queue_declare(
                QUEUE_EVENTS,
                QueueDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await?;
        channel
            .queue_bind(
                QUEUE_EVENTS,
                EXCHANGE,
                ROUTING_KEY_ACTIVITY_COMMITTED,
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await?;
        channel
            .queue_bind(
                QUEUE_EVENTS,
                EXCHANGE,
                ROUTING_KEY_PROPOSAL_CREATED,
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await?;
        channel
            .queue_bind(
                QUEUE_EVENTS,
                EXCHANGE,
                ROUTING_KEY_PROJECT_CHANGED,
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await?;

        tracing::info!(
            "RabbitMQ topology declared: exchange={}, queues=[{}, {}, {}]",
            EXCHANGE,
            QUEUE_PROCESSING,
            QUEUE_RESULT,
            QUEUE_EVENTS
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
            "PROPOSAL_APPROVED" | "BATCH_PROPOSAL_APPROVED" => ROUTING_KEY_ACTIVITY_COMMITTED,
            "PROPOSAL_OVERRIDDEN" => ROUTING_KEY_ACTIVITY_COMMITTED,
            "AUTO_LINKED_EVENT" => ROUTING_KEY_ACTIVITY_COMMITTED,
            "PROPOSAL_CREATED" => ROUTING_KEY_PROPOSAL_CREATED,
            "PROJECT_CREATED" | "PROJECT_CHANGED" => ROUTING_KEY_PROJECT_CHANGED,
            _ => ROUTING_KEY_ACTIVITY_COMMITTED,
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
    database: Option<Arc<crate::database::Database>>,
    poll_interval: std::time::Duration,
    max_retries: i32,
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
            database: None,
            poll_interval,
            max_retries: 5,
        }
    }

    /// Sets PostgreSQL database instance for durable outbox draining
    pub fn with_database(mut self, database: Option<Arc<crate::database::Database>>) -> Self {
        self.database = database;
        self
    }

    /// Sets custom maximum retries before marking an outbox event as DEAD_LETTER
    pub fn with_max_retries(mut self, max_retries: i32) -> Self {
        self.max_retries = max_retries;
        self
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
        // 1. Drain pending outbox events from PostgreSQL if available
        if let Some(db) = &self.database {
            match db.fetch_pending_outbox_events(50).await {
                Ok(pg_events) => {
                    for event in pg_events {
                        match self.publisher.publish_outbox_event(&event).await {
                            Ok(()) => {
                                if let Err(e) = db.mark_outbox_event_processed(event.id).await {
                                    tracing::warn!(
                                        "Failed to mark PostgreSQL outbox event {} as processed: {}",
                                        event.id,
                                        e
                                    );
                                }
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Outbox relay failed to publish PostgreSQL event {}: {}",
                                    event.id,
                                    e
                                );
                                if let Err(err) = db
                                    .mark_outbox_event_failed(event.id, self.max_retries)
                                    .await
                                {
                                    tracing::warn!(
                                        "Failed to mark PostgreSQL outbox event {} as failed: {}",
                                        event.id,
                                        err
                                    );
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to fetch pending outbox events from PostgreSQL: {}",
                        e
                    );
                }
            }
        }

        // 2. Drain pending in-memory outbox events
        let mut outbox = self.outbox.write().await;
        let now = chrono::Utc::now();

        let pending_indices: Vec<usize> = outbox
            .iter()
            .enumerate()
            .filter(|(_, e)| {
                if e.status == "PENDING" {
                    true
                } else if e.status == "RETRY" {
                    // Exponential backoff: base 2 seconds * 2^(retry_count - 1) capped at 60s
                    let backoff_secs = (1i64 << (e.retry_count - 1).min(6)).min(60);
                    let elapsed = (now - e.created_at).num_seconds();
                    elapsed >= backoff_secs
                } else {
                    false
                }
            })
            .map(|(i, _)| i)
            .collect();

        if pending_indices.is_empty() {
            return;
        }

        tracing::info!(
            "Outbox relay: processing {} eligible pending events",
            pending_indices.len()
        );

        for idx in pending_indices {
            let event = &outbox[idx];
            match self.publisher.publish_outbox_event(event).await {
                Ok(()) => {
                    crate::domain::ledger::EventLedger::mark_outbox_processed(&mut outbox[idx]);
                }
                Err(e) => {
                    tracing::warn!(
                        "Outbox relay attempt {}/{} failed for event {}: {}",
                        outbox[idx].retry_count + 1,
                        self.max_retries,
                        outbox[idx].id,
                        e
                    );
                    crate::domain::ledger::EventLedger::mark_outbox_failed(
                        &mut outbox[idx],
                        self.max_retries,
                    );
                }
            }
        }
    }
}
