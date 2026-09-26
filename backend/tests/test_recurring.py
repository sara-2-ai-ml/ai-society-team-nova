import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.recurring_service import (
    calculate_recurring_issues,
    calculate_recurring_summary,
)


@pytest.fixture(scope="module")
def requests():
    return get_dataset()["requests"]


def test_recurring_summary_matches_notebook(requests):
    assert calculate_recurring_summary(requests) == {
        "recurring_requests": 24,
        "recurring_issue_groups": 4,
        "areas_affected": 3,
    }


def test_recurring_output_and_rec_001(requests):
    result = calculate_recurring_issues(requests)
    required = {
        "recurring_group", "area", "location", "category", "total_reports",
        "resolved_reports", "resolved_pct", "first_report", "last_report",
    }
    assert all(set(row) == required for row in result)
    rec_001 = next(row for row in result if row["recurring_group"] == "REC-001")
    assert rec_001["total_reports"] == 6
    assert rec_001["resolved_reports"] == 6
    assert rec_001["resolved_pct"] == pytest.approx(100.0)


def test_recurring_area_filter(requests):
    result = calculate_recurring_issues(requests, area="Bradashesh")
    assert result
    assert all(row["area"] == "Bradashesh" for row in result)


def test_recurring_endpoints_return_http_200():
    client = TestClient(app)
    issues = client.get("/api/recurring")
    summary = client.get("/api/recurring/summary")
    assert issues.status_code == 200
    assert summary.status_code == 200
    assert summary.json()["recurring_requests"] == 24


def test_recurring_endpoint_area_filter():
    response = TestClient(app).get(
        "/api/recurring", params={"area": "Bradashesh"}
    )
    assert response.status_code == 200
    assert response.json()
    assert all(row["area"] == "Bradashesh" for row in response.json())
