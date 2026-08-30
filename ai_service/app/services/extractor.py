import csv
import io
import logging
import re
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid5

from app.core.config import settings
from app.models.schemas import (
    DisciplineEnum,
    EventTypeEnum,
    MatchProposalPayload,
    NormalizedObservation,
    ScheduleActivity,
    ScheduleImportIssue,
    ScheduleImportResult,
)
from app.services.media import MediaProcessingError, ocr_image_bytes, transcribe_audio_bytes
from app.services.normalizer import (
    default_normalizer,
    normalize_discipline,
    normalize_equipment_tag,
    normalize_quantity_value,
    normalize_unit_name,
    parse_date_value,
)

logger = logging.getLogger(__name__)

_HEADER_ALIASES: dict[str, list[str]] = {
    "activity_code": [
        "activity id", "activity code", "act code", "code", "activity_code", "wbs code", "task id", "id",
    ],
    "description": [
        "description", "activity", "activity description", "work description", "activity name", "task",
        "task description", "work item", "scope", "scope of work",
    ],
    "status": [
        "status", "progress", "% complete", "percent complete", "completion", "progress %", "pct",
        "actual progress", "physical progress",
    ],
    "discipline": ["discipline", "disc", "trade", "department", "dept"],
    "equipment_tag": [
        "equipment tag", "equipment", "tag", "tag no", "tag number", "tag_no", "equip tag", "asset tag",
    ],
    "location": ["location", "area", "section", "block", "workfront", "work front"],
    "zone": ["zone", "work zone"],
    "quantity": ["quantity", "qty", "actual qty", "actual quantity", "completed qty", "installed qty"],
    "unit": ["unit", "uom", "unit of measure", "unit_of_measure"],
    "remarks": ["remarks", "remark", "comments", "comment", "notes", "delay reason"],
    "observed_date": ["date", "report date", "actual date", "data date", "status date"],
    "planned_start": ["planned start", "planned start date", "start", "start date", "baseline start"],
    "planned_finish": ["planned finish", "planned finish date", "finish", "finish date", "baseline finish"],
}

_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}
_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".webm"}
_TABULAR_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xls", ".xlsm"}


def _canonical_header(raw_header: object) -> str:
    value = str(raw_header or "").strip().lower().replace("_", " ")
    return re.sub(r"[^a-z0-9%]+", " ", value).strip()


def _resolve_header(raw_header: object) -> str | None:
    normalized = _canonical_header(raw_header)
    for canonical, aliases in _HEADER_ALIASES.items():
        if normalized in {_canonical_header(alias) for alias in aliases}:
            return canonical
    return None


class DocumentExtractor:
    """Source-aware construction evidence parser for reports, tables, images, and voice notes."""

    @classmethod
    def extract_document(
        cls,
        content: bytes | str,
        project_id: UUID,
        document_id: UUID | None = None,
        *,
        filename: str = "evidence.txt",
        mime_type: str | None = None,
        source_type: str = "DAILY_REPORT",
    ) -> list[NormalizedObservation]:
        if isinstance(content, str):
            return cls.extract_from_text(
                content,
                project_id,
                document_id,
                source_type=source_type,
                base_metadata={"filename": filename, "extraction_method": "text"},
            )
        if len(content) > settings.MAX_UPLOAD_BYTES:
            raise MediaProcessingError(
                f"File exceeds the configured {settings.MAX_UPLOAD_BYTES}-byte processing limit"
            )

        extension = Path(filename.lower()).suffix
        media_type = (mime_type or "").lower()
        if extension == ".pdf" or "pdf" in media_type or content.startswith(b"%PDF"):
            return cls.extract_from_pdf_bytes(content, project_id, document_id, source_type=source_type)
        if extension in _TABULAR_EXTENSIONS or any(token in media_type for token in ("csv", "excel", "spreadsheet")):
            return cls.extract_from_excel_bytes(
                content,
                project_id,
                document_id,
                filename=filename,
                source_type=source_type,
            )
        if extension in _IMAGE_EXTENSIONS or media_type.startswith("image/"):
            return cls.extract_from_image_bytes(
                content,
                project_id,
                document_id,
                filename=filename,
                source_type=source_type,
            )
        if extension in _AUDIO_EXTENSIONS or media_type.startswith("audio/"):
            return cls.extract_from_audio_bytes(
                content,
                project_id,
                document_id,
                filename=filename,
                source_type=source_type,
            )

        text = content.decode("utf-8-sig", errors="replace")
        return cls.extract_from_text(
            text,
            project_id,
            document_id,
            source_type=source_type,
            base_metadata={"filename": filename, "extraction_method": "text"},
        )

    @classmethod
    def extract_from_text(
        cls,
        text: str,
        project_id: UUID,
        document_id: UUID | None = None,
        *,
        source_type: str = "DAILY_REPORT",
        base_metadata: dict[str, Any] | None = None,
        extraction_confidence: float = 0.95,
    ) -> list[NormalizedObservation]:
        if not text or not text.strip():
            return []

        report_date = cls._detect_report_date(text)
        observations: list[NormalizedObservation] = []
        for line_number, line in cls._split_observation_lines(text):
            if cls._is_header_or_noise(line):
                continue

            discipline = cls._detect_discipline(line)
            quantity, unit = cls._detect_quantity(line)
            observed_date = cls._detect_observed_date(line) or report_date
            observed_at = (
                datetime.combine(observed_date, time(hour=12), tzinfo=timezone.utc)
                if observed_date
                else datetime.now(timezone.utc)
            )
            metadata = dict(base_metadata or {})
            metadata.update({"source_type": source_type, "line_number": line_number})

            observations.append(
                NormalizedObservation(
                    project_id=project_id,
                    document_id=document_id,
                    raw_text=line,
                    normalized_text=default_normalizer.normalize(line, discipline),
                    observed_at=observed_at,
                    discipline=discipline,
                    location=cls._detect_location(line),
                    zone=cls._detect_zone(line),
                    equipment_tag=cls._detect_equipment(line),
                    event_type=cls._detect_event_type(line),
                    reported_progress=cls._detect_progress(line),
                    reported_quantity=quantity,
                    unit_of_measure=unit,
                    extraction_confidence=max(0.0, min(1.0, extraction_confidence)),
                    metadata=metadata,
                )
            )
        return observations

    @classmethod
    def extract_from_pdf_bytes(
        cls,
        content: bytes,
        project_id: UUID,
        document_id: UUID | None = None,
        *,
        source_type: str = "DAILY_REPORT",
    ) -> list[NormalizedObservation]:
        try:
            import pymupdf
        except ImportError:
            pymupdf = None

        if pymupdf is None:
            try:
                from pypdf import PdfReader

                reader = PdfReader(io.BytesIO(content))
                text = "\n".join(page.extract_text() or "" for page in reader.pages)
                return cls.extract_from_text(
                    text,
                    project_id,
                    document_id,
                    source_type=source_type,
                    base_metadata={"extraction_method": "pypdf"},
                    extraction_confidence=0.90,
                )
            except Exception as exc:  # noqa: BLE001
                raise MediaProcessingError(f"PDF parsing failed: {exc}") from exc

        observations: list[NormalizedObservation] = []
        ocr_errors: list[str] = []
        try:
            document = pymupdf.open(stream=content, filetype="pdf")
            for page_index, page in enumerate(document):
                page_number = page_index + 1
                page_text = (page.get_text("text") or "").strip()
                method = "pymupdf"
                confidence = 0.97
                media_metadata: dict[str, Any] = {}
                if len(re.sub(r"\s+", "", page_text)) < settings.PDF_TEXT_MIN_CHARS_PER_PAGE:
                    try:
                        scale = settings.OCR_DPI / 72.0
                        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
                        artifact = ocr_image_bytes(pixmap.tobytes("png"))
                        page_text = artifact.text
                        confidence = artifact.confidence
                        method = "ocr"
                        media_metadata = artifact.metadata
                    except MediaProcessingError as exc:
                        ocr_errors.append(f"page {page_number}: {exc}")
                        if not page_text:
                            continue

                observations.extend(
                    cls.extract_from_text(
                        page_text,
                        project_id,
                        document_id,
                        source_type=source_type,
                        base_metadata={
                            "page_number": page_number,
                            "page_count": document.page_count,
                            "extraction_method": method,
                            **media_metadata,
                        },
                        extraction_confidence=confidence,
                    )
                )
            document.close()
        except MediaProcessingError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise MediaProcessingError(f"PDF parsing failed: {exc}") from exc

        if not observations and ocr_errors:
            raise MediaProcessingError("PDF contains no extractable text; " + "; ".join(ocr_errors))
        return observations

    @classmethod
    def extract_from_image_bytes(
        cls,
        content: bytes,
        project_id: UUID,
        document_id: UUID | None = None,
        *,
        filename: str = "site-photo.jpg",
        source_type: str = "IMAGE",
    ) -> list[NormalizedObservation]:
        artifact = ocr_image_bytes(content)
        return cls.extract_from_text(
            artifact.text,
            project_id,
            document_id,
            source_type=source_type,
            base_metadata={"filename": filename, "extraction_method": "ocr", **artifact.metadata},
            extraction_confidence=artifact.confidence,
        )

    @classmethod
    def extract_from_audio_bytes(
        cls,
        content: bytes,
        project_id: UUID,
        document_id: UUID | None = None,
        *,
        filename: str = "voice-note.wav",
        source_type: str = "VOICE",
    ) -> list[NormalizedObservation]:
        artifact = transcribe_audio_bytes(content, filename=filename)
        return cls.extract_from_text(
            artifact.text,
            project_id,
            document_id,
            source_type=source_type,
            base_metadata={"filename": filename, "extraction_method": "asr", **artifact.metadata},
            extraction_confidence=artifact.confidence,
        )

    @classmethod
    def extract_from_excel_bytes(
        cls,
        content: bytes,
        project_id: UUID,
        document_id: UUID | None = None,
        *,
        filename: str = "dataset.xlsx",
        source_type: str = "DISCIPLINE_SPREADSHEET",
    ) -> list[NormalizedObservation]:
        observations: list[NormalizedObservation] = []
        for sheet_name, rows in cls._read_tabular_rows(content, filename):
            header_index, headers = cls._find_header_row(rows)
            if header_index is None:
                logger.warning("No recognizable headers in sheet %s", sheet_name)
                continue
            for row_number, row in rows[header_index + 1 :]:
                if not any(value not in (None, "") for value in row):
                    continue
                row_data = cls._map_row(headers, row)
                description = str(row_data.get("description") or "").strip()
                activity_code = str(row_data.get("activity_code") or "").strip()
                status = str(row_data.get("status") or "").strip()
                remarks = str(row_data.get("remarks") or "").strip()
                if not description:
                    description = " | ".join(
                        f"{key}: {value}" for key, value in row_data.items() if value not in (None, "")
                    )
                raw_line = " ".join(part for part in (activity_code, description, status, remarks) if part).strip()
                if not raw_line:
                    continue

                explicit_discipline = normalize_discipline(row_data.get("discipline"))
                discipline = explicit_discipline if explicit_discipline != DisciplineEnum.GENERAL else cls._detect_discipline(raw_line)
                quantity = normalize_quantity_value(row_data.get("quantity"))
                unit = normalize_unit_name(row_data.get("unit"))
                if quantity is None:
                    quantity, detected_unit = cls._detect_quantity(raw_line)
                    unit = unit or detected_unit
                equipment = normalize_equipment_tag(row_data.get("equipment_tag")) or cls._detect_equipment(raw_line)
                observed_date = parse_date_value(row_data.get("observed_date"))
                observations.append(
                    NormalizedObservation(
                        project_id=project_id,
                        document_id=document_id,
                        raw_text=raw_line,
                        normalized_text=default_normalizer.normalize(raw_line, discipline),
                        observed_at=(
                            datetime.combine(observed_date, time(hour=12), tzinfo=timezone.utc)
                            if observed_date
                            else datetime.now(timezone.utc)
                        ),
                        discipline=discipline,
                        event_type=cls._detect_event_type(raw_line),
                        reported_progress=cls._parse_progress_value(row_data.get("status"), raw_line),
                        reported_quantity=quantity,
                        unit_of_measure=unit,
                        equipment_tag=equipment,
                        location=str(row_data.get("location") or "").strip() or cls._detect_location(raw_line),
                        zone=str(row_data.get("zone") or "").strip() or cls._detect_zone(raw_line),
                        extraction_confidence=0.98,
                        metadata={
                            "source_type": source_type,
                            "filename": filename,
                            "sheet_name": sheet_name,
                            "row_number": row_number,
                            "extraction_method": "tabular",
                        },
                    )
                )
        return observations

    @classmethod
    def extract_schedule_from_tabular_bytes(
        cls,
        content: bytes,
        project_id: UUID,
        *,
        filename: str = "schedule.xlsx",
    ) -> ScheduleImportResult:
        activities: list[ScheduleActivity] = []
        issues: list[ScheduleImportIssue] = []
        seen_codes: set[str] = set()
        rows_processed = 0
        for sheet_name, rows in cls._read_tabular_rows(content, filename):
            header_index, headers = cls._find_header_row(rows)
            if header_index is None:
                issues.append(ScheduleImportIssue(row_number=1, message=f"No schedule headers found in {sheet_name}"))
                continue
            for row_number, row in rows[header_index + 1 :]:
                if not any(value not in (None, "") for value in row):
                    continue
                rows_processed += 1
                row_data = cls._map_row(headers, row)
                code = str(row_data.get("activity_code") or "").strip().upper()
                name = str(row_data.get("description") or "").strip()
                start = parse_date_value(row_data.get("planned_start"))
                finish = parse_date_value(row_data.get("planned_finish"))
                if not code or not name:
                    issues.append(ScheduleImportIssue(row_number=row_number, field="code/name", message="Activity code and name are required"))
                    continue
                if code in seen_codes:
                    issues.append(ScheduleImportIssue(row_number=row_number, field="activity_code", message=f"Duplicate activity code {code}"))
                    continue
                if not start or not finish:
                    issues.append(ScheduleImportIssue(row_number=row_number, field="dates", message=f"Valid planned start and finish are required for {code}"))
                    continue
                if finish < start:
                    issues.append(ScheduleImportIssue(row_number=row_number, field="planned_finish", message=f"Finish precedes start for {code}"))
                    continue

                discipline = normalize_discipline(row_data.get("discipline"))
                if discipline == DisciplineEnum.GENERAL:
                    discipline = cls._detect_discipline(f"{code} {name}")
                seen_codes.add(code)
                activities.append(
                    ScheduleActivity(
                        id=uuid5(project_id, code),
                        project_id=project_id,
                        code=code,
                        name=name,
                        description=str(row_data.get("remarks") or "").strip() or None,
                        discipline=discipline,
                        location=str(row_data.get("location") or "").strip() or None,
                        zone=str(row_data.get("zone") or "").strip() or None,
                        equipment_tag=normalize_equipment_tag(row_data.get("equipment_tag")),
                        planned_start_date=start,
                        planned_finish_date=finish,
                        planned_quantity=normalize_quantity_value(row_data.get("quantity")),
                        unit_of_measure=normalize_unit_name(row_data.get("unit")),
                    )
                )
        return ScheduleImportResult(activities=activities, issues=issues, rows_processed=rows_processed)

    @staticmethod
    def extract_and_match(
        content: bytes | str,
        project_id: UUID,
        activities: list[ScheduleActivity],
        document_id: UUID | None = None,
        source_type: str = "DAILY_REPORT",
        filename: str | None = None,
    ) -> list[MatchProposalPayload]:
        from app.services.matcher import HybridMatcher

        observations = DocumentExtractor.extract_document(
            content,
            project_id,
            document_id,
            filename=filename or "evidence.txt",
            source_type=source_type,
        )
        observations = HybridMatcher.deduplicate_observations(observations)
        return [HybridMatcher.match_observation(observation=obs, activities=activities) for obs in observations]

    @staticmethod
    def _read_tabular_rows(content: bytes, filename: str) -> list[tuple[str, list[tuple[int, tuple[Any, ...]]]]]:
        extension = Path(filename.lower()).suffix
        if extension in {".csv", ".tsv"} or not content.startswith((b"PK", b"\xd0\xcf\x11\xe0")):
            text = content.decode("utf-8-sig", errors="replace")
            sample = text[:4096]
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                delimiter = dialect.delimiter
            except csv.Error:
                delimiter = "\t" if extension == ".tsv" else ","
            rows = [(index, tuple(row)) for index, row in enumerate(csv.reader(io.StringIO(text), delimiter=delimiter), 1)]
            return [(Path(filename).stem or "data", rows)]

        if extension == ".xls" or content.startswith(b"\xd0\xcf\x11\xe0"):
            try:
                import xlrd
            except ImportError as exc:
                raise MediaProcessingError("Legacy .xls parsing requires the xlrd package") from exc
            workbook = xlrd.open_workbook(file_contents=content)
            return [
                (sheet.name, [(row_index + 1, tuple(sheet.row_values(row_index))) for row_index in range(sheet.nrows)])
                for sheet in workbook.sheets()
            ]

        try:
            import openpyxl

            workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            result = []
            for sheet in workbook.worksheets:
                rows = [(index, tuple(row)) for index, row in enumerate(sheet.iter_rows(values_only=True), 1)]
                result.append((sheet.title, rows))
            workbook.close()
            return result
        except Exception as exc:  # noqa: BLE001
            raise MediaProcessingError(f"Spreadsheet parsing failed: {exc}") from exc

    @staticmethod
    def _find_header_row(
        rows: list[tuple[int, tuple[Any, ...]]],
    ) -> tuple[int | None, list[str | None]]:
        best_index: int | None = None
        best_headers: list[str | None] = []
        best_score = 0
        for index, (_, row) in enumerate(rows[:10]):
            headers = [_resolve_header(value) for value in row]
            score = sum(header is not None for header in headers)
            if score > best_score:
                best_index, best_headers, best_score = index, headers, score
        return (best_index, best_headers) if best_score >= 2 else (None, [])

    @staticmethod
    def _map_row(headers: list[str | None], row: tuple[Any, ...]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for index, value in enumerate(row):
            if index < len(headers) and headers[index] and headers[index] not in result:
                result[headers[index]] = value
        return result

    @staticmethod
    def _split_observation_lines(text: str) -> list[tuple[int, str]]:
        normalized = text.replace("\r\n", "\n").replace("\r", "\n").replace("•", "\n• ")
        result: list[tuple[int, str]] = []
        for line_number, raw_line in enumerate(normalized.split("\n"), 1):
            line = re.sub(r"^\s*(?:[-*•]|\d+[.)]|[A-Za-z][.)])\s*", "", raw_line).strip()
            if line:
                result.append((line_number, line))
        return result

    @staticmethod
    def _is_header_or_noise(line: str) -> bool:
        lower = line.lower().strip()
        if len(line) < 5:
            return True
        header_patterns = (
            r"^page\s+\d+(?:\s+of\s+\d+)?$",
            r"^(?:project|date|contractor|title)\s*:",
            r"^report\s*(?:no|number)\.?\s*:?\s*[a-z0-9-]+$",
            r"^(?:nexora\s+ai\s+)?(?:daily|weekly|monthly|site)\s+(?:construction|progress|site)?\s*report\b",
        )
        return any(re.search(pattern, lower) for pattern in header_patterns)

    @staticmethod
    def _detect_discipline(text: str) -> DisciplineEnum:
        lower = text.lower()
        keyword_groups = (
            (DisciplineEnum.PIPING, ("piping", "spool", "hydro", "flange", "valve", "pipeline", "pipe support", "pip-", "p-101", "p-102", "pressure test")),
            (DisciplineEnum.CIVIL, ("civil", "concrete", "pour", "rebar", "shuttering", "formwork", "excavation", "civ-", "footing", "foundation", "dewatering")),
            (DisciplineEnum.MECHANICAL, ("mechanical", "pump", "compressor", "motor", "shaft alignment", "grouting", "mec-", "vessel", "exchanger")),
            (DisciplineEnum.ELECTRICAL, ("electrical", "cable", "tray", "glanding", "ele-", "transformer", "switchgear", "substation", "earthing")),
            (DisciplineEnum.INSTRUMENTATION, ("instrumentation", "transmitter", "ins-", "calibration", "scada", "plc", "impulse", "loop check")),
            (DisciplineEnum.HSE, ("hse", "ehs", "safety", "incident", "permit", "toolbox", "spill", "near miss")),
        )
        scores = [(discipline, sum(keyword in lower for keyword in keywords)) for discipline, keywords in keyword_groups]
        discipline, score = max(scores, key=lambda item: item[1])
        return discipline if score else DisciplineEnum.GENERAL

    @staticmethod
    def _detect_event_type(text: str) -> EventTypeEnum:
        lower = text.lower()
        if any(phrase in lower for phrase in ("blocked", "blocker", "material shortage", "permit denied", "cannot proceed")):
            return EventTypeEnum.BLOCKER
        if any(word in lower for word in ("delay", "delayed", "weather", "waiting for", "held up")):
            return EventTypeEnum.DELAY
        if any(word in lower for word in ("inspection", "inspected", "witnessed", "sign off", "rfi raised")):
            return EventTypeEnum.INSPECTION
        if any(word in lower for word in ("complete", "completed", "done", "finished", "erected", "tested", "closed")):
            return EventTypeEnum.FINISH
        if any(word in lower for word in ("started", "initiated", "commenced", "mobilized", "ongoing")):
            return EventTypeEnum.START
        return EventTypeEnum.PROGRESS

    @staticmethod
    def _detect_progress(text: str) -> float | None:
        match = re.search(r"(?<!\d)(\d{1,3}(?:\.\d+)?)\s*%", text)
        if match:
            return max(0.0, min(100.0, float(match.group(1))))
        lower = text.lower()
        if "not started" in lower:
            return 0.0
        if any(word in lower for word in ("completed", "complete", "done", "finished")):
            return 100.0
        return None

    @classmethod
    def _parse_progress_value(cls, value: object, fallback_text: str) -> float | None:
        if isinstance(value, (int, float)):
            numeric = float(value)
            return max(0.0, min(100.0, numeric * 100.0 if 0.0 <= numeric <= 1.0 else numeric))
        raw = str(value or "").strip()
        if re.fullmatch(r"\d+(?:\.\d+)?", raw):
            numeric = float(raw)
            return max(0.0, min(100.0, numeric * 100.0 if 0.0 <= numeric <= 1.0 else numeric))
        return cls._detect_progress(str(value or "") + " " + fallback_text)

    @staticmethod
    def _detect_quantity(text: str) -> tuple[float | None, str | None]:
        unit_pattern = (
            r"inch[- ]?dia|cu\.?\s*m|cum|m3|m³|sq\.?\s*m|sqm|mt|metric\s+tonne?s?|tonnes?|"
            r"running\s+met(?:er|re)s?|rm|meters?|metres?|nos?\.?|units?|tags?|joints?|sets?|kg|litres?|liters?|hrs?|hours?"
        )
        match = re.search(rf"(?<![\w.])(\d[\d,]*(?:\.\d+)?)\s*({unit_pattern})\b", text, re.IGNORECASE)
        if not match:
            return None, None
        return float(match.group(1).replace(",", "")), normalize_unit_name(match.group(2))

    @staticmethod
    def _detect_equipment(text: str) -> str | None:
        patterns = (
            r"\b(?:COL-FTG|RACK|FND|MEC|ELE|INS|TRAY)-[A-Z0-9-]+\b",
            r"\b(?:PT|TT|LT|FT|P|C|V|E|M)-?\d{2,5}[A-Z]?\b",
        )
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return normalize_equipment_tag(match.group(0))
        return None

    @staticmethod
    def _detect_location(text: str) -> str | None:
        lower = text.lower()
        if "pipe rack b" in lower or re.search(r"\brack\s+b\b", lower):
            return "Pipe Rack B"
        if "cdu" in lower or "area 100" in lower:
            return "CDU Area 100"
        if "compressor" in lower or "area 102" in lower:
            return "Compressor House"
        substation = re.search(r"\bsubstation\s*(?:no\.?\s*)?([a-z0-9-]+)?", text, re.IGNORECASE)
        if substation:
            return "Substation" + (f" {substation.group(1).upper()}" if substation.group(1) else "")
        location = re.search(r"\b(?:area|unit|block|grid)\s*[-:]?\s*[A-Z0-9]+\b", text, re.IGNORECASE)
        return location.group(0).title() if location else None

    @staticmethod
    def _detect_zone(text: str) -> str | None:
        match = re.search(r"\bzone\s*[-:]?\s*([A-Z0-9]+)\b", text, re.IGNORECASE)
        return f"Zone {match.group(1).upper()}" if match else None

    @staticmethod
    def _detect_report_date(text: str):
        for line in text.splitlines()[:20]:
            if re.match(r"^\s*(?:report\s+)?date\s*:", line, re.IGNORECASE):
                parsed = parse_date_value(line)
                if parsed:
                    return parsed
        return None

    @staticmethod
    def _detect_observed_date(text: str):
        return parse_date_value(text)
