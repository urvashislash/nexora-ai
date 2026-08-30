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
    QUEUE_RETRY_DELAY_MS: int = int(os.getenv("QUEUE_RETRY_DELAY_MS", "15000"))
    QUEUE_MAX_ATTEMPTS: int = int(os.getenv("QUEUE_MAX_ATTEMPTS", "3"))
    QUEUE_CONNECTION_ATTEMPTS: int = int(os.getenv("QUEUE_CONNECTION_ATTEMPTS", "5"))
    JOB_STATE_TTL_SECONDS: int = int(os.getenv("JOB_STATE_TTL_SECONDS", "604800"))
    JOB_LOCK_TTL_SECONDS: int = int(os.getenv("JOB_LOCK_TTL_SECONDS", "900"))

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    JOB_STATE_BACKEND: str = os.getenv("JOB_STATE_BACKEND", "redis")

    # Evidence storage used by asynchronous workers
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET", "evidence-documents")

    # Embedding Model (sentence-transformers/all-MiniLM-L6-v2)
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "384"))
    EMBEDDING_BACKEND: str = os.getenv("EMBEDDING_BACKEND", "auto")
    EMBEDDING_ALLOW_DOWNLOAD: bool = os.getenv("EMBEDDING_ALLOW_DOWNLOAD", "false").lower() == "true"
    EMBEDDING_BATCH_SIZE: int = int(os.getenv("EMBEDDING_BATCH_SIZE", "64"))
    VECTOR_RETRIEVAL_LIMIT: int = int(os.getenv("VECTOR_RETRIEVAL_LIMIT", "50"))

    # Matching Policy Thresholds
    MATCH_HIGH_CONFIDENCE_THRESHOLD: float = float(os.getenv("MATCH_HIGH_CONFIDENCE_THRESHOLD", "0.85"))
    MATCH_REVIEW_THRESHOLD: float = float(os.getenv("MATCH_REVIEW_THRESHOLD", "0.60"))
    MATCH_REJECTION_THRESHOLD: float = float(os.getenv("MATCH_REJECTION_THRESHOLD", "0.40"))
    MATCH_MIN_AUTO_LINK_GAP: float = float(os.getenv("MATCH_MIN_AUTO_LINK_GAP", "0.08"))
    MATCH_MIN_AUTO_LEXICAL_SCORE: float = float(os.getenv("MATCH_MIN_AUTO_LEXICAL_SCORE", "0.55"))
    MATCH_MIN_EXTRACTION_CONFIDENCE: float = float(os.getenv("MATCH_MIN_EXTRACTION_CONFIDENCE", "0.70"))
    MATCH_POLICY_VERSION: str = os.getenv("MATCH_POLICY_VERSION", "construction-v1")

    # Scoring Weights
    WEIGHT_LEXICAL: float = float(os.getenv("WEIGHT_LEXICAL", "0.40"))
    WEIGHT_SEMANTIC: float = float(os.getenv("WEIGHT_SEMANTIC", "0.45"))
    WEIGHT_CONTEXT: float = float(os.getenv("WEIGHT_CONTEXT", "0.15"))

    # Media parsing
    PDF_TEXT_MIN_CHARS_PER_PAGE: int = int(os.getenv("PDF_TEXT_MIN_CHARS_PER_PAGE", "30"))
    OCR_LANGUAGE: str = os.getenv("OCR_LANGUAGE", "eng")
    OCR_DPI: int = int(os.getenv("OCR_DPI", "300"))
    ASR_MODEL: str = os.getenv("ASR_MODEL", "small.en")
    ASR_DEVICE: str = os.getenv("ASR_DEVICE", "cpu")
    ASR_COMPUTE_TYPE: str = os.getenv("ASR_COMPUTE_TYPE", "int8")
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()
