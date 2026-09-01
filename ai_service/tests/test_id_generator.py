"""Unit tests for Python RFC 9562 UUIDv7 & TypeID Generation Engine."""

from datetime import datetime, timezone

from app.core.id_generator import (
    CROCKFORD_ALPHABET,
    extract_timestamp_from_uuidv7,
    generate_entity_id,
    generate_idempotency_key,
    generate_uuidv7,
)


def test_uuidv7_structure_and_version():
    u = generate_uuidv7()
    assert u.version == 7
    # Variant 1: bits 10xxxxxx
    assert (u.bytes[8] & 0xC0) == 0x80


def test_uuidv7_monotonic_sorting():
    ids = [generate_uuidv7() for _ in range(50)]
    # Stringified UUIDv7 must sort identically to raw generation order
    sorted_ids = sorted(ids, key=lambda x: str(x))
    assert ids == sorted_ids


def test_uuidv7_timestamp_extraction():
    now_before = datetime.now(timezone.utc).timestamp()
    u = generate_uuidv7()
    extracted = extract_timestamp_from_uuidv7(u)

    assert extracted is not None
    assert abs(extracted.timestamp() - now_before) < 1.0


def test_entity_id_prefix_and_crockford_charset():
    for prefix in ["obs", "prp", "aud", "act"]:
        eid = generate_entity_id(prefix)
        assert eid.startswith(f"{prefix}_")
        suffix = eid.split("_")[1]
        assert all(c in CROCKFORD_ALPHABET for c in suffix)


def test_idempotency_key_deterministic():
    payload = {"project_id": "p-100", "progress": 100}
    k1 = generate_idempotency_key("OBS_INGEST", payload)
    k2 = generate_idempotency_key("OBS_INGEST", payload)
    k3 = generate_idempotency_key("OTHER_SCOPE", payload)

    assert k1 == k2
    assert len(k1) == 64
    assert k1 != k3
