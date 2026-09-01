"""Async RabbitMQ publisher for FastAPI endpoints.

Uses aio-pika for non-blocking AMQP publishing from within async handlers.
Lifecycle managed via FastAPI lifespan events.
"""

import json
import logging
from typing import Any

import aio_pika

from app.core.config import settings

logger = logging.getLogger(__name__)


class RabbitPublisher:
    """Async RabbitMQ publisher wrapping an aio-pika connection."""

    def __init__(self) -> None:
        self.connection: aio_pika.abc.AbstractRobustConnection | None = None
        self.channel: aio_pika.abc.AbstractChannel | None = None
        self._exchange: aio_pika.abc.AbstractExchange | None = None

    async def connect(self) -> None:
        """Establishes the RabbitMQ connection and declares topology."""
        self.connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        self.channel = await self.connection.channel()
        await self.channel.set_qos(prefetch_count=10)

        # Declare exchange
        self._exchange = await self.channel.declare_exchange(
            settings.RABBITMQ_EXCHANGE,
            aio_pika.ExchangeType.DIRECT,
            durable=True,
        )

        # Declare processing queue and bind
        queue = await self.channel.declare_queue(
            settings.QUEUE_AI_PROCESSING,
            durable=True,
        )
        await queue.bind(self._exchange, routing_key="document.process")

        logger.info(
            "RabbitMQ async publisher connected — exchange=%s",
            settings.RABBITMQ_EXCHANGE,
        )

    async def close(self) -> None:
        """Gracefully closes the RabbitMQ connection."""
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
            logger.info("RabbitMQ async publisher disconnected")

    @property
    def is_connected(self) -> bool:
        return self.connection is not None and not self.connection.is_closed

    async def publish_document_job(self, job_payload: dict[str, Any]) -> None:
        """Publishes a ProcessDocumentMessage to the AI processing queue."""
        if self._exchange is None:
            raise RuntimeError("RabbitMQ publisher is not connected")

        body = json.dumps(job_payload, default=str).encode("utf-8")
        message = aio_pika.Message(
            body=body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            correlation_id=str(job_payload.get("correlation_id", "")),
        )

        await self._exchange.publish(
            message,
            routing_key="document.process",
        )

        logger.info(
            "Published async document job %s to RabbitMQ",
            job_payload.get("job_id", "unknown"),
        )

    async def ping(self) -> bool:
        """Checks if the connection is alive."""
        try:
            return self.is_connected
        except Exception:  # noqa: BLE001
            return False


# Singleton instance managed by FastAPI lifespan
_publisher: RabbitPublisher | None = None


def get_publisher() -> RabbitPublisher | None:
    return _publisher


async def init_publisher() -> RabbitPublisher:
    global _publisher  # noqa: PLW0603
    _publisher = RabbitPublisher()
    await _publisher.connect()
    return _publisher


async def close_publisher() -> None:
    global _publisher  # noqa: PLW0603
    if _publisher:
        await _publisher.close()
        _publisher = None
