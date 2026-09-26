"""SLA performance calculations based on preprocessed request fields."""

from collections.abc import Callable

import pandas as pd


RESOLVED_STATUS = "E zgjidhur"


def _resolved_requests(requests: pd.DataFrame) -> pd.DataFrame:
    return requests[requests["Statusi"].eq(RESOLVED_STATUS)]


def _sla_metrics(group: pd.DataFrame) -> dict[str, int | float]:
    valid_results = group["Brenda_afatit_clean"].dropna()
    within_sla = int(valid_results.eq(True).sum())
    outside_sla = int(valid_results.eq(False).sum())
    compliance = (
        round(within_sla / len(valid_results) * 100, 2)
        if not valid_results.empty
        else 0.0
    )
    return {
        "resolved_requests": int(len(group)),
        "within_sla": within_sla,
        "outside_sla": outside_sla,
        "sla_compliance_pct": compliance,
    }


def calculate_overall_sla(requests: pd.DataFrame) -> dict[str, int | float]:
    metrics = _sla_metrics(_resolved_requests(requests))
    return {
        "within_sla": metrics["within_sla"],
        "outside_sla": metrics["outside_sla"],
        "sla_compliance_pct": metrics["sla_compliance_pct"],
    }


def _grouped_sla(
    requests: pd.DataFrame,
    source_column: str,
    output_column: str,
    serialize_key: Callable[[object], str] = str,
) -> list[dict[str, str | int | float]]:
    resolved = _resolved_requests(requests).dropna(subset=[source_column])
    records: list[dict[str, str | int | float]] = []
    for key, group in resolved.groupby(source_column, sort=True):
        records.append({output_column: serialize_key(key), **_sla_metrics(group)})
    return records


def calculate_sla_by_month(requests: pd.DataFrame) -> list[dict[str, str | int | float]]:
    return _grouped_sla(requests, "Muaji", "month")


def calculate_sla_by_directorate(
    requests: pd.DataFrame,
) -> list[dict[str, str | int | float]]:
    return _grouped_sla(requests, "Drejtoria", "directorate")


def calculate_sla_by_area(
    requests: pd.DataFrame,
) -> list[dict[str, str | int | float]]:
    return _grouped_sla(requests, "Lagjja / Fshati", "area")
