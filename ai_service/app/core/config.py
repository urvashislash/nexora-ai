import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "NEXORA AI — AI Processing Plane"
    API_V1_STR: str = "/api/v1"

    # Environment & Host
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    AI_HOST: str = os.getenv("AI_HOST", "0.0.0.0")
    AI_PORT: int = int(os.getenv("AI_PORT", "8000"))

    # Database (PostgreSQL + pgvector)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nexora")

    # RabbitMQ
    RABBITMQ_URL: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2f")
    RABBITMQ_EXCHANGE: str = os.getenv("RABBITMQ_EXCHANGE", "nexora.jobs")
    QUEUE_AI_PROCESSING: str = "ai_processing_queue"
    QUEUE_AI_RESULT: str = "ai_result_queue"
    QUEUE_AI_RETRY: str = "ai_processing_retry_queue"
    QUEUE_AI_DLQ: str = "ai_processing_dlq"

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Embedding Model (sentence-transformers/all-MiniLM-L6-v2)
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    EMBEDDING_DIM: int = 384

    # Matching Policy Thresholds
    MATCH_HIGH_CONFIDENCE_THRESHOLD: float = 0.85
    MATCH_REVIEW_THRESHOLD: float = 0.60


    # Scoring Weights
    WEIGHT_LEXICAL: float = 0.40
    WEIGHT_SEMANTIC: float = 0.45
    WEIGHT_CONTEXT: float = 0.15

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()
