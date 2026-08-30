import io
import re
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from app.models.schemas import (
    DisciplineEnum,
    EventTypeEnum,
    RawObservation,
    NormalizedObservation,
)
from app.services.normalizer import default_normalizer


class DocumentExtractor:
    """
    Extracts structured work observations from heterogeneous field reports
    (Daily PDFs, Excel inspection sheets, site diary text, and voice transcripts).
    """

    @staticmethod
    def extract_from_text(text: str, project_id: UUID, document_id: Optional[UUID] = None) -> List[NormalizedObservation]:
        from datetime import timezone
        observations = []
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        for line in lines:
            # Skip noise / header lines
            lower_line = line.lower()
            if len(line) < 5 or any(lower_line.startswith(p) for p in ["page ", "project:", "date:", "contractor:", "report no", "daily construction report", "daily progress report", "title:"]):
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
                extraction_confidence=0.95
            )
            observations.append(obs)

        return observations

    @staticmethod
    def extract_from_excel_bytes(content: bytes, project_id: UUID, document_id: Optional[UUID] = None) -> List[NormalizedObservation]:
        """
        Extracts observations from an uploaded Excel or CSV file.
        """
        observations = []
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = wb.active

            headers = []
            for row in sheet.iter_rows(values_only=True):
                if not headers:
                    headers = [str(cell).strip().lower() if cell is not None else "" for cell in row]
                    continue

                if not any(row):
                    continue

                row_dict = dict(zip(headers, [str(c) if c is not None else "" for c in row]))
                
                # Combine row into a descriptive observation text
                parts = [f"{k}: {v}" for k, v in row_dict.items() if v and k]
                raw_text = " | ".join(parts)

                # Extract specific fields if columns match aliases
                activity_code = row_dict.get("activity_id") or row_dict.get("activity code") or row_dict.get("code") or ""
                description = row_dict.get("description") or row_dict.get("activity") or row_dict.get("remarks") or raw_text
                status_str = row_dict.get("status") or row_dict.get("progress") or ""
                discipline_str = row_dict.get("discipline") or ""

                raw_line = f"{activity_code} {description} {status_str}".strip()
                discipline = DocumentExtractor._detect_discipline(discipline_str or raw_line)
                event_type = DocumentExtractor._detect_event_type(raw_line)
                progress = DocumentExtractor._detect_progress(raw_line)
                normalized_text = default_normalizer.normalize(raw_line, discipline)

                obs = NormalizedObservation(
                    project_id=project_id,
                    document_id=document_id,
                    raw_text=raw_line,
                    normalized_text=normalized_text,
                    observed_at=datetime.utcnow(),
                    discipline=discipline,
                    event_type=event_type,
                    reported_progress=progress,
                    extraction_confidence=0.98
                )
                observations.append(obs)
        except Exception as e:
            # Fallback to plain string extraction if not binary Excel
            text = content.decode("utf-8", errors="ignore")
            return DocumentExtractor.extract_from_text(text, project_id, document_id)

        return observations

    @staticmethod
    def _detect_discipline(text: str) -> DisciplineEnum:
        lower = text.lower()
        if any(w in lower for w in ["piping", "spool", "hydro", "hydrotest", "flange", "valve", "p-101", "p-102", "pip-"]):
            return DisciplineEnum.PIPING
        if any(w in lower for w in ["civil", "concrete", "pour", "rebar", "shuttering", "excavation", "civ-", "fnd-", "footing"]):
            return DisciplineEnum.CIVIL
        if any(w in lower for w in ["pump", "compressor", "motor", "alignment", "grouting", "mec-", "crude charge"]):
            return DisciplineEnum.MECHANICAL
        if any(w in lower for w in ["electrical", "cable", "tray", "traying", "ele-", "transformer", "switchgear"]):
            return DisciplineEnum.ELECTRICAL
        if any(w in lower for w in ["instrumentation", "transmitter", "pt-101", "ins-", "calibration", "scada", "plc"]):
            return DisciplineEnum.INSTRUMENTATION
        if any(w in lower for w in ["hse", "safety", "incident", "permit", "toolbox"]):
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
    def _detect_progress(text: str) -> Optional[float]:
        m = re.search(r'(\d+(?:\.\d+)?)\s*%', text)
        if m:
            return float(m.group(1))
        if any(w in text.lower() for w in ["completed", "complete", "100%", "done"]):
            return 100.0
        return None

    @staticmethod
    def _detect_quantity(text: str) -> (Optional[float], Optional[str]):
        m = re.search(r'(\d+(?:\.\d+)?)\s*(inch-dia|mt|cu\.m|cum|meters|m|units?|tags?)', text, re.IGNORECASE)
        if m:
            return float(m.group(1)), m.group(2)
        return None, None

    @staticmethod
    def _detect_equipment(text: str) -> Optional[str]:
        m = re.search(r'\b(P-101A?|P-102|C-101|PT-101|RACK-[A-Z0-9]+|COL-FTG-\d+)\b', text, re.IGNORECASE)
        return m.group(1).upper() if m else None

    @staticmethod
    def _detect_location(text: str) -> Optional[str]:
        lower = text.lower()
        if "pipe rack b" in lower or "rack b" in lower:
            return "Pipe Rack B"
        if "cdu" in lower or "area 100" in lower:
            return "CDU Area 100"
        if "compressor" in lower or "area 102" in lower:
            return "Compressor House"
        return None
