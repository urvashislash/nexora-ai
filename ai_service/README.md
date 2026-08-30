# NEXORA AI processing service

The AI service converts construction evidence into normalized observations and safe activity-match proposals. It does not commit schedule state; every proposal is returned with an explicit routing decision for the Rust trust plane.

## Supported evidence

| Source | Formats | Processing path |
| --- | --- | --- |
| Daily reports and progress logs | TXT, PDF | Native PDF text extraction with page-level OCR fallback |
| Discipline datasets | CSV, TSV, XLS, XLSX, XLSM | Flexible header recognition across every worksheet |
| Schedule imports | P6/MS Project-style CSV, XLS, XLSX | Validated activity codes, dates, disciplines, quantities, units, locations, and equipment tags |
| Site photos and scanned diaries | PNG, JPG, TIFF, BMP, WebP | Tesseract OCR with confidence propagated to each observation |
| Supervisor voice evidence | WAV, MP3, M4A, AAC, OGG, FLAC, WebM | Local faster-whisper ASR with VAD and transcription confidence |

The container includes Tesseract and FFmpeg. OCR and ASR errors are returned explicitly; an unreadable file is never treated as a successfully processed empty document.

## Endpoints

- `POST /api/v1/extract` extracts and normalizes text evidence.
- `POST /api/v1/extract-file` auto-selects PDF, table, OCR, ASR, or text parsing.
- `POST /api/v1/schedule/import-file` validates and normalizes schedule activities.
- `POST /api/v1/embed` generates 384-dimensional embeddings.
- `POST /api/v1/match` runs retrieval, hybrid reranking, and review routing.
- `POST /api/v1/pipeline/process` runs the text pipeline end to end.
- `POST /api/v1/pipeline/process-file` runs the binary-file pipeline end to end.

The selected embedding model is `sentence-transformers/all-MiniLM-L6-v2`. `EMBEDDING_ALLOW_DOWNLOAD=false` prevents accidental model downloads in offline or locked-down environments. Mount a pre-populated Hugging Face cache or set the flag to `true` in a network-enabled build. If the model is unavailable in `auto` mode, the service uses a deterministic normalized token/bigram embedding so processing remains available; `/api/v1/health` reports the active backend.

## Match safety policy

The calibrated `construction-v1` policy uses these boundaries:

- high confidence: `0.85`
- review band: `0.60` to `< 0.85`
- low-confidence review: `0.40` to `< 0.60`
- rejection/no-match: `< 0.40`
- minimum first-versus-second candidate gap for auto-linking: `0.08`

A high score alone is insufficient for automatic linking. Low extraction confidence, a weak lexical/equipment signal, or an ambiguous candidate gap always returns `REVIEW_REQUIRED`. Rejected observations retain ranked fallback candidates for diagnosis but have no `top_match`.

The realistic EPC field-language fixture covers piping, civil, mechanical, electrical, instrumentation, HSE, and unrelated/no-match reports. Run the benchmark and threshold recommendation with:

```bash
cd ai_service
EMBEDDING_BACKEND=hash ../.venv/bin/python -m scripts.calibrate_matching tests/fixtures/realistic_matching_dataset.json
```

The real sentence-transformer calibration produces 100% top-1 accuracy, 100% auto-link precision, zero unsafe auto-links, one ambiguity review, and two correct rejections across 16 cases. The deterministic offline backend produces the same accuracy and safety results with three review cases. Replace or extend the fixture with anonymized project outcomes before changing production thresholds.

## RabbitMQ reliability

Run the API and worker separately; Docker Compose defines both `ai_service` and `ai_worker`.

```text
document.process -> ai_processing_queue -> AI worker
                                      |-> document.result -> ai_result_queue
                                      |-> document.retry  -> delayed retry queue -> document.process
                                      `-> document.failed -> ai_processing_dlq
```

Processing guarantees:

- durable queues/messages and publisher confirms;
- at-least-once delivery with a stable `job_id`/`idempotency_key`;
- Redis locks suppress concurrent duplicate processing;
- completed duplicates are acknowledged without emitting another result;
- extraction and matching checkpoints are reused after partial failure;
- retries retain the original evidence reference/body and increment `x-attempt`;
- exhausted or permanent failures emit a structured failed result and preserve the original message in the DLQ.

The result consumer must use `idempotency_key` as its unique write key because a broker or process crash between publish and acknowledgement can still produce a duplicate delivery under at-least-once semantics.

## Verification

```bash
cd ai_service
../.venv/bin/python -m pytest -q
../.venv/bin/python -m compileall -q app scripts
```
