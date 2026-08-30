import pytest
from unittest.mock import patch, MagicMock
from uuid import uuid4
from datetime import date

# AI Service Components
from app.models.schemas import (
    DisciplineEnum,
    ScheduleActivity,
    NormalizedObservation,
    MatchTierEnum
)
from app.services.extractor import DocumentExtractor
from app.services.matcher import HybridMatcher

# Rust API mock endpoints (for E2E validation)
class MockRustBackend:
    def __init__(self):
        self.proposals = {}
        self.approvals = []
        self.audit_trail = []
        self.events = []
    
    def receive_proposal(self, proposal):
        self.proposals[proposal.id] = proposal
        self.audit_trail.append({"action": "PROPOSAL_CREATED", "proposal_id": proposal.id})
        return {"status": "success", "proposal_id": proposal.id}
        
    def approve_proposal(self, proposal_id, reviewer_id, comments=""):
        if proposal_id in self.proposals:
            prop = self.proposals[proposal_id]
            self.approvals.append({"proposal_id": proposal_id, "action": "APPROVE", "reviewer_id": reviewer_id})
            self.events.append({"activity_id": prop.activity_id, "event_type": "PROGRESS", "status": "COMMITTED"})
            self.audit_trail.append({"action": "PROPOSAL_APPROVED", "proposal_id": proposal_id, "comments": comments})
            return {"status": "APPROVED"}
        return {"status": "NOT_FOUND"}
        
    def reject_proposal(self, proposal_id, reviewer_id, reason=""):
        if proposal_id in self.proposals:
            self.approvals.append({"proposal_id": proposal_id, "action": "REJECT", "reviewer_id": reviewer_id, "reason": reason})
            self.audit_trail.append({"action": "PROPOSAL_REJECTED", "proposal_id": proposal_id, "reason": reason})
            return {"status": "REJECTED"}
        return {"status": "NOT_FOUND"}

@pytest.fixture
def mock_backend():
    return MockRustBackend()

@pytest.fixture
def project_activities():
    return [
        ScheduleActivity(
            id=uuid4(),
            project_id=uuid4(),
            code="CIV-100",
            name="Excavation",
            discipline=DisciplineEnum.CIVIL,
            planned_start_date=date(2026, 9, 1),
            planned_finish_date=date(2026, 9, 5)
        ),
        ScheduleActivity(
            id=uuid4(),
            project_id=uuid4(),
            code="CIV-101",
            name="Foundation Pour",
            discipline=DisciplineEnum.CIVIL,
            planned_start_date=date(2026, 9, 6),
            planned_finish_date=date(2026, 9, 10)
        )
    ]

def test_e2e_lifecycle_approval_flow(mock_backend, project_activities):
    """
    E2E Test: Upload -> Extract -> Normalize -> Match -> Review -> Approve -> Commit
    """
    # 1. Upload & Extract
    extractor = DocumentExtractor()
    raw_text = "Completed excavation for the main building today."
    # Simulate extraction yielding an observation
    observation = NormalizedObservation(
        id=str(uuid4()),
        project_id=str(project_activities[0].project_id),
        raw_text=raw_text,
        normalized_text="excavation completed",
        discipline=DisciplineEnum.CIVIL,
        reported_by="site-supervisor"
    )
    
    # 2. Match
    matcher = HybridMatcher()
    proposals = matcher.match(observation, project_activities)
    assert len(proposals) > 0
    
    top_proposal = proposals[0]
    # Expect it matched CIV-100 (Excavation)
    assert top_proposal.activity_id == project_activities[0].id
    
    # 3. Submit to Rust Backend (Pending Review)
    res = mock_backend.receive_proposal(top_proposal)
    assert res["status"] == "success"
    
    # 4. Planner Reviews and Approves
    reviewer_id = str(uuid4())
    approve_res = mock_backend.approve_proposal(top_proposal.id, reviewer_id, comments="Looks good")
    assert approve_res["status"] == "APPROVED"
    
    # 5. Validate Event Output and Audit Trail
    assert len(mock_backend.events) == 1
    assert mock_backend.events[0]["activity_id"] == project_activities[0].id
    assert mock_backend.events[0]["status"] == "COMMITTED"
    
    # Audit trail should have creation and approval
    audit_actions = [a["action"] for a in mock_backend.audit_trail]
    assert "PROPOSAL_CREATED" in audit_actions
    assert "PROPOSAL_APPROVED" in audit_actions

def test_e2e_lifecycle_rejection_flow(mock_backend, project_activities):
    """
    E2E Test: Upload -> Extract -> Match -> Review -> Reject
    """
    raw_text = "Delivered concrete to site." # Too vague
    observation = NormalizedObservation(
        id=str(uuid4()),
        project_id=str(project_activities[1].project_id),
        raw_text=raw_text,
        normalized_text="concrete delivered",
        discipline=DisciplineEnum.CIVIL,
        reported_by="site-supervisor"
    )
    
    matcher = HybridMatcher()
    proposals = matcher.match(observation, project_activities)
    
    # Submit top proposal (even if low confidence)
    top_proposal = proposals[0]
    mock_backend.receive_proposal(top_proposal)
    
    # Planner Rejects
    reviewer_id = str(uuid4())
    reject_res = mock_backend.reject_proposal(top_proposal.id, reviewer_id, reason="Not an actual progress event, just delivery")
    assert reject_res["status"] == "REJECTED"
    
    # Validate no events created, but audit trail is updated
    assert len(mock_backend.events) == 0
    assert len(mock_backend.approvals) == 1
    assert mock_backend.approvals[0]["action"] == "REJECT"
    assert mock_backend.audit_trail[-1]["action"] == "PROPOSAL_REJECTED"
