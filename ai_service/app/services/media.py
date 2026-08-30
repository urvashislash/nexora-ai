import io
import logging
import math
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class MediaProcessingError(RuntimeError):
    """Base error for media that cannot be converted into usable text."""


class MediaBackendUnavailableError(MediaProcessingError):
    """Raised when an optional OCR or ASR runtime is not installed/configured."""


@dataclass(frozen=True)
class ExtractedMediaText:
    text: str
    confidence: float
    metadata: dict[str, Any] = field(default_factory=dict)


def ocr_image_bytes(content: bytes, *, language: str | None = None) -> ExtractedMediaText:
    """Extract text from a site image using Tesseract, including word confidence."""
    if not content:
        raise MediaProcessingError("Image content is empty")

    try:
        import pytesseract
        from PIL import Image, ImageOps
        from pytesseract import Output
    except ImportError as exc:
        raise MediaBackendUnavailableError(
            "OCR requires Pillow, pytesseract, and the Tesseract system package"
        ) from exc

    try:
        with Image.open(io.BytesIO(content)) as raw_image:
            image = ImageOps.exif_transpose(raw_image).convert("L")
            image = ImageOps.autocontrast(image)
            data = pytesseract.image_to_data(
                image,
                lang=language or settings.OCR_LANGUAGE,
                config="--oem 3 --psm 6",
                output_type=Output.DICT,
            )
    except pytesseract.TesseractNotFoundError as exc:
        raise MediaBackendUnavailableError("The Tesseract OCR executable is not available") from exc
    except Exception as exc:  # noqa: BLE001
        raise MediaProcessingError(f"OCR failed: {exc}") from exc

    lines: dict[tuple[int, int, int], list[str]] = {}
    confidences: list[float] = []
    block_numbers = data.get("block_num", [])
    paragraph_numbers = data.get("par_num", [])
    line_numbers = data.get("line_num", [])
    for index, (word, raw_confidence) in enumerate(
        zip(data.get("text", []), data.get("conf", []), strict=False)
    ):
        token = str(word).strip()
        if not token:
            continue
        line_key = (
            int(block_numbers[index]) if index < len(block_numbers) else 0,
            int(paragraph_numbers[index]) if index < len(paragraph_numbers) else 0,
            int(line_numbers[index]) if index < len(line_numbers) else 0,
        )
        lines.setdefault(line_key, []).append(token)
        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError):
            continue
        if confidence >= 0:
            confidences.append(confidence)

    text = "\n".join(" ".join(words) for words in lines.values()).strip()
    if not text:
        raise MediaProcessingError("OCR completed but no readable text was detected")

    mean_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.65
    return ExtractedMediaText(
        text=text,
        confidence=max(0.0, min(1.0, mean_confidence)),
        metadata={"engine": "tesseract", "language": language or settings.OCR_LANGUAGE},
    )


_asr_models: dict[tuple[str, str, str], Any] = {}


def _get_asr_model() -> Any:
    key = (settings.ASR_MODEL, settings.ASR_DEVICE, settings.ASR_COMPUTE_TYPE)
    if key in _asr_models:
        return _asr_models[key]
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise MediaBackendUnavailableError("ASR requires the faster-whisper package") from exc

    try:
        model = WhisperModel(
            settings.ASR_MODEL,
            device=settings.ASR_DEVICE,
            compute_type=settings.ASR_COMPUTE_TYPE,
        )
    except Exception as exc:  # noqa: BLE001
        raise MediaProcessingError(f"Unable to load ASR model {settings.ASR_MODEL}: {exc}") from exc
    _asr_models[key] = model
    return model


def transcribe_audio_bytes(content: bytes, *, filename: str = "evidence.wav") -> ExtractedMediaText:
    """Transcribe voice evidence locally with faster-whisper."""
    if not content:
        raise MediaProcessingError("Audio content is empty")

    suffix = Path(filename).suffix or ".wav"
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        model = _get_asr_model()
        segments, info = model.transcribe(str(temp_path), vad_filter=True, beam_size=5)
        segment_list = list(segments)
        text = " ".join(segment.text.strip() for segment in segment_list if segment.text.strip()).strip()
        if not text:
            raise MediaProcessingError("ASR completed but no speech was detected")

        probabilities = [math.exp(segment.avg_logprob) for segment in segment_list if segment.avg_logprob is not None]
        confidence = sum(probabilities) / len(probabilities) if probabilities else 0.70
        return ExtractedMediaText(
            text=text,
            confidence=max(0.0, min(1.0, confidence)),
            metadata={
                "engine": "faster-whisper",
                "model": settings.ASR_MODEL,
                "language": getattr(info, "language", None),
                "language_probability": getattr(info, "language_probability", None),
            },
        )
    except MediaProcessingError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise MediaProcessingError(f"ASR failed: {exc}") from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
