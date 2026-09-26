"""Deterministic cross-source priority detection for Bashkia 360."""

from collections.abc import Mapping

import pandas as pd

from backend.services.budget_service import calculate_budget
from backend.services.operations_service import (
    calculate_roads_monthly,
    calculate_waste_monthly,
)
from backend.services.trend_service import calculate_area_trend


BASE_MONTH = "2026-08"
CURRENT_MONTH = "2026-09"
COMPARISON_PERIOD = f"{BASE_MONTH} → {CURRENT_MONTH}"


def priority_from_signals(signal_count: int) -> str:
    if signal_count >= 4:
        return "High"
    if signal_count >= 2:
        return "Medium"
    return "Low"


def _percentage_change(previous: float | None, current: float | None) -> float | None:
    """Return percentage change, or None when comparison is not meaningful."""
    if previous is None or current is None or previous == 0:
        return None
    return round((current - previous) / previous * 100, 2)


def _records_by_area(records: list[dict], month: str) -> dict[str, dict]:
    return {str(row["area"]): row for row in records if row["month"] == month}


def _request_records(requests: pd.DataFrame, directorate: str) -> list[dict]:
    records = calculate_area_trend(requests, directorate=directorate)
    return [
        {"month": row["month"], "area": row["area"], "citizen_requests": row["requests"]}
        for row in records
    ]


def _value(record: dict | None, field: str) -> float | None:
    return None if record is None else float(record[field])


def get_dshp_priorities(
    datasets: Mapping[str, pd.DataFrame],
) -> list[dict]:
    """Combine DSHP requests, waste operations, and directorate budget context."""
    requests = _request_records(datasets["requests"], "DSHP")
    # Preserve full aggregate precision until final growth values are rounded,
    # matching the notebook. API waste responses remain rounded by default.
    waste = calculate_waste_monthly(datasets["waste"], round_averages=False)
    budget = calculate_budget(
        datasets["budget"], directorate="DSHP", month=CURRENT_MONTH
    )
    budget_record = budget[0] if budget else None
    budget_execution = (
        float(budget_record["execution_pct"]) if budget_record else None
    )
    budget_pressure = budget_execution is not None and budget_execution >= 100
    financial_context = (
        {
            "scope": "directorate",
            "month": CURRENT_MONTH,
            "execution_pct": budget_execution,
            "budget_pressure": budget_pressure,
        }
        if budget_record
        else None
    )

    req_aug = _records_by_area(requests, BASE_MONTH)
    req_sep = _records_by_area(requests, CURRENT_MONTH)
    waste_aug = _records_by_area(waste, BASE_MONTH)
    waste_sep = _records_by_area(waste, CURRENT_MONTH)
    areas = sorted(set(req_aug) | set(req_sep) | set(waste_aug) | set(waste_sep))

    results = []
    for area in areas:
        aug_request, sep_request = req_aug.get(area), req_sep.get(area)
        aug_waste, sep_waste = waste_aug.get(area), waste_sep.get(area)
        request_growth = _percentage_change(
            _value(aug_request, "citizen_requests"),
            _value(sep_request, "citizen_requests"),
        )
        missed_growth = _percentage_change(
            _value(aug_waste, "missed_collections"),
            _value(sep_waste, "missed_collections"),
        )
        delay_growth = _percentage_change(
            _value(aug_waste, "avg_delay_hours"),
            _value(sep_waste, "avg_delay_hours"),
        )
        aug_vehicle = _value(aug_waste, "vehicle_availability_pct")
        sep_vehicle = _value(sep_waste, "vehicle_availability_pct")
        vehicle_change = (
            round(sep_vehicle - aug_vehicle, 2)
            if aug_vehicle is not None and sep_vehicle is not None
            else None
        )

        signal_checks = (
            ("request_growth", request_growth is not None and request_growth > 20),
            ("missed_collections_growth", missed_growth is not None and missed_growth > 20),
            ("delay_growth", delay_growth is not None and delay_growth > 20),
            ("vehicle_availability_drop", vehicle_change is not None and vehicle_change < -5),
            ("directorate_budget_pressure", budget_pressure),
        )
        triggered = [name for name, active in signal_checks if active]
        signal_count = len(triggered)
        results.append({
            "area": area,
            "directorate": "DSHP",
            "comparison_period": COMPARISON_PERIOD,
            "request_growth_pct": request_growth,
            "missed_growth_pct": missed_growth,
            "delay_growth_pct": delay_growth,
            "vehicle_change_pp": vehicle_change,
            "budget_execution_pct": budget_execution,
            "budget_pressure": budget_pressure,
            "signal_count": signal_count,
            "priority": priority_from_signals(signal_count),
            "triggered_signals": triggered,
            "financial_context": financial_context,
        })
    return results


def get_di_priorities(datasets: Mapping[str, pd.DataFrame]) -> list[dict]:
    """Combine DI citizen demand and road operational performance."""
    requests = _request_records(datasets["requests"], "DI")
    roads = calculate_roads_monthly(datasets["roads"])
    budget = calculate_budget(
        datasets["budget"], directorate="DI", month=CURRENT_MONTH
    )
    financial_context = (
        {
            "scope": "directorate",
            "month": CURRENT_MONTH,
            "execution_pct": float(budget[0]["execution_pct"]),
            "budget_pressure": float(budget[0]["execution_pct"]) >= 100,
        }
        if budget
        else None
    )

    req_aug = _records_by_area(requests, BASE_MONTH)
    req_sep = _records_by_area(requests, CURRENT_MONTH)
    roads_aug = _records_by_area(roads, BASE_MONTH)
    roads_sep = _records_by_area(roads, CURRENT_MONTH)
    areas = sorted(set(req_aug) | set(req_sep) | set(roads_aug) | set(roads_sep))
    metric_fields = (
        ("reported_incidents_growth_pct", "reported_incidents", "reported_incidents_growth"),
        ("open_incidents_growth_pct", "open_incidents", "open_incidents_growth"),
        ("repair_time_growth_pct", "avg_repair_days", "repair_time_growth"),
        ("drainage_growth_pct", "drainage_cases", "drainage_growth"),
    )

    results = []
    for area in areas:
        aug_request, sep_request = req_aug.get(area), req_sep.get(area)
        aug_roads, sep_roads = roads_aug.get(area), roads_sep.get(area)
        metrics: dict[str, float | None] = {
            "request_growth_pct": _percentage_change(
                _value(aug_request, "citizen_requests"),
                _value(sep_request, "citizen_requests"),
            )
        }
        for output, source, _ in metric_fields:
            metrics[output] = _percentage_change(
                _value(aug_roads, source), _value(sep_roads, source)
            )

        signal_checks = [
            (
                "request_growth",
                metrics["request_growth_pct"] is not None
                and metrics["request_growth_pct"] > 20,
            )
        ]
        signal_checks.extend(
            (
                signal_name,
                metrics[output] is not None and metrics[output] > 20,
            )
            for output, _, signal_name in metric_fields
        )
        triggered = [name for name, active in signal_checks if active]
        signal_count = len(triggered)
        results.append({
            "area": area,
            "directorate": "DI",
            "comparison_period": COMPARISON_PERIOD,
            **metrics,
            "signal_count": signal_count,
            "priority": priority_from_signals(signal_count),
            "triggered_signals": triggered,
            "financial_context": financial_context,
        })
    return results


def get_priorities(
    datasets: Mapping[str, pd.DataFrame],
    *,
    directorate: str | None = None,
    area: str | None = None,
    priority: str | None = None,
) -> list[dict]:
    """Return combined DSHP and DI priorities with optional exact filters."""
    records = get_dshp_priorities(datasets) + get_di_priorities(datasets)
    if directorate is not None:
        records = [row for row in records if row["directorate"] == directorate]
    if area is not None:
        records = [row for row in records if row["area"] == area]
    if priority is not None:
        records = [row for row in records if row["priority"] == priority]
    return records
