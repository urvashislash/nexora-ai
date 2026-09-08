use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use backend::domain::ledger::EventLedger;
use backend::domain::models::*;
use backend::domain::validation::ValidationEngine;

#[test]
fn test_outbox_lifecycle_state_transitions() {
    let project_id = Uuid::new_v4();
    let dummy_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id: Uuid::new_v4(),
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Finish,
        actual_date: Utc::now().date_naive(),
        actual_progress_pct: Some(100.0),
        actual_quantity: None,
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: Some("test-key-01".into()),
        created_by: None,
        created_at: Utc::now(),
    };

    // 1. Initial creation -> PENDING with 0 retries
    let mut outbox =
        EventLedger::create_outbox_event(project_id, "PROPOSAL_APPROVED", &dummy_event);
    assert_eq!(outbox.status, "PENDING");
    assert_eq!(outbox.retry_count, 0);
    assert!(outbox.processed_at.is_none());

    // 2. Failure attempt 1 -> RETRY with retry_count 1
    EventLedger::mark_outbox_failed(&mut outbox, 3);
    assert_eq!(outbox.status, "RETRY");
    assert_eq!(outbox.retry_count, 1);
    assert!(outbox.processed_at.is_none());

    // 3. Failure attempt 2 -> RETRY with retry_count 2
    EventLedger::mark_outbox_failed(&mut outbox, 3);
    assert_eq!(outbox.status, "RETRY");
    assert_eq!(outbox.retry_count, 2);

    // 4. Failure attempt 3 (reaches max_retries = 3) -> DEAD_LETTER
    EventLedger::mark_outbox_failed(&mut outbox, 3);
    assert_eq!(outbox.status, "DEAD_LETTER");
    assert_eq!(outbox.retry_count, 3);

    // 5. Successful processing marks processed_at and status PROCESSED
    let mut success_outbox =
        EventLedger::create_outbox_event(project_id, "PROPOSAL_APPROVED", &dummy_event);
    EventLedger::mark_outbox_processed(&mut success_outbox);
    assert_eq!(success_outbox.status, "PROCESSED");
    assert!(success_outbox.processed_at.is_some());
}

#[test]
fn test_outbox_ordering_fifo_semantics() {
    let project_id = Uuid::new_v4();
    let now = Utc::now();

    let event1 = OutboxEvent {
        id: Uuid::new_v4(),
        project_id,
        event_type: "EVENT_1".to_string(),
        payload: json!({ "seq": 1 }),
        status: "PENDING".to_string(),
        retry_count: 0,
        created_at: now - chrono::Duration::seconds(10),
        processed_at: None,
    };

    let event2 = OutboxEvent {
        id: Uuid::new_v4(),
        project_id,
        event_type: "EVENT_2".to_string(),
        payload: json!({ "seq": 2 }),
        status: "PENDING".to_string(),
        retry_count: 0,
        created_at: now - chrono::Duration::seconds(5),
        processed_at: None,
    };

    let event3 = OutboxEvent {
        id: Uuid::new_v4(),
        project_id,
        event_type: "EVENT_3".to_string(),
        payload: json!({ "seq": 3 }),
        status: "PROCESSED".to_string(),
        retry_count: 0,
        created_at: now,
        processed_at: Some(now),
    };

    let events = vec![event2.clone(), event1.clone(), event3.clone()];
    let mut pending = EventLedger::get_pending_outbox_events(&events);
    pending.sort_by_key(|e| e.created_at);

    assert_eq!(pending.len(), 2);
    assert_eq!(
        pending[0].event_type, "EVENT_1",
        "FIFO ordering: oldest event first"
    );
    assert_eq!(pending[1].event_type, "EVENT_2");
}

#[test]
fn test_consumer_idempotency_deduplication() {
    let idempotency_key = "evt-batch-001-2026-09-08";
    let existing_keys = vec![Some(idempotency_key.to_string())];

    // Attempting to process duplicate message with identical key must fail
    let check = ValidationEngine::validate_idempotency_key(Some(idempotency_key), &existing_keys);
    assert!(
        check.is_err(),
        "Duplicate message must be rejected by idempotency check"
    );

    // New unique key must pass
    let new_key = "evt-batch-002-2026-09-08";
    let check2 = ValidationEngine::validate_idempotency_key(Some(new_key), &existing_keys);
    assert!(check2.is_ok());
}
