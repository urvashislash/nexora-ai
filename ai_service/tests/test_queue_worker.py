import json
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pika

from app.models.schemas import DisciplineEnum, ProcessDocumentMessage, ScheduleActivity
from app.workers.job_state import InMemoryJobStateStore
from app.workers.queue_worker import AIQueueWorker


class FakeChannel:
    def __init__(self):
        self.published = []
        self.acked = []
        self.nacked = []
        self.declarations = []

    def basic_publish(self, **kwargs):
        self.published.append(kwargs)
        return True

    def basic_ack(self, delivery_tag):
        self.acked.append(delivery_tag)

    def basic_nack(self, delivery_tag, requeue):
        self.nacked.append((delivery_tag, requeue))

    def exchange_declare(self, **kwargs):
        self.declarations.append(("exchange", kwargs))

    def queue_declare(self, **kwargs):
        self.declarations.append(("queue", kwargs))

    def queue_bind(self, **kwargs):
        self.declarations.append(("bind", kwargs))


def _message() -> ProcessDocumentMessage:
    project_id = uuid4()
    activity = ScheduleActivity(
        id=uuid4(),
        project_id=project_id,
        code="PIP-2401",
        name="Hydrostatic Testing - P-101",
        discipline=DisciplineEnum.PIPING,
        equipment_tag="P-101",
        planned_start_date=date(2026, 8, 1),
        planned_finish_date=date(2026, 9, 30),
    )
    return ProcessDocumentMessage(
        correlation_id="corr-1",
        project_id=project_id,
        document_id=uuid4(),
        job_id=uuid4(),
        storage_key="inline/report.txt",
        source_type="DAILY_REPORT",
        filename="report.txt",
        text_content="PIP-2401 hydro test of P-101 completed.",
        activities=[activity],
    )


def test_successful_job_publishes_result_and_is_idempotent():
    store = InMemoryJobStateStore()
    worker = AIQueueWorker(state_store=store)
    channel = FakeChannel()
    worker.channel = channel
    message = _message()
    body = message.model_dump_json().encode()
    method = SimpleNamespace(delivery_tag=7)
    properties = pika.BasicProperties(correlation_id=message.correlation_id, headers={})

    worker.process_message(channel, method, properties, body)
    assert channel.acked == [7]
    assert [item["routing_key"] for item in channel.published] == ["document.result"]
    result = json.loads(channel.published[0]["body"])
    assert result["status"] == "COMPLETED"
    assert result["idempotency_key"] == str(message.job_id)
    assert store.states[str(message.job_id)]["status"] == "COMPLETED"

    worker.process_message(channel, SimpleNamespace(delivery_tag=8), properties, body)
    assert channel.acked == [7, 8]
    assert len(channel.published) == 1


def test_transient_failure_is_checkpointed_and_delayed_for_retry(monkeypatch):
    store = InMemoryJobStateStore()
    worker = AIQueueWorker(state_store=store)
    channel = FakeChannel()
    worker.channel = channel
    message = _message()
    monkeypatch.setattr(worker, "process_job", lambda _message: (_ for _ in ()).throw(RuntimeError("temporary")))

    worker.process_message(
        channel,
        SimpleNamespace(delivery_tag=10),
        pika.BasicProperties(correlation_id=message.correlation_id, headers={"x-attempt": 0}),
        message.model_dump_json().encode(),
    )
    assert channel.acked == [10]
    assert channel.published[0]["routing_key"] == "document.retry"
    assert channel.published[0]["properties"].headers["x-attempt"] == 1
    assert store.states[str(message.job_id)]["status"] == "RETRYING"


def test_permanent_failure_emits_failed_result_and_dlq_record():
    store = InMemoryJobStateStore()
    worker = AIQueueWorker(state_store=store)
    channel = FakeChannel()
    worker.channel = channel
    message = _message().model_copy(update={"text_content": None, "content_base64": "not-base64"})

    worker.process_message(
        channel,
        SimpleNamespace(delivery_tag=11),
        pika.BasicProperties(correlation_id=message.correlation_id, headers={}),
        message.model_dump_json().encode(),
    )
    assert channel.acked == [11]
    assert [item["routing_key"] for item in channel.published] == ["document.result", "document.failed"]
    failure = json.loads(channel.published[0]["body"])
    assert failure["status"] == "FAILED"
    assert store.states[str(message.job_id)]["status"] == "FAILED"


def test_processing_topology_has_delayed_retry_and_dlq():
    worker = AIQueueWorker(state_store=InMemoryJobStateStore())
    channel = FakeChannel()
    worker.channel = channel
    worker._declare_topology()
    queues = [entry[1] for entry in channel.declarations if entry[0] == "queue"]
    retry = next(queue for queue in queues if queue["queue"] == "ai_processing_retry_queue")
    processing = next(queue for queue in queues if queue["queue"] == "ai_processing_queue")
    assert retry["arguments"]["x-dead-letter-routing-key"] == "document.process"
    assert processing["arguments"]["x-dead-letter-routing-key"] == "document.failed"
