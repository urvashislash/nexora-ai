"""
NEXORA AI — Python ID Generation Algorithm Engine

Implements:
1. RFC 9562 UUIDv7: 128-bit time-ordered cryptographic UUIDs with sub-millisecond precision.
2. TypeID / Crockford Base32: Structured domain-prefixed entity identifiers (obs_..., prp_..., aud_...).
3. Deterministic SHA-256 Idempotency Key & Block ID Generator.
4. Timestamp deserialization from UUIDv7 strings.
"""

import time
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional, Literal
from uuid import UUID

CROCKFORD_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"
EntityType = Literal["obs", "prp", "evt", "aud", "doc", "act", "req", "job"]

_last_timestamp_ms: int = 0
_sequence_counter: int = 0


def generate_uuidv7() -> UUID:
    """
    Generates an RFC 9562 compliant UUIDv7.

    Layout (128 bits):
    - unix_ts_ms (48 bits): Milliseconds since Unix Epoch (big-endian)
    - ver (4 bits): 0111 (Version 7)
    - rand_a / seq (12 bits): Monotonic sequence counter
    - var (2 bits): 10 (RFC 4122/9562 Variant)
    - rand_b (62 bits): Cryptographically secure pseudo-random bytes
    """
    global _last_timestamp_ms, _sequence_counter

    now_ms = int(time.time() * 1000)

    # Monotonic clock tracking
    if now_ms > _last_timestamp_ms:
        _last_timestamp_ms = now_ms
        _sequence_counter = 0
    elif now_ms == _last_timestamp_ms:
        _sequence_counter = (_sequence_counter + 1) & 0x0FFF
        if _sequence_counter == 0:
            # Sequence roll within same millisecond -> simulate clock tick
            _last_timestamp_ms += 1
            now_ms = _last_timestamp_ms
    else:
        # Clock drifted backward -> maintain monotonicity
        now_ms = _last_timestamp_ms
        _sequence_counter = (_sequence_counter + 1) & 0x0FFF

    # 48 bits timestamp
    ts_bytes = now_ms.to_bytes(6, byteorder="big")

    # 4 bits ver=7 (0x7000) + 12 bits sequence
    ver_and_seq = (0x7000 | (_sequence_counter & 0x0FFF)).to_bytes(2, byteorder="big")

    # 2 bits var=0b10 (0x80) + 14 bits rand + 48 bits rand_b
    random_bytes = bytearray(secrets.token_bytes(8))
    random_bytes[0] = (random_bytes[0] & 0x3F) | 0x80  # Variant 10xxxxxx

    raw_bytes = ts_bytes + ver_and_seq + bytes(random_bytes)
    return UUID(bytes=raw_bytes)


def encode_crockford_base32(uuid_val: UUID) -> str:
    """Encodes a 16-byte UUID into Crockford's Base32 string."""
    raw = uuid_val.bytes
    buffer = 0
    bits_left = 0
    chars = []

    for byte in raw:
        buffer = (buffer << 8) | byte
        bits_left += 8
        while bits_left >= 5:
            bits_left -= 5
            index = (buffer >> bits_left) & 0x1F
            chars.append(CROCKFORD_ALPHABET[index])

    if bits_left > 0:
        index = (buffer << (5 - bits_left)) & 0x1F
        chars.append(CROCKFORD_ALPHABET[index])

    return "".join(chars)


def generate_entity_id(prefix: EntityPrefix) -> str:
    """
    Generates a domain-prefixed TypeID (e.g. `obs_01j7q9k2x...`).
    """
    u7 = generate_uuidv7()
    base32 = encode_crockford_base32(u7)
    return f"{prefix}_{base32}"


def extract_timestamp_from_uuidv7(uuid_val: UUID | str) -> Optional[datetime]:
    """
    Extracts the UTC datetime encoded inside an RFC 9562 UUIDv7.
    """
    if isinstance(uuid_val, str):
        try:
            uuid_val = UUID(uuid_val)
        except ValueError:
            return None

    if uuid_val.version != 7:
        return None

    raw = uuid_val.bytes
    ts_ms = int.from_bytes(raw[:6], byteorder="big")
    return datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)


def generate_idempotency_key(scope: str, payload: str | dict) -> str:
    """
    Derives a deterministic SHA-256 idempotency key from a request payload and scope.
    """
    raw_str = payload if isinstance(payload, str) else str(sorted(payload.items()))
    combined = f"{scope}::{raw_str}".encode("utf-8")
    return hashlib.sha256(combined).hexdigest()
