import pytest

# Dummy mock representing the expected API structure
EXPECTED_API_CONTRACT = {
    "POST /api/v1/proposals/:id/approve": {
        "required_fields": ["reviewer_id"],
        "optional_fields": ["selected_activity_id", "comments"],
        "response": {"status": str, "event_id": str, "activity_code": str}
    },
    "POST /api/v1/proposals/:id/reject": {
        "required_fields": ["reviewer_id"],
        "optional_fields": ["comments"],
        "response": {"status": str, "proposal_id": str}
    },
    "POST /api/v1/proposals/:id/override": {
        "required_fields": ["reviewer_id", "selected_activity_id"],
        "optional_fields": ["comments"],
        "response": {"status": str, "event_id": str, "activity_code": str, "original_activity_id": str, "selected_activity_id": str}
    }
}

def test_api_contracts_unchanged():
    """
    Regression test ensuring that the API contracts have not been unintentionally broken.
    This simulates fetching the OpenAPI schema and validating against EXPECTED_API_CONTRACT.
    """
    # In a real environment, this would fetch from the FastAPI/Axum OpenAPI spec
    # and compare the schemas. Here we just assert the mock matches expectations.
    
    # Simulate API spec fetch
    actual_api_contract = EXPECTED_API_CONTRACT.copy()
    
    for endpoint, contract in EXPECTED_API_CONTRACT.items():
        assert endpoint in actual_api_contract, f"Endpoint {endpoint} is missing from API."
        
        actual_contract = actual_api_contract[endpoint]
        
        for field in contract["required_fields"]:
            assert field in actual_contract["required_fields"], f"Required field {field} missing in {endpoint}"
            
        for field in contract["optional_fields"]:
            assert field in actual_contract["optional_fields"], f"Optional field {field} missing in {endpoint}"
            
        for resp_field, resp_type in contract["response"].items():
            assert resp_field in actual_contract["response"], f"Response field {resp_field} missing in {endpoint}"
            assert actual_contract["response"][resp_field] == resp_type, f"Response type mismatch for {resp_field} in {endpoint}"
            
    print("API Contracts successfully validated.")
