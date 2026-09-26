import re

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.operations_service import (
    calculate_roads_monthly,
    calculate_waste_monthly,
)


@pytest.fixture(scope="module")
def datasets():
    return get_dataset()


def test_waste_analytics_shape(datasets):
    result = calculate_waste_monthly(datasets["waste"])
    required = {
        "month", "area", "scheduled_collections", "completed_collections",
        "missed_collections", "avg_delay_hours", "vehicle_availability_pct",
    }
    assert result
    assert all(set(row) == required for row in result)
    assert all(re.fullmatch(r"\d{4}-\d{2}", row["month"]) for row in result)


def test_road_analytics_shape(datasets):
    result = calculate_roads_monthly(datasets["roads"])
    required = {
        "month", "area", "reported_incidents", "open_incidents",
        "avg_repair_days", "drainage_cases", "emergency_repairs",
    }
    assert result
    assert all(set(row) == required for row in result)
    assert all(re.fullmatch(r"\d{4}-\d{2}", row["month"]) for row in result)


def test_waste_filters(datasets):
    by_area = calculate_waste_monthly(datasets["waste"], area="Lagjja nr. 3")
    by_month = calculate_waste_monthly(datasets["waste"], month="2026-09")
    assert by_area and all(row["area"] == "Lagjja nr. 3" for row in by_area)
    assert by_month and all(row["month"] == "2026-09" for row in by_month)


def test_road_filters_and_known_september_value(datasets):
    result = calculate_roads_monthly(
        datasets["roads"], area="Lagjja nr. 5", month="2026-09"
    )
    assert result == [{
        "month": "2026-09",
        "area": "Lagjja nr. 5",
        "reported_incidents": 28,
        "open_incidents": 12,
        "avg_repair_days": 9.4,
        "drainage_cases": 13,
        "emergency_repairs": 7,
    }]


@pytest.mark.parametrize("path", ("/api/operations/waste", "/api/operations/roads"))
def test_operation_endpoints(path):
    response = TestClient(app).get(path)
    assert response.status_code == 200
    assert response.json()


@pytest.mark.parametrize(
    "path,params",
    (
        ("/api/operations/waste", {"area": "Lagjja nr. 3"}),
        ("/api/operations/waste", {"month": "2026-09"}),
        ("/api/operations/roads", {"area": "Lagjja nr. 5", "month": "2026-09"}),
    ),
)
def test_filtered_operation_endpoints(path, params):
    response = TestClient(app).get(path, params=params)
    assert response.status_code == 200
    assert response.json()
