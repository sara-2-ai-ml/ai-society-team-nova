import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.insight_service import get_insights


@pytest.fixture(scope="module")
def insights():
    return get_insights(get_dataset())


def test_default_insights_exclude_low_and_include_medium_high(insights):
    assert insights
    assert {row["priority"] for row in insights} == {"Medium", "High"}


def test_insight_structure(insights):
    required = {
        "area", "directorate", "priority", "signal_count", "triggered_signals",
        "evidence", "finding", "recommended_next_step", "financial_context",
    }
    assert all(set(row) == required for row in insights)


def test_priority_specific_wording(insights):
    high = next(row for row in insights if row["priority"] == "High")
    medium = next(row for row in insights if row["priority"] == "Medium")
    assert "significant deterioration" in high["finding"]
    assert "emerging operational pressure" in medium["finding"]


def test_recommendations_are_investigative_and_non_causal(insights):
    dshp = next(row for row in insights if row["directorate"] == "DSHP")
    di = next(row for row in insights if row["directorate"] == "DI")
    for term in ("missed collections", "delays", "vehicle availability"):
        assert term in dshp["recommended_next_step"]
    for term in ("open incidents", "repair delays", "drainage"):
        assert term in di["recommended_next_step"]
    assert all("caused by" not in str(row).lower() for row in insights)


def test_financial_context_is_directorate_level(insights):
    assert all(
        row["financial_context"] is None
        or row["financial_context"]["scope"] == "directorate"
        for row in insights
    )


def test_insight_filters():
    result = get_insights(
        get_dataset(), directorate="DSHP", area="Lagjja nr. 3", priority="High"
    )
    assert len(result) == 1
    assert result[0]["area"] == "Lagjja nr. 3"


def test_insight_api_and_filters():
    client = TestClient(app)
    response = client.get("/api/insights")
    assert response.status_code == 200
    assert all(row["priority"] != "Low" for row in response.json())
    filtered = client.get(
        "/api/insights", params={"directorate": "DI", "priority": "High"}
    )
    assert filtered.status_code == 200
    assert filtered.json()
    assert all(row["directorate"] == "DI" for row in filtered.json())
