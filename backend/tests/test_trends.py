import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.trend_service import (
    calculate_area_trend,
    calculate_directorate_trend,
    calculate_monthly_trend,
)


@pytest.fixture(scope="module")
def requests():
    return get_dataset()["requests"]


def test_monthly_trend_matches_notebook(requests):
    result = calculate_monthly_trend(requests)
    assert len(result) == 4
    assert sum(row["requests"] for row in result) == 556
    assert {row["month"]: row["requests"] for row in result} == {
        "2026-06": 107, "2026-07": 121, "2026-08": 136, "2026-09": 192,
    }
    assert all(isinstance(row["month"], str) for row in result)


def test_directorate_trend_excludes_missing_values(requests):
    result = calculate_directorate_trend(requests)
    assert result
    assert all(row["directorate"] for row in result)
    assert all(row["directorate"] != "<NA>" for row in result)


def test_area_trend_contains_expected_areas(requests):
    result = calculate_area_trend(requests)
    assert {row["area"] for row in result} == {
        "Bradashesh", "Lagjja nr. 2", "Lagjja nr. 3", "Lagjja nr. 5", "Papër",
    }


def test_trend_filters(requests):
    by_area = calculate_monthly_trend(requests, area="Bradashesh")
    assert sum(row["requests"] for row in by_area) == int(
        requests["Lagjja / Fshati"].eq("Bradashesh").sum()
    )
    september_di = calculate_directorate_trend(
        requests, month="2026-09", directorate="DI"
    )
    assert september_di == [
        {"month": "2026-09", "directorate": "DI", "requests": 83}
    ]


@pytest.mark.parametrize(
    "path",
    ("/api/trends/monthly", "/api/trends/by-area", "/api/trends/by-directorate"),
)
def test_trend_endpoints_return_http_200(path):
    response = TestClient(app).get(path)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_monthly_endpoint_filter_works():
    response = TestClient(app).get(
        "/api/trends/monthly", params={"directorate": "DI"}
    )
    assert response.status_code == 200
    assert sum(row["requests"] for row in response.json()) == 223
