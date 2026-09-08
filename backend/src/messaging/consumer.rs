use chrono::Utc;
use deadpool_lapin::Pool;
use lapin::options::{BasicAckOptions, BasicConsumeOptions, BasicNackOptions};
use lapin::types::FieldTable;
use serde::Deserialize;
use std::sync::Arc;
use tokio_stream::StreamExt;
use uuid::Uuid;

use crate::api::handlers::AppState;
use crate::cache::RedisCache;
use crate::domain::ledger::EventLedger;
use crate::domain::models::*;
use crate::domain::state_machine::StateMachine;

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
        let message: AIResultMessage = match serde_json::from_slice(data) {
            Ok(msg) => msg,
            Err(e) => {
                tracing::warn!(
                    "Discarding unparseable message on ai_result_queue to prevent poison pill loop: {}",
                    e
                );
                return Ok(());
            }
        };

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

        let doc_id = message
            .document_id
            .as_deref()
            .and_then(|d| d.parse::<Uuid>().ok());

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

        let mut auto_committed_count = 0;
        let mut review_required_count = 0;

        // 1. Ingest raw observations if present (parse completely before acquiring any lock)
        let mut obs_id_map: std::collections::HashMap<String, Uuid> =
            std::collections::HashMap::new();
        let mut parsed_observations: Vec<WorkObservation> = Vec::new();

        if let Some(raw_obs_list) = &message.observations {
            for val in raw_obs_list {
                let obs_id = val
                    .get("id")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<Uuid>().ok())
                    .unwrap_or_else(Uuid::new_v4);

                let raw_text = val
                    .get("raw_text")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string();

                let normalized_text = val
                    .get("normalized_text")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                let discipline: Option<Discipline> = val
                    .get("discipline")
                    .and_then(|v| v.as_str())
                    .and_then(|s| {
                        serde_json::from_value(serde_json::Value::String(s.to_string())).ok()
                    });

                let event_type: Option<EventType> = val
                    .get("event_type")
                    .and_then(|v| v.as_str())
                    .and_then(|s| {
                        serde_json::from_value(serde_json::Value::String(s.to_string())).ok()
                    });

                let location = val
                    .get("location")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let zone = val.get("zone").and_then(|v| v.as_str()).map(String::from);
                let equipment_tag = val
                    .get("equipment_tag")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let unit_of_measure = val
                    .get("unit_of_measure")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let reported_progress = val.get("reported_progress").and_then(|v| v.as_f64());
                let reported_quantity = val.get("reported_quantity").and_then(|v| v.as_f64());

                let work_obs = WorkObservation {
                    id: obs_id,
                    project_id,
                    document_id: doc_id,
                    reported_by: None,
                    observed_at: Some(Utc::now()),
                    recorded_at: Utc::now(),
                    discipline,
                    location,
                    zone,
                    equipment_tag,
                    raw_text: raw_text.clone(),
                    normalized_text,
                    event_type,
                    reported_progress,
                    reported_quantity,
                    unit_of_measure,
                    metadata: val.clone(),
                };

                if let Some(id_str) = val.get("id").and_then(|v| v.as_str()) {
                    obs_id_map.insert(id_str.to_string(), obs_id);
                }
                obs_id_map.insert(raw_text, obs_id);
                parsed_observations.push(work_obs);
            }
        }

        // Persist observations in a short scoped write lock
        if !parsed_observations.is_empty() {
            let mut obs_store = self.state.observations.write().await;
            obs_store.extend(parsed_observations);
        }

        // 2. Prepare proposals and events in-memory with a brief read-lock on activities
        let acts = self.state.activities.read().await.clone();

        let mut proposals_to_insert: Vec<MatchProposal> = Vec::new();
        let mut events_to_insert: Vec<ActualEvent> = Vec::new();
        let mut outbox_to_insert: Vec<OutboxEvent> = Vec::new();
        let mut events_to_project: Vec<(Uuid, ActualEvent, chrono::NaiveDate)> = Vec::new();

        if let Some(proposals_list) = &message.proposals {
            for pval in proposals_list {
                let obs_data = pval.get("observation");
                let obs_raw_text = obs_data
                    .and_then(|o| o.get("raw_text"))
                    .and_then(|t| t.as_str())
                    .unwrap_or_default();
                let obs_id_str = obs_data
                    .and_then(|o| o.get("id"))
                    .and_then(|t| t.as_str())
                    .unwrap_or_default();

                let obs_id = obs_id_map
                    .get(obs_id_str)
                    .or_else(|| obs_id_map.get(obs_raw_text))
                    .copied()
                    .unwrap_or_else(Uuid::new_v4);

                let decision_str = pval
                    .get("decision")
                    .and_then(|v| v.as_str())
                    .unwrap_or("REVIEW_REQUIRED");

                let auto_link_eligible = pval
                    .get("auto_link_eligible")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
                    || decision_str == "AUTO_LINK";

                let top_match = pval.get("top_match").or_else(|| {
                    pval.get("candidates")
                        .and_then(|c| c.as_array())
                        .and_then(|a| a.first())
                });

                if let Some(top) = top_match {
                    let activity_id_str = top
                        .get("activity_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default();
                    let act_id = activity_id_str.parse::<Uuid>().unwrap_or_else(|_| {
                        crate::api::helpers::parse_uuid_or_derive(activity_id_str)
                    });

                    let act_opt = acts.iter().find(|a| a.id == act_id);
                    let confidence_score = top
                        .get("confidence_score")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.85);
                    let lexical_score = top
                        .get("lexical_score")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.80);
                    let semantic_score = top
                        .get("semantic_score")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.80);
                    let context_boost = top
                        .get("context_boost")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.10);
                    let explanation = top
                        .get("explanation")
                        .and_then(|v| v.as_str())
                        .map(String::from);
                    let evidence_snippet = top
                        .get("evidence_snippet")
                        .and_then(|v| v.as_str())
                        .map(String::from);
                    let match_tier: MatchTier = top
                        .get("match_tier")
                        .and_then(|v| v.as_str())
                        .and_then(|s| {
                            serde_json::from_value(serde_json::Value::String(s.to_string())).ok()
                        })
                        .unwrap_or(MatchTier::Medium);

                    let prop_id = Uuid::new_v4();

                    if let (true, Some(act)) = (auto_link_eligible, act_opt) {
                        let actual_date = Utc::now().date_naive();
                        let progress = obs_data
                            .and_then(|o| o.get("reported_progress"))
                            .and_then(|v| v.as_f64())
                            .unwrap_or(100.0);

                        let reported_qty = obs_data
                            .and_then(|o| o.get("reported_quantity"))
                            .and_then(|v| v.as_f64());

                        let new_event = ActualEvent {
                            id: Uuid::new_v4(),
                            project_id,
                            activity_id: act.id,
                            observation_id: Some(obs_id),
                            match_proposal_id: Some(prop_id),
                            event_type: EventType::Finish,
                            actual_date,
                            actual_progress_pct: Some(progress),
                            actual_quantity: reported_qty.or(act.planned_quantity),
                            delay_reason: None,
                            delay_days: None,
                            lifecycle_status: LifecycleStatus::Committed,
                            verification_status: VerificationStatus::SystemVerified,
                            idempotency_key: Some(format!(
                                "async-autolink-{}-{}",
                                act.id, actual_date
                            )),
                            created_by: None,
                            created_at: Utc::now(),
                        };

                        events_to_project.push((
                            act.id,
                            new_event.clone(),
                            act.planned_finish_date,
                        ));

                        let proposal = MatchProposal {
                            id: prop_id,
                            project_id,
                            observation_id: obs_id,
                            activity_id: act.id,
                            candidate_rank: 1,
                            lexical_score,
                            semantic_score,
                            context_boost,
                            confidence_score,
                            match_tier,
                            explanation,
                            evidence_snippet,
                            status: "AUTO_LINKED".to_string(),
                            created_at: Utc::now(),
                        };

                        let outbox = EventLedger::create_outbox_event(
                            project_id,
                            "AUTO_LINKED_EVENT",
                            &new_event,
                        );
                        outbox_to_insert.push(outbox);
                        proposals_to_insert.push(proposal);
                        events_to_insert.push(new_event);
                        auto_committed_count += 1;
                    } else if let Some(act) = act_opt {
                        let proposal = MatchProposal {
                            id: prop_id,
                            project_id,
                            observation_id: obs_id,
                            activity_id: act.id,
                            candidate_rank: 1,
                            lexical_score,
                            semantic_score,
                            context_boost,
                            confidence_score,
                            match_tier,
                            explanation,
                            evidence_snippet,
                            status: "PENDING_REVIEW".to_string(),
                            created_at: Utc::now(),
                        };
                        proposals_to_insert.push(proposal);
                        review_required_count += 1;
                    }
                }
            }
        }

        // 3. Persist proposals, events, and state machine transitions in a single atomic scoped write
        if !proposals_to_insert.is_empty() || !events_to_insert.is_empty() {
            let mut prop_store = self.state.proposals.write().await;
            let mut events_store = self.state.events.write().await;
            let mut act_states = self.state.activity_states.write().await;
            let mut outbox_store = self.state.outbox_events.write().await;

            for (act_id, event, planned_finish) in &events_to_project {
                if let Some(state_entry) = act_states.iter_mut().find(|s| s.activity_id == *act_id)
                {
                    let _ = StateMachine::project_event(state_entry, event, *planned_finish);
                }
            }

            prop_store.extend(proposals_to_insert);
            events_store.extend(events_to_insert);
            outbox_store.extend(outbox_to_insert);
        }

        // 4. Create unified audit trail entry in a brief scoped lock
        {
            let mut audit_trail = self.state.audit_trail.write().await;
            let mut last_hash = self.state.last_audit_hash.write().await;

            let audit = EventLedger::create_audit_event(
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
                    "auto_link": auto_committed_count,
                    "review_required": review_required_count,
                })),
                last_hash.as_deref(),
            );
            *last_hash = Some(audit.payload_hash.clone());
            audit_trail.push(audit);
        }

        // Invalidate Redis caches for the affected project
        if let Some(cache) = &self.cache {
            let _ = cache.invalidate_project(project_id).await;
        }

        Ok(())
    }
}
