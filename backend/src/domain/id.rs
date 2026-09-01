//! NEXORA AI — Rust Trust Plane ID Generation Algorithm Engine
//!
//! Implements:
//! 1. RFC 9562 UUIDv7: 128-bit time-ordered cryptographic UUIDs.
//! 2. TypeID / Crockford Base32 domain-prefixed entity identifiers.
//! 3. Content-addressable SHA-256 Idempotency Key derivation.

use chrono::{DateTime, TimeZone, Utc};
use sha2::{Digest, Sha256};
use uuid::Uuid;

const CROCKFORD_ALPHABET: &[u8] = b"0123456789abcdefghjkmnpqrstvwxyz";

/// Generates an RFC 9562 compliant time-ordered UUIDv7.
pub fn generate_uuidv7() -> Uuid {
    Uuid::now_v7()
}

/// Encodes a 16-byte UUID into Crockford's Base32 string.
pub fn encode_crockford_base32(uuid_val: &Uuid) -> String {
    let bytes = uuid_val.as_bytes();
    let mut buffer: u128 = 0;
    let mut bits_left = 0;
    let mut chars = Vec::with_capacity(26);

    for &b in bytes {
        buffer = (buffer << 8) | (b as u128);
        bits_left += 8;

        while bits_left >= 5 {
            bits_left -= 5;
            let index = ((buffer >> bits_left) & 0x1F) as usize;
            chars.push(CROCKFORD_ALPHABET[index]);
        }
    }

    if bits_left > 0 {
        let index = ((buffer << (5 - bits_left)) & 0x1F) as usize;
        chars.push(CROCKFORD_ALPHABET[index]);
    }

    String::from_utf8(chars).unwrap_or_default()
}

/// Generates a domain-prefixed TypeID (e.g. `obs_01j7q9k2x...`).
pub fn generate_type_id(prefix: &str) -> String {
    let u7 = generate_uuidv7();
    let b32 = encode_crockford_base32(&u7);
    format!("{prefix}_{b32}")
}

/// Extracts the UTC datetime from an RFC 9562 UUIDv7.
pub fn extract_timestamp_v7(id: &Uuid) -> Option<DateTime<Utc>> {
    if id.get_version_num() != 7 {
        return None;
    }

    let bytes = id.as_bytes();
    let mut ts_bytes = [0u8; 8];
    ts_bytes[2..8].copy_from_slice(&bytes[..6]);
    let ts_ms = u64::from_be_bytes(ts_bytes) as i64;

    Utc.timestamp_millis_opt(ts_ms).single()
}

/// Derives a deterministic SHA-256 idempotency key.
pub fn derive_idempotency_key(scope: &str, payload: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(scope.as_bytes());
    hasher.update(b"::");
    hasher.update(payload.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uuidv7_version_and_sorting() {
        let u1 = generate_uuidv7();
        assert_eq!(u1.get_version_num(), 7);

        let mut ids = Vec::new();
        for _ in 0..50 {
            ids.push(generate_uuidv7());
        }

        let mut sorted = ids.clone();
        sorted.sort();
        assert_eq!(ids, sorted);
    }

    #[test]
    fn test_type_id_format() {
        let tid = generate_type_id("obs");
        assert!(tid.starts_with("obs_"));
        assert!(tid.len() > 10);
    }

    #[test]
    fn test_timestamp_extraction() {
        let before = Utc::now().timestamp_millis();
        let u = generate_uuidv7();
        let extracted = extract_timestamp_v7(&u).expect("Should extract timestamp");
        let diff = (extracted.timestamp_millis() - before).abs();
        assert!(diff < 1000);
    }

    #[test]
    fn test_idempotency_derivation() {
        let k1 = derive_idempotency_key("EVENT", "payload1");
        let k2 = derive_idempotency_key("EVENT", "payload1");
        let k3 = derive_idempotency_key("EVENT", "payload2");

        assert_eq!(k1, k2);
        assert_ne!(k1, k3);
        assert_eq!(k1.len(), 64);
    }
}
