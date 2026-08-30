from uuid import uuid4

import fitz
import pytest

from app.models.schemas import DisciplineEnum, EventTypeEnum
from app.services.extractor import DocumentExtractor


@pytest.fixture
def sample_pdf_bytes():
    doc = fitz.open()
    page = doc.new_page()
    content = (
        "NEXORA AI Daily Construction Report\n"
        "Project: Paradip-Hyderabad Expansion Package 04\n"
        "P-101 completed successfully with 42.5 bar hydro test pressure holding.\n"
        "Rebar cutting, bending and shuttering for Main Gas Compressor C-101 foundation completed 100%.\n"
        "concreting finished for heavy column footings C1-C12 in CDU area, 180 cu.m poured.\n"
    )
    page.insert_text((50, 72), content)
    pdf_data = doc.write()
    doc.close()
    return pdf_data


def test_pdf_extraction_observations(sample_pdf_bytes):
    project_id = uuid4()
    document_id = uuid4()

    observations = DocumentExtractor.extract_from_pdf_bytes(
        content=sample_pdf_bytes, project_id=project_id, document_id=document_id
    )

    assert len(observations) == 3
    # Check PIP-101 observation
    p101_obs = next((o for o in observations if "p-101" in o.raw_text.lower()), None)
    assert p101_obs is not None
    assert p101_obs.discipline == DisciplineEnum.PIPING
    assert p101_obs.event_type == EventTypeEnum.FINISH

    # Check compressor foundation observation
    comp_obs = next((o for o in observations if "c-101" in o.raw_text.lower()), None)
    assert comp_obs is not None
    assert comp_obs.discipline == DisciplineEnum.CIVIL
    assert comp_obs.reported_progress == 100.0

    # Check CDU concrete observation
    cdu_obs = next((o for o in observations if "cdu" in o.raw_text.lower()), None)
    assert cdu_obs is not None
    assert cdu_obs.discipline == DisciplineEnum.CIVIL
    assert cdu_obs.reported_quantity == 180.0
    assert cdu_obs.unit_of_measure == "Cu.M"
