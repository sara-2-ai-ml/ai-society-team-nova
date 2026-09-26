import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.priority_service import (
    _percentage_change,
    get_priorities,
    priority_from_signals,
)


@pytest.fixture(scope="module")
def priorities():
    return get_priorities(get_dataset())


def _find(priorities, area, directorate):
    return next(
        row for row in priorities
        if row["area"] == area and row["directorate"] == directorate
    )


def test_priority_results_cover_both_directorates(priorities):
    assert {row["directorate"] for row in priorities} == {"DSHP", "DI"}
    required = {"area", "directorate", "priority", "signal_count", "triggered_signals"}
    assert all(required.issubset(row) for row in priorities)
    assert {row["priority"] for row in priorities} <= {"Low", "Medium", "High"}


@pytest.mark.parametrize(
    "area,directorate,expected_priority,expected_signals",
    (
        ("Lagjja nr. 3", "DSHP", "High", 5),
        ("Bradashesh", "DSHP", "High", 4),
        ("Lagjja nr. 5", "DSHP", "Medium", 2),
        ("Lagjja nr. 5", "DI", "High", 5),
        ("Bradashesh", "DI", "High", 5),
        ("Papër", "DI", "Low", 1),
    ),
)
def test_priority_levels_match_notebook(
    priorities, area, directorate, expected_priority, expected_signals
):
    result = _find(priorities, area, directorate)
    assert result["priority"] == expected_priority
    assert result["signal_count"] == expected_signals


def test_dshp_known_evidence(priorities):
    result = _find(priorities, "Lagjja nr. 3", "DSHP")
    assert result["request_growth_pct"] == pytest.approx(50.0)
    assert result["missed_growth_pct"] == pytest.approx(47.89)
    assert result["delay_growth_pct"] == pytest.approx(45.91)
    assert result["vehicle_change_pp"] == pytest.approx(-8.33)
    assert "directorate_budget_pressure" in result["triggered_signals"]
    assert result["financial_context"]["scope"] == "directorate"


def test_di_known_evidence(priorities):
    result = _find(priorities, "Lagjja nr. 5", "DI")
    assert result["request_growth_pct"] == pytest.approx(107.14)
    assert result["reported_incidents_growth_pct"] == pytest.approx(86.67)
    assert result["open_incidents_growth_pct"] == pytest.approx(140.0)
    assert result["repair_time_growth_pct"] == pytest.approx(44.62)
    assert result["drainage_growth_pct"] == pytest.approx(116.67)


def test_priority_filters():
    datasets = get_dataset()
    result = get_priorities(
        datasets, directorate="DI", area="Lagjja nr. 5", priority="High"
    )
    assert len(result) == 1
    assert result[0]["directorate"] == "DI"


def test_zero_denominator_and_priority_thresholds_are_safe():
    assert _percentage_change(0, 10) is None
    assert _percentage_change(None, 10) is None
    assert priority_from_signals(0) == "Low"
    assert priority_from_signals(2) == "Medium"
    assert priority_from_signals(4) == "High"


def test_missing_comparison_month_is_safe():
    datasets = {key: value.copy() for key, value in get_dataset().items()}
    datasets["roads"] = datasets["roads"][
        ~(
            datasets["roads"]["area"].eq("Papër")
            & datasets["roads"]["month"].astype("string").eq("2026-08")
        )
    ]
    result = _find(get_priorities(datasets), "Papër", "DI")
    assert result["reported_incidents_growth_pct"] is None


def test_priority_api_and_filters():
    client = TestClient(app)
    assert client.get("/api/priorities").status_code == 200
    filtered = client.get(
        "/api/priorities",
        params={"directorate": "DI", "priority": "High", "area": "Lagjja nr. 5"},
    )
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1
