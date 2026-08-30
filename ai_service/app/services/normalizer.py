import re
from typing import Dict, Optional
from uuid import UUID

from app.models.schemas import DisciplineEnum


# Standard default infrastructure domain dictionary
DEFAULT_TERMINOLOGY_MAP: Dict[str, str] = {
    # Piping
    "spool erection": "Spool Erection and Alignment",
    "spool alignment": "Spool Erection and Alignment",
    "pipe erection": "Spool Erection and Alignment",
    "hydro test": "Hydrostatic Testing",
    "hydrotest": "Hydrostatic Testing",
    "hydro testing": "Hydrostatic Testing",
    "hydro-test": "Hydrostatic Testing",
    "pressure test": "Hydrostatic Testing",
    "leak test": "Hydrostatic Testing",
    "p-101": "Line P-101",
    "p 101": "Line P-101",
    "p101": "Line P-101",
    "p-102": "Line P-102",
    "p 102": "Line P-102",
    "p102": "Line P-102",
    "pip2401": "PIP-2401",
    "pip 2401": "PIP-2401",
    
    # Civil
    "rebar": "Rebar Tying and Shuttering",
    "rebar tying": "Rebar Tying and Shuttering",
    "reinforcement": "Rebar Tying and Shuttering",
    "shuttering": "Rebar Tying and Shuttering",
    "formwork": "Rebar Tying and Shuttering",
    "pour": "Concrete Pour",
    "concrete pour": "Concrete Pour",
    "concreting": "Concrete Pour",
    "rcc casting": "Concrete Pour",
    "backfilling": "Trench Excavation and Backfilling",
    "excavation": "Trench Excavation and Backfilling",
    
    # Mechanical
    "pump alignment": "Equipment Alignment - Crude Charge Pump P-101A",
    "shaft alignment": "Equipment Alignment - Crude Charge Pump P-101A",
    "grouting": "Equipment Alignment - Crude Charge Pump P-101A",
    "p-101a": "Pump P-101A",
    "p101a": "Pump P-101A",
    
    # Electrical
    "traying": "Cable Tray Installation",
    "cable tray": "Cable Tray Installation",
    "cable laying": "Cable Tray Installation",
    "cable pulling": "Cable Tray Installation",
    
    # Instrumentation
    "pt calibration": "Transmitter Calibration and Hookup - PT-101",
    "pt-101": "Transmitter PT-101",
    "loop check": "Transmitter Calibration and Hookup - PT-101",
    "impulse line": "Transmitter Calibration and Hookup - PT-101"
}


class TerminologyNormalizer:
    def __init__(self, project_overrides: Optional[Dict[str, str]] = None):
        self.term_map = {**DEFAULT_TERMINOLOGY_MAP, **(project_overrides or {})}

    def normalize(self, text: str, discipline: Optional[DisciplineEnum] = None) -> str:
        if not text:
            return ""

        cleaned = text.strip()
        lower = cleaned.lower()

        # Replace known synonyms
        for raw_syn, canonical in sorted(self.term_map.items(), key=lambda x: len(x[0]), reverse=True):
            pattern = re.compile(rf"\b{re.escape(raw_syn)}\b", re.IGNORECASE)
            if pattern.search(lower):
                cleaned = pattern.sub(canonical, cleaned)
                lower = cleaned.lower()

        # Standardize dates and percentages
        cleaned = re.sub(r'(\d+)\s*%', r'\1%', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()


default_normalizer = TerminologyNormalizer()
