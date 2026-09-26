import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.kpi_service import calculate_kpis, get_kpis


EXPECTED_KEYS = {
    "total_requests",
    "active_requests",
    "resolved_requests",
    "resolution_rate_pct",
    "avg_resolution_days",
    "sla_compliance_pct",
    "recurring_requests",
}


@pytest.fixture(scope="module")
def real_kpis() -> dict[str, int | float]:
    return get_kpis()


def test_real_dataset_kpi_structure_and_types(real_kpis):
    assert set(real_kpis) == EXPECTED_KEYS
    for field in (
        "total_requests", "active_requests", "resolved_requests",
        "recurring_requests",
    ):
        assert isinstance(real_kpis[field], int)
    for field in (
        "resolution_rate_pct", "avg_resolution_days", "sla_compliance_pct",
    ):
        assert isinstance(real_kpis[field], float)


def test_real_dataset_matches_notebook_kpis(real_kpis):
    assert real_kpis["total_requests"] == 556
    assert real_kpis["active_requests"] == 74
    assert real_kpis["resolved_requests"] == 482
    assert real_kpis["resolution_rate_pct"] == pytest.approx(86.69)
    assert real_kpis["avg_resolution_days"] == pytest.approx(4.90)
    assert real_kpis["sla_compliance_pct"] == pytest.approx(87.34)
    assert real_kpis["recurring_requests"] == 24


def test_calculate_kpis_with_synthetic_requests():
    requests = pd.DataFrame({
        "Statusi": ["E zgjidhur", "E zgjidhur", "Në proces", "E re"],
        "Dite_trajtimi_clean": pd.Series([2, 4, pd.NA, pd.NA], dtype="Int64"),
        "Brenda_afatit_clean": pd.Series([True, False, pd.NA, pd.NA], dtype="boolean"),
        "Is_recurring": [True, False, True, False],
    })

    assert calculate_kpis(requests) == {
        "total_requests": 4,
        "active_requests": 2,
        "resolved_requests": 2,
        "resolution_rate_pct": 50.0,
        "avg_resolution_days": 3.0,
        "sla_compliance_pct": 50.0,
        "recurring_requests": 2,
    }


def test_calculate_kpis_handles_empty_requests():
    empty = pd.DataFrame({
        "Statusi": pd.Series(dtype="string"),
        "Dite_trajtimi_clean": pd.Series(dtype="Int64"),
        "Brenda_afatit_clean": pd.Series(dtype="boolean"),
        "Is_recurring": pd.Series(dtype="boolean"),
    })

    assert calculate_kpis(empty) == {
        "total_requests": 0,
        "active_requests": 0,
        "resolved_requests": 0,
        "resolution_rate_pct": 0.0,
        "avg_resolution_days": 0.0,
        "sla_compliance_pct": 0.0,
        "recurring_requests": 0,
    }


def test_health_endpoint_returns_ok():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_kpi_endpoint_returns_all_fields():
    response = TestClient(app).get("/api/kpis")
    assert response.status_code == 200
    assert set(response.json()) == EXPECTED_KEYS
