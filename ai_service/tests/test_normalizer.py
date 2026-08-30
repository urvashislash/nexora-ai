"""
Comprehensive tests for the TerminologyNormalizer service.
Tests all terminology mappings, edge cases, and normalization behaviors.
"""

from app.models.schemas import DisciplineEnum
from app.services.normalizer import (
    DEFAULT_TERMINOLOGY_MAP,
    TerminologyNormalizer,
    default_normalizer,
)

# =============================================================================
# Piping Terminology Normalization
# =============================================================================


class TestPipingNormalization:
    """Tests for piping-related terminology normalization."""

    def test_spool_erection(self):
        result = default_normalizer.normalize("spool erection on rack B")
        assert "Spool Erection and Alignment" in result

    def test_spool_alignment(self):
        result = default_normalizer.normalize("spool alignment complete")
        assert "Spool Erection and Alignment" in result

    def test_pipe_erection(self):
        result = default_normalizer.normalize("pipe erection started")
        assert "Spool Erection and Alignment" in result

    def test_hydro_test(self):
        result = default_normalizer.normalize("hydro test passed")
        assert "Hydrostatic Testing" in result

    def test_hydrotest(self):
        result = default_normalizer.normalize("hydrotest completed")
        assert "Hydrostatic Testing" in result

    def test_hydro_testing(self):
        result = default_normalizer.normalize("hydro testing in progress")
        assert "Hydrostatic Testing" in result

    def test_pressure_test(self):
        result = default_normalizer.normalize("pressure test at 42 bar")
        assert "Hydrostatic Testing" in result

    def test_leak_test(self):
        result = default_normalizer.normalize("leak test completed on line")
        assert "Hydrostatic Testing" in result

    def test_p101_normalization(self):
        result = default_normalizer.normalize("work on p-101")
        assert "Line P-101" in result

    def test_p101_no_dash(self):
        result = default_normalizer.normalize("testing p 101 line")
        assert "Line P-101" in result

    def test_p101_compact(self):
        result = default_normalizer.normalize("p101 completed")
        assert "Line P-101" in result

    def test_p102_normalization(self):
        result = default_normalizer.normalize("p-102 spool installed")
        assert "Line P-102" in result


# =============================================================================
# Civil Terminology Normalization
# =============================================================================


class TestCivilNormalization:
    """Tests for civil-related terminology normalization."""

    def test_rebar(self):
        result = default_normalizer.normalize("rebar work done")
        assert "Rebar Tying and Shuttering" in result

    def test_rebar_tying(self):
        result = default_normalizer.normalize("rebar tying complete")
        assert "Rebar Tying and Shuttering" in result

    def test_reinforcement(self):
        result = default_normalizer.normalize("reinforcement work ongoing")
        assert "Rebar Tying and Shuttering" in result

    def test_shuttering(self):
        result = default_normalizer.normalize("shuttering erected")
        assert "Rebar Tying and Shuttering" in result

    def test_formwork(self):
        result = default_normalizer.normalize("formwork preparation")
        assert "Rebar Tying and Shuttering" in result

    def test_concrete_pour(self):
        result = default_normalizer.normalize("concrete pour for footing")
        assert "Concrete Pour" in result

    def test_concreting(self):
        result = default_normalizer.normalize("concreting started at area 100")
        assert "Concrete Pour" in result

    def test_excavation(self):
        result = default_normalizer.normalize("trench excavation in zone 2")
        assert "Trench Excavation and Backfilling" in result

    def test_backfilling(self):
        result = default_normalizer.normalize("backfilling completed")
        assert "Trench Excavation and Backfilling" in result


# =============================================================================
# Mechanical/Electrical/Instrumentation Normalization
# =============================================================================


class TestOtherDisciplineNormalization:
    def test_pump_alignment(self):
        result = default_normalizer.normalize("pump alignment in progress")
        assert "Equipment Alignment" in result

    def test_grouting(self):
        result = default_normalizer.normalize("grouting of base plate")
        assert "Equipment Alignment" in result

    def test_cable_tray(self):
        result = default_normalizer.normalize("cable tray routing")
        assert "Cable Tray Installation" in result

    def test_traying(self):
        result = default_normalizer.normalize("traying work at area 102")
        assert "Cable Tray Installation" in result

    def test_pt_calibration(self):
        result = default_normalizer.normalize("pt calibration completed")
        assert "Transmitter Calibration" in result

    def test_loop_check(self):
        result = default_normalizer.normalize("loop check for instruments")
        assert "Transmitter Calibration" in result


# =============================================================================
# Edge Cases
# =============================================================================


class TestNormalizerEdgeCases:
    def test_empty_string(self):
        assert default_normalizer.normalize("") == ""

    def test_whitespace_normalization(self):
        result = default_normalizer.normalize("  spool   erection   done  ")
        assert "  " not in result

    def test_percentage_spacing(self):
        result = default_normalizer.normalize("Progress at 75 %")
        assert "75%" in result

    def test_case_insensitive(self):
        result = default_normalizer.normalize("HYDRO TEST completed")
        assert "Hydrostatic Testing" in result

    def test_no_matching_terms(self):
        text = "General maintenance work in office area"
        result = default_normalizer.normalize(text)
        assert len(result) > 0

    def test_multiple_terms_in_one_line(self):
        result = default_normalizer.normalize("Piping team completed hydro test on p-101 yesterday.")
        assert "Hydrostatic Testing" in result
        assert "Line P-101" in result

    def test_custom_project_overrides(self):
        custom = TerminologyNormalizer(project_overrides={"site crane": "Mobile Crane MC-01"})
        result = custom.normalize("site crane moved to zone 3")
        assert "Mobile Crane MC-01" in result

    def test_custom_overrides_dont_break_defaults(self):
        custom = TerminologyNormalizer(project_overrides={"custom_term": "Custom Value"})
        result = custom.normalize("hydro test on p-101")
        assert "Hydrostatic Testing" in result
        assert "Line P-101" in result

    def test_default_terminology_map_is_populated(self):
        assert len(DEFAULT_TERMINOLOGY_MAP) > 20


# =============================================================================
# Integration with Discipline Context
# =============================================================================


class TestNormalizerWithDiscipline:
    def test_normalize_with_piping_context(self):
        result = default_normalizer.normalize("spool work done", DisciplineEnum.PIPING)
        assert len(result) > 0

    def test_normalize_with_civil_context(self):
        result = default_normalizer.normalize("footing work", DisciplineEnum.CIVIL)
        assert len(result) > 0

    def test_normalize_with_none_discipline(self):
        result = default_normalizer.normalize("general work", None)
        assert len(result) > 0
