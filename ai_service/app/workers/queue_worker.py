import json
import logging
import time
from typing import Optional
import pika

from app.core.config import settings
from app.models.schemas import ProcessDocumentMessage
from app.services.extractor import DocumentExtractor

logger = logging.getLogger(__name__)


class AIQueueWorker:
    def __init__(self):
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[pika.adapters.blocking_connection.BlockingChannel] = None

    def connect(self):
        params = pika.URLParameters(settings.RABBITMQ_URL)
        params.heartbeat = 600
        params.blocked_connection_timeout = 300
        
        for attempt in range(5):
            try:
                self.connection = pika.BlockingConnection(params)
                self.channel = self.connection.channel()
                
                # Declare Direct Exchange
                self.channel.exchange_declare(
                    exchange=settings.RABBITMQ_EXCHANGE,
                    exchange_type="direct",
                    durable=True
                )
                
                # Declare processing queue
                self.channel.queue_declare(
                    queue=settings.QUEUE_AI_PROCESSING,
                    durable=True
                )
                self.channel.queue_bind(
                    queue=settings.QUEUE_AI_PROCESSING,
                    exchange=settings.RABBITMQ_EXCHANGE,
                    routing_key="document.process"
                )
                
                # Declare result queue
                self.channel.queue_declare(
                    queue=settings.QUEUE_AI_RESULT,
                    durable=True
                )
                self.channel.queue_bind(
                    queue=settings.QUEUE_AI_RESULT,
                    exchange=settings.RABBITMQ_EXCHANGE,
                    routing_key="document.result"
                )
                
                # Declare DLQ
                self.channel.queue_declare(
                    queue=settings.QUEUE_AI_DLQ,
                    durable=True
                )
                self.channel.queue_bind(
                    queue=settings.QUEUE_AI_DLQ,
                    exchange=settings.RABBITMQ_EXCHANGE,
                    routing_key="document.failed"
                )

                logger.info("Successfully connected to RabbitMQ and declared topology.")
                return
            except Exception as e:
                logger.warning(f"RabbitMQ connection attempt {attempt+1}/5 failed: {e}. Retrying in 2s...")
                time.sleep(2)

    def process_message(self, ch, method, properties, body):
        try:
            data = json.loads(body.decode("utf-8"))
            msg = ProcessDocumentMessage(**data)
            logger.info(f"Processing job {msg.job_id} for document {msg.document_id} (Project {msg.project_id})")

            # Extract observations from document text
            observations = DocumentExtractor.extract_from_text(
                text=msg.text_content or "",
                project_id=msg.project_id,
                document_id=msg.document_id
            )

            result_payload = {
                "correlation_id": msg.correlation_id,
                "project_id": str(msg.project_id),
                "document_id": str(msg.document_id),
                "job_id": str(msg.job_id),
                "status": "COMPLETED",
                "observations": [obs.model_dump(mode="json") for obs in observations]
            }

            # Publish result to ai_result_queue
            ch.basic_publish(
                exchange=settings.RABBITMQ_EXCHANGE,
                routing_key="document.result",
                body=json.dumps(result_payload).encode("utf-8"),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    correlation_id=msg.correlation_id
                )
            )

            ch.basic_ack(delivery_tag=method.delivery_tag)
            logger.info(f"Completed job {msg.job_id}, published {len(observations)} observations to result queue.")
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def start_consuming(self):
        if not self.channel:
            self.connect()
        if self.channel:
            self.channel.basic_qos(prefetch_count=1)
            self.channel.basic_consume(
                queue=settings.QUEUE_AI_PROCESSING,
                on_message_callback=self.process_message
            )
            logger.info("AI Worker started listening on ai_processing_queue...")
            self.channel.start_consuming()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    worker = AIQueueWorker()
    worker.connect()
    worker.start_consuming()
