import os
import re
import time
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, status

# -----------------------------------------------------------------------------
# File Upload Security & Magic Byte Validation
# -----------------------------------------------------------------------------

ALLOWED_MIME_TYPES = {
    "application/pdf": [b"%PDF-"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [b"PK\x03\x04"],
    "application/vnd.ms-excel": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", b"PK\x03\x04"],
    "text/csv": [],  # Validated as plaintext
    "text/plain": [],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "audio/mpeg": [b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"ID3"],
    "audio/wav": [b"RIFF"],
}

MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_BYTES", 50 * 1024 * 1024))  # 50 MB default


def sanitize_filename(filename: Optional[str]) -> str:
    """
    Sanitizes untrusted filenames to prevent directory traversal and null byte injections.
    """
    if not filename:
        return "unnamed_evidence.bin"

    # Strip path separators and null bytes
    cleaned = os.path.basename(filename.replace("\\", "/"))
    cleaned = cleaned.replace("\x00", "")

    # Restrict to safe alphanumeric characters, dashes, underscores, and dots
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", cleaned)

    # Prevent hidden files (.bashrc, etc.)
    if cleaned.startswith("."):
        cleaned = "upload_" + cleaned

    return cleaned[:255]


def validate_file_content(content: bytes, filename: str, content_type: Optional[str]) -> None:
    """
    Validates uploaded file size, MIME type, and magic bytes against known file signatures.
    Raises HTTPException(400 or 413) if invalid.
    """
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content is empty",
        )

    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
        )

    # Basic MIME validation
    detected_mime = content_type.lower().split(";")[0].strip() if content_type else "application/octet-stream"

    # Extension-based fallback if generic mime
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf" and detected_mime in ("application/octet-stream", "application/pdf"):
        detected_mime = "application/pdf"
    elif ext in (".xlsx", ".xlsm") and "openxmlformats" in detected_mime:
        detected_mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif ext in (".csv", ".txt") and "text" in detected_mime:
        detected_mime = "text/csv" if ext == ".csv" else "text/plain"

    # Check magic bytes for binary files
    magic_signatures = ALLOWED_MIME_TYPES.get(detected_mime)
    if magic_signatures:
        has_valid_magic = any(content.startswith(sig) for sig in magic_signatures)
        if not has_valid_magic:
            # Check if it's a PDF or Image signature regardless of header
            if ext == ".pdf" and not content.startswith(b"%PDF-"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File header does not match a valid PDF signature",
                )


# -----------------------------------------------------------------------------
# In-Memory Rate Limiter for FastAPI
# -----------------------------------------------------------------------------


class RateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter per client IP.
    """

    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60.0
        self.clients: dict[str, list[float]] = defaultdict(list)

    def check(self, client_key: str) -> None:
        now = time.time()
        timestamps = self.clients[client_key]

        # Evict timestamps older than 60s
        self.clients[client_key] = [ts for ts in timestamps if now - ts < self.window_seconds]

        if len(self.clients[client_key]) >= self.requests_per_minute:
            retry_after = int(self.window_seconds - (now - self.clients[client_key][0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        self.clients[client_key].append(now)


extract_rate_limiter = RateLimiter(requests_per_minute=60)
embed_rate_limiter = RateLimiter(requests_per_minute=120)
pipeline_rate_limiter = RateLimiter(requests_per_minute=30)
