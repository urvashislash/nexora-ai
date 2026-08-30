import json
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from app.core.config import settings


@dataclass(frozen=True)
class ClaimResult:
    acquired: bool
    completed: bool = False
    busy: bool = False


class JobStateStore(Protocol):
    def claim(self, job_id: str) -> ClaimResult: ...

    def checkpoint(self, job_id: str, stage: str, payload: Any) -> None: ...

    def get_checkpoint(self, job_id: str, stage: str) -> Any | None: ...

    def complete(self, job_id: str, result: dict[str, Any]) -> None: ...

    def fail(self, job_id: str, error: str, *, final: bool) -> None: ...


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class RedisJobStateStore:
    def __init__(self, redis_url: str | None = None):
        import redis

        self.client = redis.Redis.from_url(redis_url or settings.REDIS_URL, decode_responses=True)

    @staticmethod
    def _state_key(job_id: str) -> str:
        return f"nexora:ai-job:{job_id}:state"

    @staticmethod
    def _lock_key(job_id: str) -> str:
        return f"nexora:ai-job:{job_id}:lock"

    def _read(self, job_id: str) -> dict[str, Any]:
        raw = self.client.get(self._state_key(job_id))
        return json.loads(raw) if raw else {"checkpoints": {}}

    def _write(self, job_id: str, state: dict[str, Any]) -> None:
        self.client.setex(self._state_key(job_id), settings.JOB_STATE_TTL_SECONDS, json.dumps(state))

    def claim(self, job_id: str) -> ClaimResult:
        state = self._read(job_id)
        if state.get("status") == "COMPLETED":
            return ClaimResult(acquired=False, completed=True)
        acquired = bool(
            self.client.set(
                self._lock_key(job_id),
                _now(),
                nx=True,
                ex=settings.JOB_LOCK_TTL_SECONDS,
            )
        )
        if not acquired:
            return ClaimResult(acquired=False, busy=True)
        state.update({"status": "PROCESSING", "updated_at": _now()})
        self._write(job_id, state)
        return ClaimResult(acquired=True)

    def checkpoint(self, job_id: str, stage: str, payload: Any) -> None:
        state = self._read(job_id)
        checkpoints = state.setdefault("checkpoints", {})
        checkpoints[stage] = {"payload": payload, "completed_at": _now()}
        state.update({"status": "PROCESSING", "updated_at": _now()})
        self._write(job_id, state)
        self.client.expire(self._lock_key(job_id), settings.JOB_LOCK_TTL_SECONDS)

    def get_checkpoint(self, job_id: str, stage: str) -> Any | None:
        checkpoint = self._read(job_id).get("checkpoints", {}).get(stage)
        return checkpoint.get("payload") if checkpoint else None

    def complete(self, job_id: str, result: dict[str, Any]) -> None:
        state = self._read(job_id)
        state.update({"status": "COMPLETED", "result": result, "completed_at": _now(), "updated_at": _now()})
        pipeline = self.client.pipeline()
        pipeline.setex(self._state_key(job_id), settings.JOB_STATE_TTL_SECONDS, json.dumps(state))
        pipeline.delete(self._lock_key(job_id))
        pipeline.execute()

    def fail(self, job_id: str, error: str, *, final: bool) -> None:
        state = self._read(job_id)
        state.update(
            {
                "status": "FAILED" if final else "RETRYING",
                "last_error": error,
                "updated_at": _now(),
            }
        )
        pipeline = self.client.pipeline()
        pipeline.setex(self._state_key(job_id), settings.JOB_STATE_TTL_SECONDS, json.dumps(state))
        pipeline.delete(self._lock_key(job_id))
        pipeline.execute()


class InMemoryJobStateStore:
    """Thread-safe implementation for unit tests and explicit single-process development."""

    def __init__(self):
        self.states: dict[str, dict[str, Any]] = {}
        self.locks: set[str] = set()
        self.mutex = threading.Lock()

    def claim(self, job_id: str) -> ClaimResult:
        with self.mutex:
            state = self.states.get(job_id, {"checkpoints": {}})
            if state.get("status") == "COMPLETED":
                return ClaimResult(acquired=False, completed=True)
            if job_id in self.locks:
                return ClaimResult(acquired=False, busy=True)
            self.locks.add(job_id)
            state.update({"status": "PROCESSING", "updated_at": _now()})
            self.states[job_id] = state
            return ClaimResult(acquired=True)

    def checkpoint(self, job_id: str, stage: str, payload: Any) -> None:
        with self.mutex:
            state = self.states.setdefault(job_id, {"checkpoints": {}})
            state.setdefault("checkpoints", {})[stage] = {"payload": payload, "completed_at": _now()}

    def get_checkpoint(self, job_id: str, stage: str) -> Any | None:
        checkpoint = self.states.get(job_id, {}).get("checkpoints", {}).get(stage)
        return checkpoint.get("payload") if checkpoint else None

    def complete(self, job_id: str, result: dict[str, Any]) -> None:
        with self.mutex:
            state = self.states.setdefault(job_id, {"checkpoints": {}})
            state.update({"status": "COMPLETED", "result": result, "completed_at": _now()})
            self.locks.discard(job_id)

    def fail(self, job_id: str, error: str, *, final: bool) -> None:
        with self.mutex:
            state = self.states.setdefault(job_id, {"checkpoints": {}})
            state.update({"status": "FAILED" if final else "RETRYING", "last_error": error})
            self.locks.discard(job_id)


def build_job_state_store() -> JobStateStore:
    if settings.JOB_STATE_BACKEND.lower() == "memory":
        return InMemoryJobStateStore()
    return RedisJobStateStore()
