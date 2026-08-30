import base64
import binascii
import hashlib
import json
import logging
import time
from typing import Any
from urllib.parse import quote

import httpx
import pika
from pydantic import ValidationError

from app.core.config import settings
from app.models.schemas import MatchDecisionEnum, NormalizedObservation, ProcessDocumentMessage
from app.services.extractor import DocumentExtractor
from app.services.matcher import HybridMatcher
from app.services.media import MediaBackendUnavailableError, MediaProcessingError
from app.workers.job_state import JobStateStore, build_job_state_store

logger = logging.getLogger(__name__)


class EvidenceAccessError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool):
        super().__init__(message)
        self.retryable = retryable


class AIQueueWorker:
    def __init__(self, state_store: JobStateStore | None = None):
        self.connection: pika.BlockingConnection | None = None
        self.channel: pika.adapters.blocking_connection.BlockingChannel | None = None
        self.state_store = state_store or build_job_state_store()

    def connect(self) -> None:
        params = pika.URLParameters(settings.RABBITMQ_URL)
        params.heartbeat = 60
        params.blocked_connection_timeout = 120
        last_error: Exception | None = None
        for attempt in range(settings.QUEUE_CONNECTION_ATTEMPTS):
            try:
                self.connection = pika.BlockingConnection(params)
                self.channel = self.connection.channel()
                self._declare_topology()
                self.channel.confirm_delivery()
                logger.info("Connected to RabbitMQ and enabled publisher confirms")
                return
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                logger.warning(
                    "RabbitMQ connection attempt %s/%s failed: %s",
                    attempt + 1,
                    settings.QUEUE_CONNECTION_ATTEMPTS,
                    exc,
                )
                time.sleep(min(2**attempt, 10))
        raise ConnectionError("Unable to connect to RabbitMQ") from last_error

    def _declare_topology(self) -> None:
        if self.channel is None:
            raise RuntimeError("RabbitMQ channel is not open")
        self.channel.exchange_declare(
            exchange=settings.RABBITMQ_EXCHANGE,
            exchange_type="direct",
            durable=True,
        )
        self.channel.queue_declare(queue=settings.QUEUE_AI_RESULT, durable=True)
        self.channel.queue_bind(
            queue=settings.QUEUE_AI_RESULT,
            exchange=settings.RABBITMQ_EXCHANGE,
            routing_key="document.result",
        )
        self.channel.queue_declare(queue=settings.QUEUE_AI_DLQ, durable=True)
        self.channel.queue_bind(
            queue=settings.QUEUE_AI_DLQ,
            exchange=settings.RABBITMQ_EXCHANGE,
            routing_key="document.failed",
        )
        self.channel.queue_declare(
            queue=settings.QUEUE_AI_RETRY,
            durable=True,
            arguments={
                "x-message-ttl": settings.QUEUE_RETRY_DELAY_MS,
                "x-dead-letter-exchange": settings.RABBITMQ_EXCHANGE,
                "x-dead-letter-routing-key": "document.process",
            },
        )
        self.channel.queue_bind(
            queue=settings.QUEUE_AI_RETRY,
            exchange=settings.RABBITMQ_EXCHANGE,
            routing_key="document.retry",
        )
        self.channel.queue_declare(
            queue=settings.QUEUE_AI_PROCESSING,
            durable=True,
            arguments={
                "x-dead-letter-exchange": settings.RABBITMQ_EXCHANGE,
                "x-dead-letter-routing-key": "document.failed",
            },
        )
        self.channel.queue_bind(
            queue=settings.QUEUE_AI_PROCESSING,
            exchange=settings.RABBITMQ_EXCHANGE,
            routing_key="document.process",
        )

    def _load_evidence(self, message: ProcessDocumentMessage) -> bytes | str:
        if message.text_content is not None:
            return message.text_content
        if message.content_base64:
            try:
                content = base64.b64decode(message.content_base64, validate=True)
            except (ValueError, binascii.Error) as exc:
                raise MediaProcessingError("content_base64 is invalid") from exc
            if len(content) > settings.MAX_UPLOAD_BYTES:
                raise MediaProcessingError("Inline evidence exceeds the configured processing limit")
            return content
        if not message.storage_key:
            raise MediaProcessingError("Job does not contain inline evidence or a storage key")
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise MediaBackendUnavailableError("Supabase storage credentials are required to load storage_key evidence")

        bucket = message.storage_bucket or settings.SUPABASE_STORAGE_BUCKET
        encoded_key = quote(message.storage_key.lstrip("/"), safe="/")
        url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/authenticated/{quote(bucket)}/{encoded_key}"
        try:
            with httpx.Client(timeout=30.0, follow_redirects=False) as client:
                response = client.get(
                    url,
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    },
                )
            if response.status_code >= 500:
                raise EvidenceAccessError(f"Evidence storage returned HTTP {response.status_code}", retryable=True)
            if response.status_code >= 400:
                raise EvidenceAccessError(f"Evidence storage returned HTTP {response.status_code}", retryable=False)
            if len(response.content) > settings.MAX_UPLOAD_BYTES:
                raise EvidenceAccessError("Stored evidence exceeds the processing limit", retryable=False)
            return response.content
        except EvidenceAccessError:
            raise
        except httpx.TransportError as exc:
            raise EvidenceAccessError(f"Unable to load evidence from storage: {exc}", retryable=True) from exc

    def process_job(self, message: ProcessDocumentMessage) -> dict[str, Any]:
        job_id = str(message.job_id)
        cached_observations = self.state_store.get_checkpoint(job_id, "EXTRACT_NORMALIZE")
        if cached_observations is None:
            evidence = self._load_evidence(message)
            evidence_bytes = evidence.encode("utf-8") if isinstance(evidence, str) else evidence
            evidence_fingerprint = hashlib.sha256(evidence_bytes).hexdigest()
            self.state_store.checkpoint(job_id, "EVIDENCE_FINGERPRINT", evidence_fingerprint)
            observations = DocumentExtractor.extract_document(
                evidence,
                message.project_id,
                message.document_id,
                filename=message.filename,
                mime_type=message.mime_type,
                source_type=message.source_type,
            )
            observations = HybridMatcher.deduplicate_observations(observations)
            serialized_observations = [observation.model_dump(mode="json") for observation in observations]
            self.state_store.checkpoint(job_id, "EXTRACT_NORMALIZE", serialized_observations)
        else:
            observations = [NormalizedObservation.model_validate(item) for item in cached_observations]
            serialized_observations = cached_observations
            cached_fp = self.state_store.get_checkpoint(job_id, "EVIDENCE_FINGERPRINT")
            evidence_fingerprint = str(cached_fp) if cached_fp is not None else ""

        cached_proposals = self.state_store.get_checkpoint(job_id, "EMBED_MATCH_ROUTE")
        if cached_proposals is None:
            proposals = [
                HybridMatcher.match_observation(observation, message.activities) for observation in observations
            ]
            serialized_proposals = [proposal.model_dump(mode="json") for proposal in proposals]
            self.state_store.checkpoint(job_id, "EMBED_MATCH_ROUTE", serialized_proposals)
        else:
            serialized_proposals = cached_proposals

        if not evidence_fingerprint:
            evidence_fingerprint = hashlib.sha256(
                f"{message.document_id}:{message.storage_key}:{message.filename}".encode("utf-8")
            ).hexdigest()
        decisions = [proposal.get("decision") for proposal in serialized_proposals]
        return {
            "correlation_id": message.correlation_id,
            "idempotency_key": job_id,
            "project_id": str(message.project_id),
            "document_id": str(message.document_id),
            "job_id": job_id,
            "status": "COMPLETED",
            "evidence_fingerprint": evidence_fingerprint,
            "observations": serialized_observations,
            "proposals": serialized_proposals,
            "summary": {
                "observations": len(serialized_observations),
                "auto_link": decisions.count(MatchDecisionEnum.AUTO_LINK.value),
                "review_required": decisions.count(MatchDecisionEnum.REVIEW_REQUIRED.value),
                "rejected": decisions.count(MatchDecisionEnum.REJECTED.value),
            },
        }

    @staticmethod
    def _attempt(properties: pika.BasicProperties | None) -> int:
        headers = (properties.headers if properties and properties.headers else {}) or {}
        try:
            return max(0, int(headers.get("x-attempt", 0)))
        except (TypeError, ValueError):
            return 0

    def _publish(
        self,
        routing_key: str,
        body: bytes,
        *,
        correlation_id: str | None,
        headers: dict[str, Any] | None = None,
    ) -> None:
        if self.channel is None:
            raise RuntimeError("RabbitMQ channel is not open")
        published = self.channel.basic_publish(
            exchange=settings.RABBITMQ_EXCHANGE,
            routing_key=routing_key,
            body=body,
            mandatory=True,
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
                correlation_id=correlation_id,
                headers=headers or {},
            ),
        )
        if published is False:
            raise IOError(f"RabbitMQ did not confirm publication to {routing_key}")

    def process_message(self, channel, method, properties, body: bytes) -> None:
        message: ProcessDocumentMessage | None = None
        attempt = self._attempt(properties)
        try:
            message = ProcessDocumentMessage.model_validate_json(body)
            attempt = max(attempt, message.attempt)
            job_id = str(message.job_id)
            claim = self.state_store.claim(job_id)
            if claim.completed:
                channel.basic_ack(delivery_tag=method.delivery_tag)
                logger.info("Acknowledged duplicate completed job %s", job_id)
                return
            if claim.busy:
                self._publish(
                    "document.retry",
                    body,
                    correlation_id=message.correlation_id,
                    headers={"x-attempt": attempt, "x-reason": "job-lock-busy"},
                )
                channel.basic_ack(delivery_tag=method.delivery_tag)
                return

            result = self.process_job(message)
            self._publish(
                "document.result",
                json.dumps(result).encode("utf-8"),
                correlation_id=message.correlation_id,
                headers={"x-idempotency-key": job_id},
            )
            self.state_store.complete(job_id, result)
            channel.basic_ack(delivery_tag=method.delivery_tag)
            logger.info("Completed job %s with %s observations", job_id, result["summary"]["observations"])
        except Exception as exc:  # noqa: BLE001
            logger.exception("AI processing job failed: %s", exc)
            failed_job_id = str(message.job_id) if message else None
            retryable = not isinstance(
                exc,
                (ValidationError, json.JSONDecodeError, MediaBackendUnavailableError, MediaProcessingError),
            )
            if isinstance(exc, EvidenceAccessError):
                retryable = exc.retryable
            next_attempt = attempt + 1
            try:
                if retryable and next_attempt < settings.QUEUE_MAX_ATTEMPTS:
                    if failed_job_id:
                        self.state_store.fail(failed_job_id, str(exc), final=False)
                    self._publish(
                        "document.retry",
                        body,
                        correlation_id=message.correlation_id
                        if message
                        else getattr(properties, "correlation_id", None),
                        headers={"x-attempt": next_attempt, "x-error": str(exc)[:500]},
                    )
                else:
                    if failed_job_id:
                        self.state_store.fail(failed_job_id, str(exc), final=True)
                    failure_corr_id = (
                        message.correlation_id if message else getattr(properties, "correlation_id", None)
                    )
                    failure = {
                        "correlation_id": failure_corr_id,
                        "idempotency_key": failed_job_id,
                        "job_id": failed_job_id,
                        "status": "FAILED",
                        "attempts": next_attempt,
                        "retryable": retryable,
                        "error_type": type(exc).__name__,
                        "error": str(exc),
                    }
                    self._publish(
                        "document.result",
                        json.dumps(failure).encode("utf-8"),
                        correlation_id=str(failure_corr_id) if failure_corr_id is not None else None,
                        headers={"x-idempotency-key": failed_job_id or "invalid-message"},
                    )
                    self._publish(
                        "document.failed",
                        body,
                        correlation_id=str(failure_corr_id) if failure_corr_id is not None else None,
                        headers={
                            "x-attempt": next_attempt,
                            "x-error-type": type(exc).__name__,
                            "x-error": str(exc)[:500],
                        },
                    )
                channel.basic_ack(delivery_tag=method.delivery_tag)
            except Exception:  # noqa: BLE001
                logger.exception("Failure routing failed; requeueing original delivery")
                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    def start_consuming(self) -> None:
        if self.channel is None:
            self.connect()
        if self.channel is None:
            raise RuntimeError("RabbitMQ channel is not available")
        self.channel.basic_qos(prefetch_count=1)
        self.channel.basic_consume(
            queue=settings.QUEUE_AI_PROCESSING,
            on_message_callback=self.process_message,
            auto_ack=False,
        )
        logger.info("AI worker is consuming %s", settings.QUEUE_AI_PROCESSING)
        self.channel.start_consuming()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    AIQueueWorker().start_consuming()


if __name__ == "__main__":
    main()
