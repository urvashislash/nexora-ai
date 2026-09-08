use chrono::{Duration, Utc};
use serde_json::json;
use uuid::Uuid;

use backend::domain::ledger::{AuditRetentionPolicy, EventLedger};
use backend::domain::models::AuditEvent;

#[test]
fn test_audit_hash_chain_genesis_and_continuity() {
    let project_id = Uuid::new_v4();
    let entity_id = Uuid::new_v4();
    let now = Utc::now();

    // 1. Genesis event (previous_hash: None)
    let payload1 = json!({
        "entity_type": "PROJECT",
        "entity_id": entity_id,
        "action": "CREATE",
        "before": null,
        "after": { "name": "Airport Terminal 3" },
    });
    let hash1 = EventLedger::compute_hash(&entity_id, "CREATE", &payload1, None, &now);

    let event1 = AuditEvent {
        id: Uuid::new_v4(),
        project_id,
        entity_type: "PROJECT".into(),
        entity_id,
        action: "CREATE".into(),
        actor_id: Some(Uuid::new_v4()),
        actor_role: Some("ADMIN".into()),
        before_state: None,
        after_state: Some(json!({ "name": "Airport Terminal 3" })),
        payload_hash: hash1.clone(),
        previous_hash: None,
        created_at: now,
    };

    // 2. Second event chained to hash1
    let now2 = now + Duration::seconds(2);
    let payload2 = json!({
        "entity_type": "SCHEDULE",
        "entity_id": entity_id,
        "action": "IMPORT",
        "before": null,
        "after": { "activities": 50 },
    });
    let hash2 = EventLedger::compute_hash(&entity_id, "IMPORT", &payload2, Some(&hash1), &now2);

    let event2 = AuditEvent {
        id: Uuid::new_v4(),
        project_id,
        entity_type: "SCHEDULE".into(),
        entity_id,
        action: "IMPORT".into(),
        actor_id: Some(Uuid::new_v4()),
        actor_role: Some("PLANNER".into()),
        before_state: None,
        after_state: Some(json!({ "activities": 50 })),
        payload_hash: hash2.clone(),
        previous_hash: Some(hash1.clone()),
        created_at: now2,
    };

    let chain = vec![event1.clone(), event2.clone()];
    assert!(
        EventLedger::verify_chain_integrity(&chain).is_ok(),
        "Chain of valid events must verify"
    );

    // 3. Tamper with event 1 payload
    let mut tampered_chain = chain.clone();
    tampered_chain[0].after_state = Some(json!({ "name": "TAMPERED VALUE" }));
    let res = EventLedger::verify_chain_integrity(&tampered_chain);
    assert_eq!(
        res,
        Err(0),
        "Tampered event 0 must fail verification at index 0"
    );

    // 4. Tamper with previous_hash link on event 2
    let mut broken_link_chain = chain.clone();
    broken_link_chain[1].previous_hash = Some("corrupted-hash".into());
    let res2 = EventLedger::verify_chain_integrity(&broken_link_chain);
    assert_eq!(
        res2,
        Err(1),
        "Broken previous_hash link must fail at index 1"
    );
}

#[test]
fn test_statutory_retention_and_legal_hold_enforcement() {
    let policy = AuditRetentionPolicy::default();
    assert_eq!(
        policy.statutory_retention_days, 2555,
        "Statutory requirement is 7 years (2555 days)"
    );
    assert_eq!(
        policy.hot_retention_days, 90,
        "Hot retention partition is 90 days"
    );
    assert!(policy.enforce_legal_hold);

    let project_id = Uuid::new_v4();
    let entity_id = Uuid::new_v4();
    let old_date = Utc::now() - Duration::days(120);

    let payload = json!({
        "entity_type": "EVENT",
        "entity_id": entity_id,
        "action": "COMMIT",
        "before": null,
        "after": { "pct": 100 },
    });
    let hash = EventLedger::compute_hash(&entity_id, "COMMIT", &payload, None, &old_date);

    let old_event = AuditEvent {
        id: Uuid::new_v4(),
        project_id,
        entity_type: "EVENT".into(),
        entity_id,
        action: "COMMIT".into(),
        actor_id: Some(Uuid::new_v4()),
        actor_role: Some("PLANNER".into()),
        before_state: None,
        after_state: Some(json!({ "pct": 100 })),
        payload_hash: hash,
        previous_hash: None,
        created_at: old_date,
    };

    let chain = vec![old_event];

    // When legal hold is ACTIVE, archival MUST fail
    let archive_attempt = EventLedger::prepare_audit_archive(
        project_id, &chain, &policy, true, // legal hold active
    );
    assert!(archive_attempt.is_err());
    assert!(archive_attempt.unwrap_err().contains("legal hold"));

    // When legal hold is RELEASED, archival of >90 day records MUST succeed
    let archive_success = EventLedger::prepare_audit_archive(
        project_id, &chain, &policy, false, // legal hold released
    );
    assert!(archive_success.is_ok());
    let (batch, to_archive, hot) = archive_success.unwrap().expect("Batch must be generated");
    assert_eq!(batch.record_count, 1);
    assert_eq!(to_archive.len(), 1);
    assert_eq!(hot.len(), 0);
}
