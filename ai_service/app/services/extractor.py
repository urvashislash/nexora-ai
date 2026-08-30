import io
import logging
import re
from datetime import datetime
from uuid import UUID

from app.models.schemas import (
    DisciplineEnum,
    EventTypeEnum,
    MatchProposalPayload,
    NormalizedObservation,
    ScheduleActivity,
)
from app.services.normalizer import default_normalizer

logger = logging.getLogger(__name__)

# =============================================================================
# Header Aliases for Spreadsheet Column Matching
# =============================================================================
_HEADER_ALIASES: dict[str, list[str]] = {
    "activity_code": [
        "activity_id", "activity id", "activity code", "act. code", "act code",
        "act.code", "code", "activity_code", "wbs code", "wbs_code", "id",
    ],
    "description": [
        "description", "activity", "activity description", "work description",
        "activity name", "task", "task description", "remarks", "work item",
        "scope", "scope of work",
    ],
    "status": [
        "status", "progress", "% complete", "percent complete", "%complete",
        "completion", "progress %", "progress%", "pct", "actual progress",
    ],
    "discipline": [
        "discipline", "disc.", "disc", "trade", "department", "dept",
    ],
    "equipment_tag": [
        "equipment_tag", "equipment tag", "equipment", "tag", "tag no",
        "tag number", "tag_no", "equip tag", "asset tag",
    ],
    "location": [
        "location", "area", "zone", "section", "block", "unit",
    ],
    "quantity": [
        "quantity", "qty", "qty.", "actual qty", "actual quantity",
        "completed qty", "installed qty",
    ],
    "unit": [
        "unit", "uom", "unit of measure", "u.o.m", "unit_of_measure",
    ],
}


def _resolve_header(raw_header: str) -> str | None:
    """Map a raw spreadsheet column header to a canonical field name."""
    lower = raw_header.strip().lower()
    for canonical, aliases in _HEADER_ALIASES.items():
        if lower in aliases:
            return canonical
    return None


class DocumentExtractor:
    """
    Extracts structured work observations from heterogeneous field reports
    (Daily PDFs, Excel inspection sheets, site diary text, and voice transcripts).
    """

    @staticmethod
    def extract_from_text(text: str, project_id: UUID, document_id: UUID | None = None) -> list[NormalizedObservation]:
        from datetime import timezone

        observations = []
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        for line in lines:
            # Skip noise / header lines
            lower_line = line.lower()
            if len(line) < 5 or any(
                p in lower_line
                for p in [
                    "page ",
                    "project:",
                    "date:",
                    "contractor:",
                    "report no",
                    "daily construction report",
                    "daily progress report",
                    "site progress report",
                    "progress report",
                    "construction report",
                    "daily site progress",
                    "title:",
                ]
            ):
                continue



            discipline = DocumentExtractor._detect_discipline(line)
            event_type = DocumentExtractor._detect_event_type(line)
            progress = DocumentExtractor._detect_progress(line)
            quantity, unit = DocumentExtractor._detect_quantity(line)
            equipment = DocumentExtractor._detect_equipment(line)
            location = DocumentExtractor._detect_location(line)

            normalized_text = default_normalizer.normalize(line, discipline)

            obs = NormalizedObservation(
                project_id=project_id,
                document_id=document_id,
                raw_text=line,
                normalized_text=normalized_text,
                observed_at=datetime.now(timezone.utc),
                discipline=discipline,
                location=location,
                equipment_tag=equipment,
                event_type=event_type,
                reported_progress=progress,
                reported_quantity=quantity,
                unit_of_measure=unit,
                extraction_confidence=0.95,
            )
            observations.append(obs)

        return observations

    @staticmethod
    def extract_from_pdf_bytes(
        content: bytes, project_id: UUID, document_id: UUID | None = None
    ) -> list[NormalizedObservation]:
        """
        Extracts observations from an uploaded PDF file using PyMuPDF (fitz).
        Falls back to text extraction if PyMuPDF is not available.
        """
        text = ""
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(stream=content, filetype="pdf")
            pages = []
            for page in doc:
                page_text = page.get_text("text")
                if page_text:
                    pages.append(page_text)
            doc.close()
            text = "\n".join(pages)
        except ImportError:
            logger.warning("PyMuPDF (fitz) not available. Attempting pypdf fallback.")
            try:
                from pypdf import PdfReader

                reader = PdfReader(io.BytesIO(content))
                pages = []
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        pages.append(page_text)
                text = "\n".join(pages)
            except Exception:  # noqa: BLE001
                logger.error("Both fitz and pypdf failed to extract PDF text.")
                return []
        except Exception:  # noqa: BLE001
            logger.error("PyMuPDF failed to extract PDF text.")
            return []

        if not text.strip():
            return []

        return DocumentExtractor.extract_from_text(text, project_id, document_id)

    @staticmethod
    def extract_from_excel_bytes(
        content: bytes, project_id: UUID, document_id: UUID | None = None
    ) -> list[NormalizedObservation]:
        """
        Extracts observations from an uploaded Excel or CSV file.
        Supports flexible header aliasing to handle column name variations.
        """
        observations = []
        try:
            import openpyxl

            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = wb.active

            raw_headers: list[str] = []
            canonical_headers: list[str | None] = []
            for row in sheet.iter_rows(values_only=True):
                if not raw_headers:
                    raw_headers = [str(cell).strip().lower() if cell is not None else "" for cell in row]
                    canonical_headers = [_resolve_header(h) for h in raw_headers]
                    continue

                if not any(row):
                    continue

                # Build a dict using canonical field names where possible
                row_values = [str(c) if c is not None else "" for c in row]
                row_dict: dict[str, str] = {}
                for i, val in enumerate(row_values):
                    if i < len(canonical_headers) and canonical_headers[i]:
                        row_dict[canonical_headers[i]] = val
                    elif i < len(raw_headers):
                        row_dict[raw_headers[i]] = val

                # Extract specific fields
                activity_code = row_dict.get("activity_code", "")
                description = row_dict.get("description", "")
                status_str = row_dict.get("status", "")
                discipline_str = row_dict.get("discipline", "")
                equipment_tag = row_dict.get("equipment_tag", "")
                location_str = row_dict.get("location", "")
                quantity_str = row_dict.get("quantity", "")
                unit_str = row_dict.get("unit", "")

                # Fall back to combining all fields if no description
                if not description:
                    parts = [f"{k}: {v}" for k, v in row_dict.items() if v and k]
                    description = " | ".join(parts)

                raw_line = f"{activity_code} {description} {status_str}".strip()
                discipline = DocumentExtractor._detect_discipline(discipline_str or raw_line)
                event_type = DocumentExtractor._detect_event_type(raw_line)
                progress = DocumentExtractor._detect_progress(raw_line)
                normalized_text = default_normalizer.normalize(raw_line, discipline)

                # Parse quantity from column if available
                reported_quantity = None
                if quantity_str:
                    try:
                        reported_quantity = float(quantity_str.replace(",", ""))
                    except ValueError:
                        pass

                # Detect equipment from column if not already found
                equip = equipment_tag or DocumentExtractor._detect_equipment(raw_line)
                loc = location_str or DocumentExtractor._detect_location(raw_line)

                from datetime import timezone

                obs = NormalizedObservation(
                    project_id=project_id,
                    document_id=document_id,
                    raw_text=raw_line,
                    normalized_text=normalized_text,
                    observed_at=datetime.now(timezone.utc),
                    discipline=discipline,
                    event_type=event_type,
                    reported_progress=progress,
                    reported_quantity=reported_quantity,
                    unit_of_measure=unit_str or None,
                    equipment_tag=equip,
                    location=loc,
                    extraction_confidence=0.98,
                )
                observations.append(obs)
        except Exception:  # noqa: BLE001
            # Fallback to plain string extraction if not binary Excel
            text = content.decode("utf-8", errors="ignore")
            return DocumentExtractor.extract_from_text(text, project_id, document_id)

        return observations

    # =========================================================================
    # Pipeline Method: Extract → Normalize → Match (end-to-end)
    # =========================================================================

    @staticmethod
    def extract_and_match(
        content: bytes | str,
        project_id: UUID,
        activities: list[ScheduleActivity],
        document_id: UUID | None = None,
        source_type: str = "DAILY_REPORT",
        filename: str | None = None,
    ) -> list[MatchProposalPayload]:
        """
        Single entry point that takes raw content (text, Excel bytes, or PDF bytes),
        runs extraction → normalization → matching, and returns match proposals.

        This connects the extractor into the matching engine end-to-end.
        """
        from app.services.matcher import HybridMatcher

        # 1. Extract observations based on content type
        observations: list[NormalizedObservation] = []

        if isinstance(content, str):
            observations = DocumentExtractor.extract_from_text(content, project_id, document_id)
        elif isinstance(content, bytes):
            ext = (filename or "").lower()
            if ext.endswith(".pdf"):
                observations = DocumentExtractor.extract_from_pdf_bytes(content, project_id, document_id)
            elif ext.endswith((".xlsx", ".xls", ".csv")):
                observations = DocumentExtractor.extract_from_excel_bytes(content, project_id, document_id)
            else:
                # Try text decoding as fallback
                try:
                    text = content.decode("utf-8", errors="ignore")
                    observations = DocumentExtractor.extract_from_text(text, project_id, document_id)
                except Exception:  # noqa: BLE001
                    logger.error(f"Could not extract from content with filename={filename}")
                    return []

        if not observations:
            return []

        # 2. Deduplicate observations
        observations = HybridMatcher.deduplicate_observations(observations)

        # 3. Match each observation against schedule activities
        proposals: list[MatchProposalPayload] = []
        for obs in observations:
            proposal = HybridMatcher.match_observation(observation=obs, activities=activities)
            proposals.append(proposal)

        return proposals

    # =========================================================================
    # Detection Helpers
    # =========================================================================

    @staticmethod
    def _detect_discipline(text: str) -> DisciplineEnum:
        lower = text.lower()
        if any(
            w in lower
            for w in [
                "piping",
                "spool",
                "hydro",
                "hydrotest",
                "flange",
                "valve",
                "p-101",
                "p-102",
                "pip-",
                "pressure testing",
                "header",
            ]
        ):
            return DisciplineEnum.PIPING
        if any(
            w in lower
            for w in [
                "civil",
                "concrete",
                "pour",
                "rebar",
                "shuttering",
                "excavation",
                "civ-",
                "fnd-",
                "footing",
                "foundation",
                "dewatering",
            ]
        ):
            return DisciplineEnum.CIVIL
        if any(
            w in lower
            for w in ["pump", "compressor", "motor", "alignment", "grouting", "mec-", "crude charge", "c-101", "p-101a"]
        ):
            return DisciplineEnum.MECHANICAL
        if any(
            w in lower
            for w in [
                "electrical",
                "cable",
                "tray",
                "traying",
                "ele-",
                "transformer",
                "switchgear",
                "substation",
                "bracket",
            ]
        ):
            return DisciplineEnum.ELECTRICAL
        if any(
            w in lower
            for w in [
                "instrumentation",
                "transmitter",
                "pt-101",
                "ins-",
                "calibration",
                "scada",
                "plc",
                "tubing",
                "impulse",
            ]
        ):
            return DisciplineEnum.INSTRUMENTATION
        if any(w in lower for w in ["hse", "safety", "incident", "permit", "toolbox", "spill"]):
            return DisciplineEnum.HSE
        return DisciplineEnum.GENERAL

    @staticmethod
    def _detect_event_type(text: str) -> EventTypeEnum:
        lower = text.lower()
        if any(w in lower for w in ["complete", "completed", "done", "finished", "erected", "tested"]):
            return EventTypeEnum.FINISH
        if any(w in lower for w in ["started", "initiated", "commenced", "ongoing"]):
            return EventTypeEnum.START
        if any(w in lower for w in ["delay", "delayed", "weather", "hold", "waiting"]):
            return EventTypeEnum.DELAY
        if any(w in lower for w in ["blocked", "blocker", "material shortage", "permit denied"]):
            return EventTypeEnum.BLOCKER
        if any(w in lower for w in ["inspection", "inspected", "witnessed", "sign off"]):
            return EventTypeEnum.INSPECTION
        return EventTypeEnum.PROGRESS

    @staticmethod
    def _detect_progress(text: str) -> float | None:
        m = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
        if m:
            return float(m.group(1))
        if any(w in text.lower() for w in ["completed", "complete", "100%", "done"]):
            return 100.0
        return None

    @staticmethod
    def _detect_quantity(text: str) -> tuple[float | None, str | None]:
        m = re.search(r"(\d+(?:\.\d+)?)\s*(inch-dia|mt|cu\.m|cum|meters|m|units?|tags?)", text, re.IGNORECASE)
        if m:
            return float(m.group(1)), m.group(2)
        return None, None

    @staticmethod
    def _detect_equipment(text: str) -> str | None:
        m = re.search(
            r"\b(P-101A?|P-102|C-101|PT-101|RACK-[A-Z0-9]+|COL-FTG-\d+|MEC-[A-Z0-9]+|ELE-[A-Z0-9]+|INS-[A-Z0-9]+)\b",
            text,
            re.IGNORECASE,
        )
        return m.group(1).upper() if m else None

    @staticmethod
    def _detect_location(text: str) -> str | None:
        lower = text.lower()
        if "pipe rack b" in lower or "rack b" in lower:
            return "Pipe Rack B"
        if "cdu" in lower or "area 100" in lower:
            return "CDU Area 100"
        if "compressor" in lower or "area 102" in lower:
            return "Compressor House"
        if "substation" in lower:
            return "Substation 4"
        return None
