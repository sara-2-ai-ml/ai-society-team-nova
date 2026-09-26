import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.sla_service import (
    calculate_overall_sla,
    calculate_sla_by_area,
    calculate_sla_by_directorate,
    calculate_sla_by_month,
)


@pytest.fixture(scope="module")
def requests():
    return get_dataset()["requests"]


def test_overall_sla_matches_notebook(requests):
    result = calculate_overall_sla(requests)
    assert result["within_sla"] == 421
    assert result["outside_sla"] == 61
    assert result["sla_compliance_pct"] == pytest.approx(87.34)


def test_monthly_sla_matches_notebook(requests):
    result = calculate_sla_by_month(requests)
    assert len(result) == 4
    september = next(row for row in result if row["month"] == "2026-09")
    assert september["resolved_requests"] == 134
    assert september["sla_compliance_pct"] == pytest.approx(70.90)


def test_directorate_sla_matches_notebook(requests):
    result = {row["directorate"]: row for row in calculate_sla_by_directorate(requests)}
    assert result["DI"]["sla_compliance_pct"] == pytest.approx(89.22)
    assert result["DSHP"]["sla_compliance_pct"] == pytest.approx(85.97)


def test_area_sla_matches_notebook(requests):
    result = {row["area"]: row for row in calculate_sla_by_area(requests)}
    assert result["Lagjja nr. 3"]["sla_compliance_pct"] == pytest.approx(75.74)


def test_empty_sla_is_safe():
    empty = pd.DataFrame({
        "Statusi": pd.Series(dtype="string"),
        "Brenda_afatit_clean": pd.Series(dtype="boolean"),
        "Muaji": pd.Series(dtype="period[M]"),
        "Drejtoria": pd.Series(dtype="string"),
        "Lagjja / Fshati": pd.Series(dtype="string"),
    })
    assert calculate_overall_sla(empty) == {
        "within_sla": 0, "outside_sla": 0, "sla_compliance_pct": 0.0,
    }
    assert calculate_sla_by_month(empty) == []


@pytest.mark.parametrize(
    "path,required_fields",
    (
        ("/api/sla/overall", {"within_sla", "outside_sla", "sla_compliance_pct"}),
        ("/api/sla/by-month", {"month", "resolved_requests", "within_sla", "outside_sla", "sla_compliance_pct"}),
        ("/api/sla/by-directorate", {"directorate", "resolved_requests", "within_sla", "outside_sla", "sla_compliance_pct"}),
        ("/api/sla/by-area", {"area", "resolved_requests", "within_sla", "outside_sla", "sla_compliance_pct"}),
    ),
)
def test_sla_endpoints(path, required_fields):
    response = TestClient(app).get(path)
    assert response.status_code == 200
    payload = response.json()
    first = payload[0] if isinstance(payload, list) else payload
    assert set(first) == required_fields
