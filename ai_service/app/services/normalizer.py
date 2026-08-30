import re
from datetime import date, datetime

from app.models.schemas import DisciplineEnum

# =============================================================================
# Discipline-Scoped Terminology Maps
# =============================================================================
# Each discipline has its own synonym dictionary so that discipline context
# can be used to prioritize the correct canonical form when there is
# ambiguity across disciplines (e.g. "alignment" in Mechanical vs Civil).
# =============================================================================

PIPING_TERMINOLOGY: dict[str, str] = {
    # Spool Fabrication & Erection
    "spool erection": "Spool Erection and Alignment",
    "spool alignment": "Spool Erection and Alignment",
    "pipe erection": "Spool Erection and Alignment",
    "spool fitup": "Spool Fit-up and Welding",
    "spool fit-up": "Spool Fit-up and Welding",
    "spool welding": "Spool Fit-up and Welding",
    "weld fitup": "Weld Fit-up",
    "weld fit-up": "Weld Fit-up",
    "weld visual": "Weld Visual Inspection",
    "weld vi": "Weld Visual Inspection",
    # Testing
    "hydro test": "Hydrostatic Testing",
    "hydrotest": "Hydrostatic Testing",
    "hydro testing": "Hydrostatic Testing",
    "hydro-test": "Hydrostatic Testing",
    "pressure test": "Hydrostatic Testing",
    "leak test": "Hydrostatic Testing",
    "pneumatic test": "Pneumatic Testing",
    "pneumatic testing": "Pneumatic Testing",
    "service test": "Service Testing",
    # NDE / Radiography
    "nde": "Non-Destructive Examination",
    "radiography": "Radiographic Testing",
    "rt shot": "Radiographic Testing",
    "dpt": "Dye Penetrant Testing",
    "dye penetrant": "Dye Penetrant Testing",
    "mpi": "Magnetic Particle Inspection",
    "ultrasonic test": "Ultrasonic Testing",
    "ut test": "Ultrasonic Testing",
    # Piping Completion
    "line boxing-up": "Line Boxing-up and Reinstatement",
    "boxing-up": "Line Boxing-up and Reinstatement",
    "boxing up": "Line Boxing-up and Reinstatement",
    "reinstatement": "Line Boxing-up and Reinstatement",
    "flushing": "Line Flushing",
    "chemical cleaning": "Chemical Cleaning",
    "pigging": "Pipeline Pigging",
    "tie-in": "Tie-in Welding",
    "tie in": "Tie-in Welding",
    "hot tap": "Hot Tap Connection",
    "bolt torquing": "Bolt Torquing",
    "bolt tensioning": "Bolt Tensioning",
    "flange management": "Flange Management",
    "joint completion": "Joint Completion",
    "gasket insertion": "Gasket Insertion",
    "spring hanger": "Spring Hanger Installation",
    "pipe support": "Pipe Support Installation",
    # Line Tag Normalization
    "p-101": "Line P-101",
    "p 101": "Line P-101",
    "p101": "Line P-101",
    "p-102": "Line P-102",
    "p 102": "Line P-102",
    "p102": "Line P-102",
    "pip2401": "PIP-2401",
    "pip 2401": "PIP-2401",
    "pip2402": "PIP-2402",
    "pip 2402": "PIP-2402",
    "pip2400": "PIP-2400",
    "pip 2400": "PIP-2400",
}

CIVIL_TERMINOLOGY: dict[str, str] = {
    # Rebar & Formwork
    "rebar": "Rebar Tying and Shuttering",
    "rebar tying": "Rebar Tying and Shuttering",
    "rebar binding": "Rebar Tying and Shuttering",
    "rebar cutting": "Rebar Cutting and Bending",
    "rebar bending": "Rebar Cutting and Bending",
    "reinforcement": "Rebar Tying and Shuttering",
    "shuttering": "Rebar Tying and Shuttering",
    "formwork": "Rebar Tying and Shuttering",
    "deshuttering": "Deshuttering and Curing",
    "deformwork": "Deshuttering and Curing",
    # Concrete
    "pour": "Concrete Pour",
    "concrete pour": "Concrete Pour",
    "concreting": "Concrete Pour",
    "rcc casting": "Concrete Pour",
    "pcc": "Plain Cement Concrete",
    "blinding concrete": "Blinding Concrete",
    "mass concrete": "Mass Concrete Pour",
    "lean concrete": "Lean Concrete",
    "non-shrink grout": "Non-Shrink Grouting",
    "curing": "Concrete Curing",
    # Earthwork
    "backfilling": "Trench Excavation and Backfilling",
    "excavation": "Trench Excavation and Backfilling",
    "soil compaction": "Soil Compaction",
    "compaction": "Soil Compaction",
    "dewatering": "Dewatering",
    "pile driving": "Pile Driving",
    "piling": "Pile Driving",
    "pile cap": "Pile Cap Construction",
    # Structural
    "pedestal": "Pedestal Construction",
    "plinth beam": "Plinth Beam Construction",
    "tie beam": "Tie Beam Construction",
    "grade beam": "Grade Beam Construction",
    "retaining wall": "Retaining Wall Construction",
    "anchor bolt": "Anchor Bolt Installation",
    "grout pocket": "Grout Pocket Preparation",
    "levelling": "Surface Levelling",
    "waterproofing": "Waterproofing",
    "column footing": "Column Footing Construction",
    "footing": "Foundation Footing",
}

MECHANICAL_TERMINOLOGY: dict[str, str] = {
    # Equipment Alignment & Setting
    "pump alignment": "Equipment Alignment - Crude Charge Pump P-101A",
    "shaft alignment": "Equipment Alignment - Crude Charge Pump P-101A",
    "grouting": "Equipment Alignment - Crude Charge Pump P-101A",
    "coupling alignment": "Coupling Alignment",
    "hot alignment": "Hot Alignment Check",
    "cold alignment": "Cold Alignment Check",
    "setting on foundation": "Equipment Setting on Foundation",
    "equipment setting": "Equipment Setting on Foundation",
    # Erection
    "vessel erection": "Vessel Erection",
    "column erection": "Column Erection",
    "exchanger erection": "Heat Exchanger Erection",
    "nozzle orientation": "Nozzle Orientation Check",
    "internals installation": "Vessel Internals Installation",
    # Testing & Completion
    "vibration test": "Vibration Test",
    "lube oil flush": "Lube Oil Flushing",
    "run test": "Equipment Run Test",
    "solo run": "Motor Solo Run",
    "bump test": "Motor Bump Test",
    "mechanical completion": "Mechanical Completion",
    "pre-commissioning": "Pre-Commissioning",
    "commissioning": "Commissioning",
    # Tags
    "p-101a": "Pump P-101A",
    "p101a": "Pump P-101A",
    "c-101": "Compressor C-101",
    "c101": "Compressor C-101",
}

ELECTRICAL_TERMINOLOGY: dict[str, str] = {
    # Cable Tray & Laying
    "traying": "Cable Tray Installation",
    "cable tray": "Cable Tray Installation",
    "cable laying": "Cable Laying",
    "cable pulling": "Cable Pulling",
    # Termination & Testing
    "glanding": "Cable Glanding",
    "cable glanding": "Cable Glanding",
    "termination": "Cable Termination",
    "cable termination": "Cable Termination",
    "megger test": "Megger Testing",
    "meggering": "Megger Testing",
    "insulation resistance test": "Megger Testing",
    "hi-pot test": "Hi-Pot Testing",
    "hipot": "Hi-Pot Testing",
    "high potential test": "Hi-Pot Testing",
    "continuity test": "Continuity Testing",
    # Equipment
    "relay setting": "Protective Relay Setting",
    "relay calibration": "Protective Relay Setting",
    "busbar": "Busbar Installation",
    "bus bar": "Busbar Installation",
    "motor solo run": "Motor Solo Run Test",
    "vfd commissioning": "VFD Commissioning",
    "vfd": "Variable Frequency Drive",
    "transformer oil filling": "Transformer Oil Filling",
    "transformer erection": "Transformer Erection",
    "switchgear": "Switchgear Installation",
    "mcc panel": "MCC Panel Installation",
    "mcc": "Motor Control Centre",
    # Earthing & Lighting
    "earthing": "Earthing and Grounding",
    "grounding": "Earthing and Grounding",
    "earth pit": "Earth Pit Installation",
    "lighting installation": "Lighting Installation",
    "area lighting": "Area Lighting Installation",
}

INSTRUMENTATION_TERMINOLOGY: dict[str, str] = {
    # Calibration & Hookup
    "pt calibration": "Transmitter Calibration and Hookup - PT-101",
    "pt-101": "Transmitter PT-101",
    "loop check": "Transmitter Calibration and Hookup - PT-101",
    "loop test": "Transmitter Calibration and Hookup - PT-101",
    "impulse line": "Transmitter Calibration and Hookup - PT-101",
    "impulse tubing": "Impulse Line Installation",
    # Control Systems
    "dcs checkout": "DCS Checkout",
    "dcs": "Distributed Control System",
    "sis checkout": "SIS Checkout",
    "sis": "Safety Instrumented System",
    "plc": "Programmable Logic Controller",
    "scada": "SCADA System",
    # Junction & Marshalling
    "jb wiring": "Junction Box Wiring",
    "junction box": "Junction Box Installation",
    "marshalling cabinet": "Marshalling Cabinet Wiring",
    "marshalling panel": "Marshalling Cabinet Wiring",
    # Instruments
    "control valve stroking": "Control Valve Stroking Test",
    "valve stroking": "Control Valve Stroking Test",
    "orifice plate": "Orifice Plate Installation",
    "rtd installation": "RTD Installation",
    "thermocouple": "Thermocouple Installation",
    "fire and gas detector": "Fire and Gas Detector Hookup",
    "f&g detector": "Fire and Gas Detector Hookup",
    "f&g hookup": "Fire and Gas Detector Hookup",
    "cctv installation": "CCTV Installation",
    "flow transmitter": "Flow Transmitter Calibration",
    "level transmitter": "Level Transmitter Calibration",
    "pressure transmitter": "Pressure Transmitter Calibration",
    "temperature transmitter": "Temperature Transmitter Calibration",
}

HSE_TERMINOLOGY: dict[str, str] = {
    "ptw": "Permit to Work",
    "permit to work": "Permit to Work",
    "work permit": "Permit to Work",
    "confined space entry": "Confined Space Entry",
    "confined space": "Confined Space Entry",
    "scaffold erection": "Scaffold Erection",
    "scaffolding": "Scaffold Erection",
    "scaffold inspection": "Scaffold Inspection",
    "scaffold tag": "Scaffold Inspection",
    "housekeeping": "Housekeeping",
    "fire watch": "Fire Watch",
    "gas test": "Gas Testing",
    "gas free": "Gas Free Certificate",
    "excavation permit": "Excavation Permit",
    "toolbox talk": "Toolbox Talk",
    "toolbox": "Toolbox Talk",
    "safety induction": "Safety Induction",
    "safety briefing": "Safety Briefing",
    "incident report": "Incident Report",
    "near miss": "Near Miss Report",
    "first aid": "First Aid Case",
    "ppe": "Personal Protective Equipment",
}

CONSTRUCTION_SHORTHAND: dict[str, str] = {
    "wip": "Work in Progress",
    "rfi": "Request for Inspection",
    "tpi": "Third Party Inspection",
    "qc": "Quality Control",
    "qa/qc": "Quality Assurance and Quality Control",
    "matl": "Material",
    "mtrl": "Material",
    "avail": "Available",
    "instld": "Installed",
    "erectn": "Erection",
    "fab": "Fabrication",
    "fit-up": "Fit-up",
    "fitup": "Fit-up",
    "insp": "Inspection",
    "hold pt": "Hold Point",
    "n/s": "Not Started",
    "i/p": "In Progress",
}

# Combined flat map for backward compatibility
DEFAULT_TERMINOLOGY_MAP: dict[str, str] = {
    **PIPING_TERMINOLOGY,
    **CIVIL_TERMINOLOGY,
    **MECHANICAL_TERMINOLOGY,
    **ELECTRICAL_TERMINOLOGY,
    **INSTRUMENTATION_TERMINOLOGY,
    **HSE_TERMINOLOGY,
    **CONSTRUCTION_SHORTHAND,
}

# Discipline → terminology sub-map
DISCIPLINE_TERMINOLOGY: dict[DisciplineEnum, dict[str, str]] = {
    DisciplineEnum.PIPING: PIPING_TERMINOLOGY,
    DisciplineEnum.CIVIL: CIVIL_TERMINOLOGY,
    DisciplineEnum.MECHANICAL: MECHANICAL_TERMINOLOGY,
    DisciplineEnum.ELECTRICAL: ELECTRICAL_TERMINOLOGY,
    DisciplineEnum.INSTRUMENTATION: INSTRUMENTATION_TERMINOLOGY,
    DisciplineEnum.HSE: HSE_TERMINOLOGY,
}

# =============================================================================
# Unit Normalization
# =============================================================================
UNIT_CANONICAL: dict[str, str] = {
    "cu.m": "Cu.M",
    "cum": "Cu.M",
    "cu m": "Cu.M",
    "cubic meter": "Cu.M",
    "cubic metre": "Cu.M",
    "cubic meters": "Cu.M",
    "cubic metres": "Cu.M",
    "inch-dia": "Inch-Dia",
    "inch dia": "Inch-Dia",
    "id": "Inch-Dia",
    "mt": "MT",
    "metric ton": "MT",
    "metric tonne": "MT",
    "tonnes": "MT",
    "ton": "MT",
    "nos": "Nos",
    "nos.": "Nos",
    "numbers": "Nos",
    "rm": "RM",
    "running meter": "RM",
    "running metre": "RM",
    "running meters": "RM",
    "sqm": "Sq.M",
    "sq.m": "Sq.M",
    "sq m": "Sq.M",
    "square meter": "Sq.M",
    "square metre": "Sq.M",
    "meters": "M",
    "metre": "M",
    "meter": "M",
    "m": "M",
    "units": "Units",
    "unit": "Unit",
    "tags": "Tags",
    "tag": "Tag",
    "test-pack": "Test-Pack",
    "test pack": "Test-Pack",
    "joints": "Joints",
    "joint": "Joint",
    "sets": "Sets",
    "set": "Set",
    "kg": "Kg",
    "kilogram": "Kg",
    "kilograms": "Kg",
    "litre": "L",
    "liter": "L",
    "litres": "L",
    "liters": "L",
    "hrs": "Hours",
    "hr": "Hours",
    "hours": "Hours",
}

DISCIPLINE_ALIASES: dict[str, DisciplineEnum] = {
    "civil": DisciplineEnum.CIVIL,
    "civ": DisciplineEnum.CIVIL,
    "structural": DisciplineEnum.CIVIL,
    "piping": DisciplineEnum.PIPING,
    "pipe": DisciplineEnum.PIPING,
    "pipeline": DisciplineEnum.PIPING,
    "mechanical": DisciplineEnum.MECHANICAL,
    "mech": DisciplineEnum.MECHANICAL,
    "rotating": DisciplineEnum.MECHANICAL,
    "static equipment": DisciplineEnum.MECHANICAL,
    "electrical": DisciplineEnum.ELECTRICAL,
    "elec": DisciplineEnum.ELECTRICAL,
    "e&i": DisciplineEnum.ELECTRICAL,
    "instrumentation": DisciplineEnum.INSTRUMENTATION,
    "instrument": DisciplineEnum.INSTRUMENTATION,
    "inst": DisciplineEnum.INSTRUMENTATION,
    "control": DisciplineEnum.INSTRUMENTATION,
    "hse": DisciplineEnum.HSE,
    "ehs": DisciplineEnum.HSE,
    "safety": DisciplineEnum.HSE,
    "general": DisciplineEnum.GENERAL,
}

# =============================================================================
# Date Normalization Patterns
# =============================================================================
# Matches common Indian/EPC date formats:
#   20-Aug-2026, 20/08/2026, 20.08.26, 20-08-2026, Aug 20 2026
_MONTH_MAP = {
    "jan": "01",
    "feb": "02",
    "mar": "03",
    "apr": "04",
    "may": "05",
    "jun": "06",
    "jul": "07",
    "aug": "08",
    "sep": "09",
    "oct": "10",
    "nov": "11",
    "dec": "12",
    "january": "01",
    "february": "02",
    "march": "03",
    "april": "04",
    "june": "06",
    "july": "07",
    "august": "08",
    "september": "09",
    "october": "10",
    "november": "11",
    "december": "12",
}

_DATE_PATTERNS = [
    # 20-Aug-2026 or 20 Aug 2026
    re.compile(r"\b(\d{1,2})[\s\-./]([A-Za-z]{3,9})[\s\-./](\d{2,4})\b"),
    # Aug-20-2026 or Aug 20, 2026
    re.compile(r"\b([A-Za-z]{3,9})[\s\-./](\d{1,2})[,]?\s*[\s\-./]?(\d{2,4})\b"),
    # 20/08/2026, 20-08-2026, 20.08.2026
    re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b"),
]


def normalize_date(text: str) -> str:
    """Replace common date formats with ISO YYYY-MM-DD in-place."""

    def _replace_dmy_alpha(match: re.Match) -> str:
        day, month_str, year = match.group(1), match.group(2).lower(), match.group(3)
        month = _MONTH_MAP.get(month_str)
        if not month:
            return match.group(0)
        if len(year) == 2:
            year = f"20{year}"
        return f"{year}-{month}-{int(day):02d}"

    def _replace_mdy_alpha(match: re.Match) -> str:
        month_str, day, year = match.group(1).lower(), match.group(2), match.group(3)
        month = _MONTH_MAP.get(month_str)
        if not month:
            return match.group(0)
        if len(year) == 2:
            year = f"20{year}"
        return f"{year}-{month}-{int(day):02d}"

    def _replace_dmy_numeric(match: re.Match) -> str:
        day, month, year = match.group(1), match.group(2), match.group(3)
        if int(month) > 12 or int(day) > 31:
            return match.group(0)
        if len(year) == 2:
            year = f"20{year}"
        return f"{year}-{int(month):02d}-{int(day):02d}"

    text = _DATE_PATTERNS[0].sub(_replace_dmy_alpha, text)
    text = _DATE_PATTERNS[1].sub(_replace_mdy_alpha, text)
    text = _DATE_PATTERNS[2].sub(_replace_dmy_numeric, text)
    return text


def parse_date_value(value: object) -> date | None:
    """Parse the common date values used in DPRs, site diaries, P6, and MS Project exports."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    raw = str(value).strip()
    normalized = normalize_date(raw)
    iso_match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", normalized)
    if iso_match:
        try:
            return date.fromisoformat(iso_match.group(0))
        except ValueError:
            return None

    for fmt in ("%Y/%m/%d", "%Y.%m.%d", "%d-%b-%Y", "%d %B %Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def normalize_discipline(value: object) -> DisciplineEnum:
    raw = str(value or "").strip().lower()
    if not raw:
        return DisciplineEnum.GENERAL
    if raw in DISCIPLINE_ALIASES:
        return DISCIPLINE_ALIASES[raw]
    for alias, discipline in DISCIPLINE_ALIASES.items():
        if re.search(rf"\b{re.escape(alias)}\b", raw):
            return discipline
    return DisciplineEnum.GENERAL


def normalize_equipment_tag(value: object) -> str | None:
    raw = str(value or "").strip().upper()
    if not raw:
        return None
    raw = re.sub(r"^(?:LINE|PUMP|EQUIPMENT|EQUIP|TAG)[\s:_-]+", "", raw)
    raw = re.sub(r"\s*/\s*", "/", raw)
    raw = re.sub(r"[\s_]+", "-", raw)
    raw = re.sub(r"-+", "-", raw).strip("-")
    raw = re.sub(r"^([A-Z]{1,6})(\d{2,5}[A-Z]?)$", r"\1-\2", raw)
    return raw or None


def normalize_unit_name(value: object) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    key = re.sub(r"\s+", " ", raw.lower())
    if key in UNIT_CANONICAL:
        return UNIT_CANONICAL[key]
    compact = key.replace(".", "").replace("-", " ")
    for alias, canonical in UNIT_CANONICAL.items():
        if compact == alias.replace(".", "").replace("-", " "):
            return canonical
    return raw


def normalize_quantity_value(value: object) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return max(0.0, float(value))
    match = re.search(r"-?\d[\d,]*(?:\.\d+)?", str(value))
    if not match:
        return None
    return max(0.0, float(match.group(0).replace(",", "")))


def normalize_unit(text: str) -> str:
    """Standardize unit spelling in observation text."""
    for raw, canonical in sorted(UNIT_CANONICAL.items(), key=lambda x: len(x[0]), reverse=True):
        pattern = re.compile(rf"(\d+(?:\.\d+)?)\s*{re.escape(raw)}\b", re.IGNORECASE)
        text = pattern.sub(rf"\1 {canonical}", text)
    return text


class TerminologyNormalizer:
    def __init__(self, project_overrides: dict[str, str] | None = None):
        self.term_map = {**DEFAULT_TERMINOLOGY_MAP, **(project_overrides or {})}

        # Build discipline-indexed lookup for fast discipline-scoped search
        self._discipline_maps: dict[DisciplineEnum, dict[str, str]] = {}
        for disc, disc_map in DISCIPLINE_TERMINOLOGY.items():
            merged = {**disc_map}
            if project_overrides:
                merged.update(project_overrides)
            self._discipline_maps[disc] = merged

    def normalize(self, text: str, discipline: DisciplineEnum | None = None) -> str:
        if not text:
            return ""

        cleaned = text.strip()

        # 1. Date normalization
        cleaned = normalize_date(cleaned)

        # 2. Unit normalization
        cleaned = normalize_unit(cleaned)

        lower = cleaned.lower()

        # 3. Terminology replacement — discipline-scoped if available
        if discipline and discipline in self._discipline_maps:
            # Apply discipline-specific synonyms first (higher priority)
            disc_map = self._discipline_maps[discipline]
            for raw_syn, canonical in sorted(disc_map.items(), key=lambda x: len(x[0]), reverse=True):
                pattern = re.compile(rf"\b{re.escape(raw_syn)}\b", re.IGNORECASE)
                if pattern.search(lower):
                    cleaned = pattern.sub(canonical, cleaned)
                    lower = cleaned.lower()

            # Then apply remaining global synonyms for terms not in this discipline's map
            for raw_syn, canonical in sorted(self.term_map.items(), key=lambda x: len(x[0]), reverse=True):
                if raw_syn in disc_map:
                    continue  # Already handled above
                pattern = re.compile(rf"\b{re.escape(raw_syn)}\b", re.IGNORECASE)
                if pattern.search(lower):
                    cleaned = pattern.sub(canonical, cleaned)
                    lower = cleaned.lower()
        else:
            # No discipline context — use full global map
            for raw_syn, canonical in sorted(self.term_map.items(), key=lambda x: len(x[0]), reverse=True):
                pattern = re.compile(rf"\b{re.escape(raw_syn)}\b", re.IGNORECASE)
                if pattern.search(lower):
                    cleaned = pattern.sub(canonical, cleaned)
                    lower = cleaned.lower()

        # 4. Standardize whitespace and percentages
        cleaned = re.sub(r"(\d+)\s*%", r"\1%", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()


default_normalizer = TerminologyNormalizer()
