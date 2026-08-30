"""
Comprehensive tests for the DocumentExtractor service.
Tests all extraction paths: text, discipline detection, event detection, 
progress detection, quantity detection, equipment detection, and location detection.
"""
from datetime import date
from uuid import uuid4
import pytest

from app.services.extractor import DocumentExtractor
from app.models.schemas import DisciplineEnum, EventTypeEnum


# =============================================================================
# Discipline Detection Tests
# =============================================================================

class TestDisciplineDetection:
    """Tests for _detect_discipline across all 7 disciplines."""

    def test_piping_spool(self):
        assert DocumentExtractor._detect_discipline("Spool erection on Rack B") == DisciplineEnum.PIPING

    def test_piping_hydro(self):
        assert DocumentExtractor._detect_discipline("Hydro test completed") == DisciplineEnum.PIPING

    def test_piping_hydrotest(self):
        assert DocumentExtractor._detect_discipline("Hydrotest passed") == DisciplineEnum.PIPING

    def test_piping_valve(self):
        assert DocumentExtractor._detect_discipline("Valve installation complete") == DisciplineEnum.PIPING

    def test_piping_flange(self):
        assert DocumentExtractor._detect_discipline("Flange bolting in progress") == DisciplineEnum.PIPING

    def test_piping_p101(self):
        assert DocumentExtractor._detect_discipline("P-101 line tested") == DisciplineEnum.PIPING

    def test_piping_p102(self):
        assert DocumentExtractor._detect_discipline("P-102 spool erected") == DisciplineEnum.PIPING

    def test_piping_code_prefix(self):
        assert DocumentExtractor._detect_discipline("PIP-2400 completed") == DisciplineEnum.PIPING

    def test_civil_concrete(self):
        assert DocumentExtractor._detect_discipline("Concrete pour for footing") == DisciplineEnum.CIVIL

    def test_civil_rebar(self):
        assert DocumentExtractor._detect_discipline("Rebar cutting and bending") == DisciplineEnum.CIVIL

    def test_civil_shuttering(self):
        assert DocumentExtractor._detect_discipline("Shuttering erected for column") == DisciplineEnum.CIVIL

    def test_civil_excavation(self):
        assert DocumentExtractor._detect_discipline("Excavation for foundation trench") == DisciplineEnum.CIVIL

    def test_civil_footing(self):
        assert DocumentExtractor._detect_discipline("Column footing inspection") == DisciplineEnum.CIVIL

    def test_civil_code_prefix(self):
        assert DocumentExtractor._detect_discipline("CIV-1100 rebar work") == DisciplineEnum.CIVIL

    def test_mechanical_pump(self):
        assert DocumentExtractor._detect_discipline("Pump alignment started") == DisciplineEnum.MECHANICAL

    def test_mechanical_compressor(self):
        assert DocumentExtractor._detect_discipline("Compressor station grouting") == DisciplineEnum.MECHANICAL

    def test_mechanical_motor(self):
        assert DocumentExtractor._detect_discipline("Motor installation complete") == DisciplineEnum.MECHANICAL

    def test_mechanical_alignment(self):
        assert DocumentExtractor._detect_discipline("Shaft alignment verification") == DisciplineEnum.MECHANICAL

    def test_electrical_cable(self):
        assert DocumentExtractor._detect_discipline("Cable tray installation") == DisciplineEnum.ELECTRICAL

    def test_electrical_transformer(self):
        assert DocumentExtractor._detect_discipline("Transformer positioning") == DisciplineEnum.ELECTRICAL

    def test_electrical_switchgear(self):
        assert DocumentExtractor._detect_discipline("Switchgear room prep") == DisciplineEnum.ELECTRICAL

    def test_instrumentation_transmitter(self):
        assert DocumentExtractor._detect_discipline("Transmitter calibration") == DisciplineEnum.INSTRUMENTATION

    def test_instrumentation_scada(self):
        assert DocumentExtractor._detect_discipline("SCADA integration test") == DisciplineEnum.INSTRUMENTATION

    def test_instrumentation_plc(self):
        assert DocumentExtractor._detect_discipline("PLC configuration complete") == DisciplineEnum.INSTRUMENTATION

    def test_hse_safety(self):
        assert DocumentExtractor._detect_discipline("Safety inspection done") == DisciplineEnum.HSE

    def test_hse_toolbox(self):
        assert DocumentExtractor._detect_discipline("Toolbox talk conducted") == DisciplineEnum.HSE

    def test_hse_permit(self):
        assert DocumentExtractor._detect_discipline("Hot work permit issued") == DisciplineEnum.HSE

    def test_general_fallback(self):
        assert DocumentExtractor._detect_discipline("General site cleanup") == DisciplineEnum.GENERAL

    def test_empty_string(self):
        assert DocumentExtractor._detect_discipline("") == DisciplineEnum.GENERAL

    def test_random_text(self):
        assert DocumentExtractor._detect_discipline("Lunch break at canteen") == DisciplineEnum.GENERAL


# =============================================================================
# Event Type Detection Tests
# =============================================================================

class TestEventTypeDetection:
    """Tests for _detect_event_type across all 6 event types."""

    def test_finish_complete(self):
        assert DocumentExtractor._detect_event_type("Work complete") == EventTypeEnum.FINISH

    def test_finish_completed(self):
        assert DocumentExtractor._detect_event_type("Task completed successfully") == EventTypeEnum.FINISH

    def test_finish_done(self):
        assert DocumentExtractor._detect_event_type("Painting done") == EventTypeEnum.FINISH

    def test_finish_finished(self):
        assert DocumentExtractor._detect_event_type("Welding finished at 3pm") == EventTypeEnum.FINISH

    def test_finish_erected(self):
        assert DocumentExtractor._detect_event_type("Steel structure erected") == EventTypeEnum.FINISH

    def test_finish_tested(self):
        assert DocumentExtractor._detect_event_type("Pressure tested and passed") == EventTypeEnum.FINISH

    def test_start_started(self):
        assert DocumentExtractor._detect_event_type("Excavation started this morning") == EventTypeEnum.START

    def test_start_initiated(self):
        assert DocumentExtractor._detect_event_type("Work initiated on zone 3") == EventTypeEnum.START

    def test_start_commenced(self):
        assert DocumentExtractor._detect_event_type("Concrete pour commenced") == EventTypeEnum.START

    def test_start_ongoing(self):
        assert DocumentExtractor._detect_event_type("Rebar work ongoing") == EventTypeEnum.START

    def test_delay_delayed(self):
        assert DocumentExtractor._detect_event_type("Work delayed due to rain") == EventTypeEnum.DELAY

    def test_delay_weather(self):
        assert DocumentExtractor._detect_event_type("Weather hold on activities") == EventTypeEnum.DELAY

    def test_delay_waiting(self):
        assert DocumentExtractor._detect_event_type("Waiting for material delivery") == EventTypeEnum.DELAY

    def test_blocker_blocked(self):
        assert DocumentExtractor._detect_event_type("Work blocked by permit issue") == EventTypeEnum.BLOCKER

    def test_blocker_material_shortage(self):
        assert DocumentExtractor._detect_event_type("Material shortage halting work") == EventTypeEnum.BLOCKER

    def test_inspection(self):
        assert DocumentExtractor._detect_event_type("Third party inspection scheduled") == EventTypeEnum.INSPECTION

    def test_inspection_witnessed(self):
        assert DocumentExtractor._detect_event_type("Witnessed hydro test result") == EventTypeEnum.INSPECTION

    def test_progress_default(self):
        assert DocumentExtractor._detect_event_type("45% of rebar tying done in area 2") == EventTypeEnum.FINISH

    def test_progress_no_keywords(self):
        assert DocumentExtractor._detect_event_type("Continued work on piping") == EventTypeEnum.PROGRESS


# =============================================================================
# Progress Detection Tests
# =============================================================================

class TestProgressDetection:
    """Tests for _detect_progress percentage extraction."""

    def test_integer_percentage(self):
        assert DocumentExtractor._detect_progress("Work at 75%") == 75.0

    def test_float_percentage(self):
        assert DocumentExtractor._detect_progress("Progress: 33.5% complete") == 33.5

    def test_hundred_percent_keyword(self):
        assert DocumentExtractor._detect_progress("Spool erection completed") == 100.0

    def test_hundred_percent_symbol(self):
        assert DocumentExtractor._detect_progress("Achieved 100%") == 100.0

    def test_done_keyword(self):
        assert DocumentExtractor._detect_progress("All work done") == 100.0

    def test_zero_percent(self):
        assert DocumentExtractor._detect_progress("0% work started") == 0.0

    def test_no_progress(self):
        assert DocumentExtractor._detect_progress("Working on site today") is None

    def test_spaced_percentage(self):
        assert DocumentExtractor._detect_progress("50 % finished") == 50.0

    def test_multiple_numbers_picks_first(self):
        result = DocumentExtractor._detect_progress("Phase 1 at 60%, Phase 2 at 20%")
        assert result == 60.0


# =============================================================================
# Quantity Detection Tests
# =============================================================================

class TestQuantityDetection:
    """Tests for _detect_quantity value and unit extraction."""

    def test_inch_dia(self):
        qty, unit = DocumentExtractor._detect_quantity("Erected 450 Inch-Dia of piping")
        assert qty == 450.0
        assert unit.lower() == "inch-dia"

    def test_metric_tons(self):
        qty, unit = DocumentExtractor._detect_quantity("35.5 MT of rebar tied")
        assert qty == 35.5
        assert unit.upper() == "MT"

    def test_cubic_meters(self):
        qty, unit = DocumentExtractor._detect_quantity("Poured 180 Cu.M of concrete")
        assert qty == 180.0

    def test_meters(self):
        qty, unit = DocumentExtractor._detect_quantity("Laid 25 meters of cable")
        assert qty == 25.0

    def test_no_quantity(self):
        qty, unit = DocumentExtractor._detect_quantity("General site cleanup done")
        assert qty is None
        assert unit is None


# =============================================================================
# Equipment Detection Tests
# =============================================================================

class TestEquipmentDetection:
    """Tests for _detect_equipment tag extraction."""

    def test_p101(self):
        assert DocumentExtractor._detect_equipment("Testing on P-101") == "P-101"

    def test_p102(self):
        assert DocumentExtractor._detect_equipment("Line P-102 spool erected") == "P-102"

    def test_c101(self):
        assert DocumentExtractor._detect_equipment("Compressor C-101 alignment") == "C-101"

    def test_col_ftg(self):
        assert DocumentExtractor._detect_equipment("Footing COL-FTG-100 poured") == "COL-FTG-100"

    def test_rack_tag(self):
        assert DocumentExtractor._detect_equipment("RACK-B work done") == "RACK-B"

    def test_no_equipment(self):
        assert DocumentExtractor._detect_equipment("General work on site") is None


# =============================================================================
# Location Detection Tests
# =============================================================================

class TestLocationDetection:
    """Tests for _detect_location."""

    def test_pipe_rack_b(self):
        assert DocumentExtractor._detect_location("Work on Pipe Rack B tier 2") == "Pipe Rack B"

    def test_rack_b_short(self):
        assert DocumentExtractor._detect_location("Spool on Rack B") == "Pipe Rack B"

    def test_cdu_area(self):
        assert DocumentExtractor._detect_location("CDU column footing") == "CDU Area 100"

    def test_area_100(self):
        assert DocumentExtractor._detect_location("Work in Area 100") == "CDU Area 100"

    def test_compressor_house(self):
        assert DocumentExtractor._detect_location("Rebar at Compressor House") == "Compressor House"

    def test_no_location(self):
        assert DocumentExtractor._detect_location("General maintenance") is None


# =============================================================================
# Text Extraction (Full Pipeline) Tests
# =============================================================================

class TestTextExtraction:
    """Tests for extract_from_text end-to-end pipeline."""

    def test_basic_daily_report(self):
        project_id = uuid4()
        text = """
        DAILY CONSTRUCTION REPORT
        Date: 2026-08-15
        1. Spool erection complete on Pipe Rack B Tier 2 (100% finished).
        2. Concrete pour for column footing COL-FTG-100 started, 45 cu.m poured.
        3. Heavy rain delayed civil work by 4 hours.
        """
        observations = DocumentExtractor.extract_from_text(text, project_id)
        assert len(observations) >= 3

    def test_filters_header_lines(self):
        project_id = uuid4()
        text = """
        Page 1
        Project: PKG-04
        Date: 2026-08-15
        Contractor: ABC Corp
        Report No. 42
        Spool erection completed on Rack B.
        """
        observations = DocumentExtractor.extract_from_text(text, project_id)
        # Should filter headers, only extract the observation
        assert len(observations) == 1
        assert observations[0].discipline == DisciplineEnum.PIPING

    def test_filters_short_lines(self):
        project_id = uuid4()
        text = "OK\nYes\nSpool erection on Pipe Rack B complete.\nNo"
        observations = DocumentExtractor.extract_from_text(text, project_id)
        assert len(observations) == 1

    def test_empty_text_returns_empty(self):
        observations = DocumentExtractor.extract_from_text("", uuid4())
        assert observations == []

    def test_whitespace_only_returns_empty(self):
        observations = DocumentExtractor.extract_from_text("   \n  \n  ", uuid4())
        assert observations == []

    def test_observation_has_project_id(self):
        project_id = uuid4()
        obs = DocumentExtractor.extract_from_text("Cable tray installation at Area 100", project_id)
        assert len(obs) == 1
        assert obs[0].project_id == project_id

    def test_observation_has_normalized_text(self):
        obs = DocumentExtractor.extract_from_text("Hydro test on P-101 passed", uuid4())
        assert len(obs) == 1
        assert obs[0].normalized_text is not None
        assert len(obs[0].normalized_text) > 0

    def test_observation_has_confidence(self):
        obs = DocumentExtractor.extract_from_text("Rebar tying complete at compressor house", uuid4())
        assert len(obs) == 1
        assert obs[0].extraction_confidence == 0.95

    def test_multi_discipline_report(self):
        project_id = uuid4()
        text = """
        1. Piping spool erection on Rack B - 80% complete.
        2. Cable tray laying in substation - ongoing.
        3. Transmitter calibration for PT-101 - finished.
        4. Safety audit conducted in Zone 1.
        """
        observations = DocumentExtractor.extract_from_text(text, project_id)
        disciplines = {obs.discipline for obs in observations}
        assert DisciplineEnum.PIPING in disciplines
        assert DisciplineEnum.ELECTRICAL in disciplines
        assert DisciplineEnum.INSTRUMENTATION in disciplines
        assert DisciplineEnum.HSE in disciplines

    def test_document_id_propagated(self):
        project_id = uuid4()
        doc_id = uuid4()
        obs = DocumentExtractor.extract_from_text("Concrete pour started", project_id, doc_id)
        assert len(obs) == 1
        assert obs[0].document_id == doc_id

    def test_progress_extracted_from_text(self):
        obs = DocumentExtractor.extract_from_text("Spool work at 65% on Pipe Rack B", uuid4())
        assert len(obs) == 1
        assert obs[0].reported_progress == 65.0
