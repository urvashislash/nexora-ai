#!/usr/bin/env python3
"""
NEXORA AI — Dead Letter Queue (DLQ) Inspector and Re-drive Utility

Usage:
  python inspect_dlq.py --help
  python inspect_dlq.py --count
  python inspect_dlq.py --inspect --limit 5
  python inspect_dlq.py --redrive --limit 10
  python inspect_dlq.py --purge
"""

import argparse
import json
import logging
import sys
from typing import Any

import pika

# Try loading settings from app if available
try:
    from app.core.config import settings
    DEFAULT_RABBITMQ_URL = settings.RABBITMQ_URL
    DEFAULT_DLQ = settings.QUEUE_AI_DLQ
    DEFAULT_MAIN_QUEUE = settings.QUEUE_AI_PROCESSING
    DEFAULT_EXCHANGE = settings.RABBITMQ_EXCHANGE
except Exception:
    DEFAULT_RABBITMQ_URL = "amqp://guest:guest@localhost:5672/%2f"
    DEFAULT_DLQ = "ai_processing_dlq"
    DEFAULT_MAIN_QUEUE = "ai_processing_queue"
    DEFAULT_EXCHANGE = "nexora.jobs"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("dlq_inspector")


def get_channel(amqp_url: str):
    params = pika.URLParameters(amqp_url)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    return connection, channel


def count_dlq_messages(amqp_url: str, dlq_name: str) -> int:
    try:
        connection, channel = get_channel(amqp_url)
        queue_state = channel.queue_declare(queue=dlq_name, passive=True)
        count = queue_state.method.message_count
        connection.close()
        return count
    except Exception as exc:
        logger.error("Failed to inspect queue %s: %s", dlq_name, exc)
        return -1


def inspect_messages(amqp_url: str, dlq_name: str, limit: int = 5) -> list[dict[str, Any]]:
    messages = []
    try:
        connection, channel = get_channel(amqp_url)
        for _ in range(limit):
            method_frame, properties, body = channel.basic_get(queue=dlq_name, auto_ack=False)
            if method_frame is None:
                break
            try:
                payload = json.loads(body.decode("utf-8"))
            except Exception:
                payload = {"raw": body.decode("utf-8", errors="replace")}
            messages.append({
                "delivery_tag": method_frame.delivery_tag,
                "correlation_id": properties.correlation_id if properties else None,
                "headers": properties.headers if properties else None,
                "payload": payload,
            })
            # Reject and requeue so we only inspect without consuming
            channel.basic_nack(delivery_tag=method_frame.delivery_tag, requeue=True)
        connection.close()
    except Exception as exc:
        logger.error("Error inspecting DLQ messages: %s", exc)
    return messages


def redrive_messages(amqp_url: str, dlq_name: str, target_queue: str, limit: int = 100) -> int:
    redriven = 0
    try:
        connection, channel = get_channel(amqp_url)
        for _ in range(limit):
            method_frame, properties, body = channel.basic_get(queue=dlq_name, auto_ack=False)
            if method_frame is None:
                break

            # Publish to main queue / exchange
            channel.basic_publish(
                exchange="",
                routing_key=target_queue,
                body=body,
                properties=properties,
            )
            # Acknowledge removal from DLQ
            channel.basic_ack(delivery_tag=method_frame.delivery_tag)
            redriven += 1
        connection.close()
        logger.info("Successfully re-driven %d messages from %s to %s", redriven, dlq_name, target_queue)
    except Exception as exc:
        logger.error("Error re-driving messages: %s", exc)
    return redriven


def purge_dlq(amqp_url: str, dlq_name: str) -> int:
    try:
        connection, channel = get_channel(amqp_url)
        res = channel.queue_purge(queue=dlq_name)
        purged = res.method.message_count
        connection.close()
        logger.info("Purged %d messages from %s", purged, dlq_name)
        return purged
    except Exception as exc:
        logger.error("Failed to purge DLQ: %s", exc)
        return -1


def main():
    parser = argparse.ArgumentParser(description="NEXORA AI Dead Letter Queue (DLQ) Inspector & Re-drive Tool")
    parser.add_argument("--url", default=DEFAULT_RABBITMQ_URL, help="RabbitMQ AMQP Connection URL")
    parser.add_argument("--dlq", default=DEFAULT_DLQ, help="Dead Letter Queue name")
    parser.add_argument("--target", default=DEFAULT_MAIN_QUEUE, help="Target main queue name for re-drive")
    parser.add_argument("--count", action="store_true", help="Print total count of messages in DLQ")
    parser.add_argument("--inspect", action="store_true", help="Inspect payloads of messages currently in DLQ")
    parser.add_argument("--redrive", action="store_true", help="Re-drive messages from DLQ back to target queue")
    parser.add_argument("--purge", action="store_true", help="Purge all messages in DLQ")
    parser.add_argument("--limit", type=int, default=10, help="Max messages to inspect/redrive")

    args = parser.parse_args()

    if args.count:
        count = count_dlq_messages(args.url, args.dlq)
        print(f"[DLQ] Total messages in '{args.dlq}': {count}")
    elif args.inspect:
        msgs = inspect_messages(args.url, args.dlq, limit=args.limit)
        print(f"[DLQ] Found {len(msgs)} messages (showing up to {args.limit}):")
        for i, m in enumerate(msgs, start=1):
            print(f"\n--- Message {i} [Correlation ID: {m['correlation_id']}] ---")
            print(json.dumps(m["payload"], indent=2))
    elif args.redrive:
        redriven = redrive_messages(args.url, args.dlq, args.target, limit=args.limit)
        print(f"[DLQ] Re-driven {redriven} messages from '{args.dlq}' -> '{args.target}'")
    elif args.purge:
        purged = purge_dlq(args.url, args.dlq)
        print(f"[DLQ] Purged {purged} messages from '{args.dlq}'")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
