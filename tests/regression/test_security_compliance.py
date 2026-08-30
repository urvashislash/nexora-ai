import os
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
import hashlib
from datetime import datetime, timezone

from ai_service.app.main import app
from ai_service.app.core.security import (
    sanitize_filename,
    validate_file_content,
    RateLimiter,
)


@pytest.fixture
def client():
    return TestClient(app)


# =============================================================================
# 1. Security Headers Tests
# =============================================================================

def test_security_headers_present(client):
    """Ensure defense-in-depth security headers are attached to all responses."""
    response = client.get("/health")
    assert response.status_code == 200

    headers = response.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "0"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "Strict-Transport-Security" in headers or "strict-transport-security" in headers
    assert "Content-Security-Policy" in headers or "content-security-policy" in headers


# =============================================================================
# 2. File Upload Hardening Tests
# =============================================================================

def test_sanitize_filename_traversal():
    """Ensure directory traversal characters and dangerous paths are neutralized."""
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\Windows\\System32\\cmd.exe") == "cmd.exe"
    assert sanitize_filename("evidence\x00.pdf") == "evidence.pdf"
    assert sanitize_filename(".hidden_config") == "upload_.hidden_config"
    assert sanitize_filename("valid_report_2026.pdf") == "valid_report_2026.pdf"


def test_validate_file_content_empty():
    """Ensure 0-byte uploads are rejected."""
    with pytest.raises(Exception) as exc_info:
        validate_file_content(b"", "empty.pdf", "application/pdf")
    assert "empty" in str(exc_info.value.detail).lower()


def test_validate_file_content_oversized():
    """Ensure uploads exceeding MAX_UPLOAD_BYTES are rejected with 413."""
    oversized = b"A" * (51 * 1024 * 1024)  # 51 MB
    with pytest.raises(Exception) as exc_info:
        validate_file_content(oversized, "big.pdf", "application/pdf")
    assert "exceeds" in str(exc_info.value.detail).lower()


def test_validate_file_content_invalid_pdf_magic():
    """Ensure files masquerading as PDF without valid %PDF- header are rejected."""
    fake_pdf = b"<html><body>Malicious payload</body></html>"
    with pytest.raises(Exception) as exc_info:
        validate_file_content(fake_pdf, "fake.pdf", "application/pdf")
    assert "pdf signature" in str(exc_info.value.detail).lower()


def test_validate_file_content_valid_pdf():
    """Ensure valid PDF header is accepted."""
    valid_pdf = b"%PDF-1.4\n%Valid minimal PDF content\n%%EOF"
    # Should not raise exception
    validate_file_content(valid_pdf, "valid.pdf", "application/pdf")


# =============================================================================
# 3. Rate Limiting Tests
# =============================================================================

def test_rate_limiter_blocks_abuse():
    """Ensure sliding window rate limiter raises 429 when client threshold is exceeded."""
    limiter = RateLimiter(requests_per_minute=3)
    client_ip = "192.0.2.42"

    # First 3 requests succeed
    limiter.check(client_ip)
    limiter.check(client_ip)
    limiter.check(client_ip)

    # 4th request must fail with 429 Too Many Requests
    with pytest.raises(Exception) as exc_info:
        limiter.check(client_ip)
    assert exc_info.value.status_code == 429
    assert "Rate limit exceeded" in exc_info.value.detail


# =============================================================================
# 4. Cryptographic Hash Chain & Tamper Evidence Tests
# =============================================================================

def test_sha256_audit_chain_tamper_detection():
    """Simulates SHA-256 audit chaining and verifies tamper detection."""
    events = []
    prev_hash = None

    for i in range(5):
        entity_id = str(uuid4())
        action = f"ACTION_{i}"
        payload = f'{{"val": {i}}}'
        ts = datetime.now(timezone.utc).isoformat()

        hasher = hashlib.sha256()
        hasher.update(entity_id.encode("utf-8"))
        hasher.update(action.encode("utf-8"))
        hasher.update(payload.encode("utf-8"))
        hasher.update(ts.encode("utf-8"))
        if prev_hash:
            hasher.update(prev_hash.encode("utf-8"))
        curr_hash = hasher.hexdigest()

        events.append({
            "entity_id": entity_id,
            "action": action,
            "payload": payload,
            "timestamp": ts,
            "prev_hash": prev_hash,
            "hash": curr_hash
        })
        prev_hash = curr_hash

    # Verify original chain
    for i in range(1, len(events)):
        assert events[i]["prev_hash"] == events[i - 1]["hash"]

    # Tamper with record 2
    events[2]["payload"] = '{"val": 999}'  # altered

    # Re-verify record 2 hash
    h = hashlib.sha256()
    h.update(events[2]["entity_id"].encode("utf-8"))
    h.update(events[2]["action"].encode("utf-8"))
    h.update(events[2]["payload"].encode("utf-8"))
    h.update(events[2]["timestamp"].encode("utf-8"))
    if events[2]["prev_hash"]:
        h.update(events[2]["prev_hash"].encode("utf-8"))
    recomputed = h.hexdigest()

    assert recomputed != events[2]["hash"], "Tampering must cause hash mismatch!"
