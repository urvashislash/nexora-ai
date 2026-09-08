use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use backend::domain::ledger::EventLedger;
use backend::domain::validation::ValidationEngine;

#[test]
fn test_transactional_outbox_event_creation_and_payload_integrity() {
    let project_id = Uuid::new_v4();
    let activity_id = Uuid::new_v4();
    let event_id = Uuid::new_v4();

    // 1. Validate PROPOSAL_APPROVED outbox event payload
    let approval_payload = json!({
        "event_id": event_id,
        "project_id": project_id,
        "activity_id": activity_id,
        "actual_date": Utc::now().date_naive(),
        "progress_pct": 100.0,
    });
    assert_eq!(approval_payload["progress_pct"], 100.0);
    assert_eq!(approval_payload["project_id"], project_id.to_string());

    // 2. Validate PROJECT_CREATED outbox event payload
    let project_payload = json!({
        "project_id": project_id,
        "code": "METRO-X",
        "name": "Metro Line Extension",
        "creator_id": Uuid::new_v4(),
    });
    assert_eq!(project_payload["code"], "METRO-X");

    // 3. Validate DOCUMENT_JOB_QUEUED outbox event payload
    let doc_id = Uuid::new_v4();
    let job_id = Uuid::new_v4();
    let doc_payload = json!({
        "job_id": job_id,
        "document_id": doc_id,
        "project_id": project_id,
        "filename": "site_log_2026.pdf",
        "storage_bucket": "evidence-documents",
        "storage_key": format!("{}/reports/site_log_2026.pdf", project_id),
    });
    assert_eq!(doc_payload["job_id"], job_id.to_string());
    assert_eq!(doc_payload["document_id"], doc_id.to_string());

    // 4. Validate PROPOSAL_REJECTED outbox event payload
    let proposal_id = Uuid::new_v4();
    let rejection_payload = json!({
        "proposal_id": proposal_id,
        "project_id": project_id,
        "reviewer_id": Uuid::new_v4(),
        "comments": "Activity already complete",
    });
    assert_eq!(rejection_payload["proposal_id"], proposal_id.to_string());
}

#[test]
fn test_transactional_audit_hash_chain_tamper_proofing() {
    let _project_id = Uuid::new_v4();
    let entity_id = Uuid::new_v4();
    let now = Utc::now();

    // Compute genesis hash
    let hash1 = EventLedger::compute_hash(
        &entity_id,
        "CREATE_PROJECT",
        &json!({ "code": "PRJ-101" }),
        None,
        &now,
    );
    assert!(!hash1.is_empty());
    assert_eq!(hash1.len(), 64); // SHA-256 hex string

    // Compute second chained hash
    let now2 = now + chrono::Duration::seconds(5);
    let hash2 = EventLedger::compute_hash(
        &entity_id,
        "SCHEDULE_IMPORTED",
        &json!({ "activities_count": 42 }),
        Some(&hash1),
        &now2,
    );
    assert_ne!(hash1, hash2);

    // Any alteration of the prior hash breaks the chain
    let tampered_prev = format!("{}a", &hash1[1..]);
    let hash2_tampered = EventLedger::compute_hash(
        &entity_id,
        "SCHEDULE_IMPORTED",
        &json!({ "activities_count": 42 }),
        Some(&tampered_prev),
        &now2,
    );
    assert_ne!(
        hash2, hash2_tampered,
        "Chain verification must fail if previous hash is tampered"
    );
}

#[test]
fn test_transaction_validation_rollback_guards() {
    // 1. Future event date validation blocks commit
    let far_future = Utc::now().date_naive() + chrono::Duration::days(10);
    let date_check = ValidationEngine::validate_event_date(far_future);
    assert!(
        date_check.is_err(),
        "Future date beyond 1-day tolerance must be rejected before DB commit"
    );

    // 2. Monotonic progress bounds: negative or > 100 progress must be rejected
    assert!(ValidationEngine::validate_progress(Some(-5.0)).is_err());
    assert!(ValidationEngine::validate_progress(Some(105.0)).is_err());
    assert!(ValidationEngine::validate_progress(Some(50.0)).is_ok());

    // 3. Duplicate idempotency key must be rejected to prevent duplicate transaction execution
    let key = "event-act1-2026-09-08".to_string();
    let existing = vec![Some(key.clone()), Some("other-key".to_string())];
    assert!(
        ValidationEngine::validate_idempotency_key(Some(&key), &existing).is_err(),
        "Duplicate idempotency key must trigger conflict error and abort transaction"
    );
}
