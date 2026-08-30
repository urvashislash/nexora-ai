use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::models::{ActualEvent, AuditEvent, OutboxEvent};

pub struct EventLedger;

#[allow(dead_code)]
impl EventLedger {
    /// Computes SHA-256 hash of an entity state payload with timestamp and previous hash
    /// for blockchain-like audit chaining.
    ///
    /// Including `created_at` ensures that identical payloads at different times produce
    /// different hashes, preventing replay attacks.
    pub fn compute_hash(
        entity_id: &Uuid,
        action: &str,
        payload: &serde_json::Value,
        previous_hash: Option<&str>,
        created_at: &DateTime<Utc>,
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(entity_id.as_bytes());
        hasher.update(action.as_bytes());
        hasher.update(payload.to_string().as_bytes());
        hasher.update(created_at.to_rfc3339().as_bytes());
        if let Some(prev) = previous_hash {
            hasher.update(prev.as_bytes());
        }
        format!("{:x}", hasher.finalize())
    }

    /// Creates an immutable audit trail entry with hash chaining
    #[allow(clippy::too_many_arguments)]
    pub fn create_audit_event(
        project_id: Uuid,
        entity_type: &str,
        entity_id: Uuid,
        action: &str,
        actor_id: Option<Uuid>,
        actor_role: Option<&str>,
        before_state: Option<serde_json::Value>,
        after_state: Option<serde_json::Value>,
        previous_hash: Option<&str>,
    ) -> AuditEvent {
        let created_at = Utc::now();

        let payload_for_hash = serde_json::json!({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "before": before_state,
            "after": after_state,
        });

        let payload_hash =
            Self::compute_hash(&entity_id, action, &payload_for_hash, previous_hash, &created_at);

        AuditEvent {
            id: Uuid::new_v4(),
            project_id,
            entity_type: entity_type.to_string(),
            entity_id,
            action: action.to_string(),
            actor_id,
            actor_role: actor_role.map(|s| s.to_string()),
            before_state,
            after_state,
            payload_hash,
            previous_hash: previous_hash.map(|s| s.to_string()),
            created_at,
        }
    }

    /// Verifies the integrity of a chain of audit events.
    ///
    /// Returns `Ok(())` if:
    /// - The first event has `previous_hash == None`
    /// - Each subsequent event's `previous_hash` matches the preceding event's `payload_hash`
    /// - Each event's `payload_hash` can be recomputed from its fields
    ///
    /// Returns `Err(index)` with the index of the first broken link.
    pub fn verify_chain_integrity(chain: &[AuditEvent]) -> Result<(), usize> {
        if chain.is_empty() {
            return Ok(());
        }

        // Verify the first event has no previous hash
        if chain[0].previous_hash.is_some() {
            return Err(0);
        }

        // Verify the first event's own hash is valid
        if !Self::verify_single_hash(&chain[0]) {
            return Err(0);
        }

        for i in 1..chain.len() {
            // Each event must chain to the previous event's payload_hash
            match &chain[i].previous_hash {
                Some(prev) if prev == &chain[i - 1].payload_hash => {}
                _ => return Err(i),
            }

            // Verify the event's own hash integrity
            if !Self::verify_single_hash(&chain[i]) {
                return Err(i);
            }
        }

        Ok(())
    }

    /// Recomputes a single audit event's hash from its fields and compares it
    /// against the stored `payload_hash` to detect tampering.
    pub fn verify_single_hash(event: &AuditEvent) -> bool {
        let payload_for_hash = serde_json::json!({
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "action": event.action,
            "before": event.before_state,
            "after": event.after_state,
        });

        let recomputed = Self::compute_hash(
            &event.entity_id,
            &event.action,
            &payload_for_hash,
            event.previous_hash.as_deref(),
            &event.created_at,
        );

        recomputed == event.payload_hash
    }

    /// Prepares an outbox event for reliable asynchronous delivery to external PMIS / exports
    pub fn create_outbox_event(
        project_id: Uuid,
        event_type: &str,
        event: &ActualEvent,
    ) -> OutboxEvent {
        OutboxEvent {
            id: Uuid::new_v4(),
            project_id,
            event_type: event_type.to_string(),
            payload: serde_json::to_value(event).unwrap_or(serde_json::json!({})),
            status: "PENDING".to_string(),
            retry_count: 0,
            created_at: Utc::now(),
            processed_at: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_hash_reproducibility() {
        let entity_id = Uuid::new_v4();
        let payload = serde_json::json!({"test": "data", "val": 42});
        let ts = Utc::now();
        let hash1 = EventLedger::compute_hash(&entity_id, "CREATE", &payload, None, &ts);
        let hash2 = EventLedger::compute_hash(&entity_id, "CREATE", &payload, None, &ts);
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64);
    }
}
