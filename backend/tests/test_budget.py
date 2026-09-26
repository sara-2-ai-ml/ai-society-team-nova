import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.budget_service import calculate_budget, calculate_latest_budget


@pytest.fixture(scope="module")
def budget():
    return get_dataset()["budget"]


def test_budget_records_have_expected_dimensions(budget):
    result = calculate_budget(budget)
    assert len(result) == 8
    assert {row["month"] for row in result} == {
        "2026-06", "2026-07", "2026-08", "2026-09",
    }
    assert {row["directorate"] for row in result} == {"DSHP", "DI"}


def test_september_budget_matches_notebook(budget):
    result = {
        row["directorate"]: row
        for row in calculate_budget(budget, month="2026-09")
    }
    assert result["DSHP"]["execution_pct"] == pytest.approx(102.29)
    assert result["DI"]["execution_pct"] == pytest.approx(76.96)


def test_budget_filters(budget):
    dshp = calculate_budget(budget, directorate="DSHP")
    september = calculate_budget(budget, month="2026-09")
    combined = calculate_budget(budget, directorate="DI", month="2026-09")
    assert len(dshp) == 4 and all(row["directorate"] == "DSHP" for row in dshp)
    assert len(september) == 2 and all(row["month"] == "2026-09" for row in september)
    assert len(combined) == 1


def test_latest_budget_has_one_row_per_directorate(budget):
    result = calculate_latest_budget(budget)
    assert len(result) == 2
    assert {row["directorate"] for row in result} == {"DSHP", "DI"}
    assert all(row["month"] == "2026-09" for row in result)


def test_budget_output_fields(budget):
    required = {
        "month", "directorate", "directorate_name", "budget_allocated_all",
        "actual_spend_all", "committed_spend_all", "execution_pct",
    }
    assert all(set(row) == required for row in calculate_budget(budget))


def test_budget_endpoint_returns_http_200():
    response = TestClient(app).get("/api/budget")
    assert response.status_code == 200
    assert len(response.json()) == 8


def test_latest_budget_endpoint_returns_current_rows():
    response = TestClient(app).get("/api/budget/latest")
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert all(row["month"] == "2026-09" for row in response.json())


def test_filtered_budget_endpoint():
    response = TestClient(app).get(
        "/api/budget", params={"directorate": "DI", "month": "2026-09"}
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
