import pandas as pd
import pytest

from backend.services.preprocessing_service import (
    _clean_budget,
    _clean_roads,
    _clean_waste,
    get_clean_datasets,
)


@pytest.fixture(scope="module")
def clean_datasets() -> dict[str, pd.DataFrame]:
    return get_clean_datasets()


def test_clean_datasets_are_returned_as_non_empty_dataframes(clean_datasets):
    assert isinstance(clean_datasets, dict)
    assert set(clean_datasets) == {"requests", "waste", "roads", "budget"}
    assert all(isinstance(frame, pd.DataFrame) for frame in clean_datasets.values())
    assert all(not frame.empty for frame in clean_datasets.values())


def test_requests_have_required_derived_columns(clean_datasets):
    required = {
        "Afati_i_pritur", "Data_limit_clean", "Dite_trajtimi_clean",
        "Brenda_afatit_clean", "Muaji", "Is_recurring",
    }
    assert required.issubset(clean_datasets["requests"].columns)


def test_resolved_and_unresolved_request_durations(clean_datasets):
    requests = clean_datasets["requests"]
    resolved = requests[requests["Statusi"].eq("E zgjidhur")]
    unresolved = requests[~requests["Statusi"].eq("E zgjidhur")]
    assert resolved["Dite_trajtimi_clean"].notna().all()
    assert unresolved["Dite_trajtimi_clean"].isna().all()


def test_request_deadline_is_assignment_date_plus_sla(clean_datasets):
    requests = clean_datasets["requests"].dropna(
        subset=["Data e caktimit", "Afati_i_pritur"]
    )
    expected = requests["Data e caktimit"] + pd.to_timedelta(
        requests["Afati_i_pritur"], unit="D"
    )
    pd.testing.assert_series_equal(
        requests["Data_limit_clean"], expected, check_names=False
    )


def test_recurring_flag_matches_recurring_group(clean_datasets):
    requests = clean_datasets["requests"]
    pd.testing.assert_series_equal(
        requests["Is_recurring"], requests["Recurring group"].notna(),
        check_names=False,
    )


def test_waste_output_columns(clean_datasets):
    required = {
        "date", "month", "scheduled_collections", "completed_collections",
        "missed_collections", "avg_delay_hours", "vehicle_availability_pct",
    }
    assert required.issubset(clean_datasets["waste"].columns)


def test_roads_output_columns(clean_datasets):
    required = {
        "month_date", "month", "reported_incidents", "open_incidents",
        "avg_repair_days", "drainage_cases", "emergency_repairs",
    }
    assert required.issubset(clean_datasets["roads"].columns)


def test_budget_execution_is_recalculated(clean_datasets):
    budget = clean_datasets["budget"]
    expected = (
        budget["actual_spend_all"] / budget["budget_allocated_all"] * 100
    ).round(2)
    pd.testing.assert_series_equal(
        budget["execution_pct"], expected, check_names=False
    )


def test_invalid_waste_values_raise_clear_exception(clean_datasets):
    invalid = clean_datasets["waste"].head(1).rename(columns={
        "date": "Data", "unit_code": "Njësia (kodi)",
        "administrative_unit": "Njësia administrative", "area": "Lagjja / Fshati",
        "directorate": "Drejtoria", "scheduled_collections": "Mbledhje planifikuara",
        "completed_collections": "Mbledhje realizuara",
        "missed_collections": "Mbledhje të humbura",
        "avg_delay_hours": "Vonesa mesatare (orë)",
        "vehicle_availability_pct": "Disponueshmëri mjetesh %",
    }).drop(columns=["month"])
    invalid["Mbledhje realizuara"] = invalid["Mbledhje planifikuara"] + 1
    with pytest.raises(ValueError, match="completed collections"):
        _clean_waste(invalid)


def test_invalid_road_values_raise_clear_exception(clean_datasets):
    invalid = clean_datasets["roads"].head(1).rename(columns={
        "month_date": "Muaji", "unit_code": "Njësia (kodi)",
        "administrative_unit": "Njësia administrative", "area": "Lagjja / Fshati",
        "directorate": "Drejtoria", "reported_incidents": "Incidente të raportuara",
        "open_incidents": "Incidente të hapura",
        "avg_repair_days": "Ditë mesatare riparimi",
        "drainage_cases": "Raste kullimi", "emergency_repairs": "Ndërhyrje urgjente",
    }).drop(columns=["month"])
    invalid["Incidente të hapura"] = invalid["Incidente të raportuara"] + 1
    with pytest.raises(ValueError, match="open incidents"):
        _clean_roads(invalid)


def test_invalid_budget_values_raise_clear_exception(clean_datasets):
    budget = clean_datasets["budget"].head(1)
    invalid = pd.DataFrame({
        "Muaji": budget["month_date"],
        "Kodi drejtoria": budget["directorate"],
        "Drejtoria": budget["directorate_name"],
        "Buxheti planifikuar ALL": [0],
        "Shpenzimi real ALL": budget["actual_spend_all"],
        "Shpenzimi angazhuar ALL": budget["committed_spend_all"],
        "Realizimi %": [pd.NA],
    })
    with pytest.raises(ValueError, match="budget_allocated_all must be > 0"):
        _clean_budget(invalid)
