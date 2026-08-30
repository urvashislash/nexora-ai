use chrono::Utc;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::models::{ActualEvent, AuditEvent, OutboxEvent};

pub struct EventLedger;

impl EventLedger {
    /// Computes SHA-256 hash of an entity state payload with salt/previous hash for blockchain-like audit chaining
    pub fn compute_hash(
        entity_id: &Uuid,
        action: &str,
        payload: &serde_json::Value,
        previous_hash: Option<&str>,
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(entity_id.as_bytes());
        hasher.update(action.as_bytes());
        hasher.update(payload.to_string().as_bytes());
        if let Some(prev) = previous_hash {
            hasher.update(prev.as_bytes());
        }
        format!("{:x}", hasher.finalize())
    }

    /// Creates an immutable audit trail entry
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
        let payload_for_hash = serde_json::json!({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "before": before_state,
            "after": after_state,
        });

        let payload_hash = Self::compute_hash(&entity_id, action, &payload_for_hash, previous_hash);

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
            created_at: Utc::now(),
        }
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
        let hash1 = EventLedger::compute_hash(&entity_id, "CREATE", &payload, None);
        let hash2 = EventLedger::compute_hash(&entity_id, "CREATE", &payload, None);
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64);
    }
}
