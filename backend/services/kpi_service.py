"""Core KPI calculations for the Bashkia 360 dashboard."""

from collections.abc import Mapping
from numbers import Number

import pandas as pd

from backend.services.preprocessing_service import get_clean_datasets


ACTIVE_STATUSES = frozenset({"E re", "E caktuar", "Në proces", "E ridrejtuar"})
RESOLVED_STATUS = "E zgjidhur"


def _rounded_or_zero(value: Number) -> float:
    """Return a finite KPI rounded to two decimals, or 0.0 when missing."""
    return 0.0 if pd.isna(value) else round(float(value), 2)


def calculate_kpis(requests: pd.DataFrame) -> dict[str, int | float]:
    """Calculate dashboard KPIs deterministically from clean requests."""
    total_requests = int(len(requests))
    active_requests = int(requests["Statusi"].isin(ACTIVE_STATUSES).sum())

    resolved_mask = requests["Statusi"].eq(RESOLVED_STATUS)
    resolved_requests = int(resolved_mask.sum())

    resolution_rate_pct = (
        resolved_requests / total_requests * 100 if total_requests else 0.0
    )

    resolved_durations = requests.loc[resolved_mask, "Dite_trajtimi_clean"].dropna()
    avg_resolution_days = (
        resolved_durations.mean() if not resolved_durations.empty else 0.0
    )

    valid_sla_results = requests.loc[resolved_mask, "Brenda_afatit_clean"].dropna()
    sla_compliance_pct = (
        valid_sla_results.eq(True).sum() / len(valid_sla_results) * 100
        if not valid_sla_results.empty
        else 0.0
    )

    recurring_requests = int(requests["Is_recurring"].eq(True).sum())

    return {
        "total_requests": total_requests,
        "active_requests": active_requests,
        "resolved_requests": resolved_requests,
        "resolution_rate_pct": _rounded_or_zero(resolution_rate_pct),
        "avg_resolution_days": _rounded_or_zero(avg_resolution_days),
        "sla_compliance_pct": _rounded_or_zero(sla_compliance_pct),
        "recurring_requests": recurring_requests,
    }


def get_kpis(
    datasets: Mapping[str, pd.DataFrame] | None = None,
) -> dict[str, int | float]:
    """Obtain clean requests and return their calculated KPI values.

    API callers pass the cached clean dataset dictionary. Direct callers can
    omit it, in which case the validated preprocessing pipeline is executed.
    """
    clean_datasets = get_clean_datasets() if datasets is None else datasets
    return calculate_kpis(clean_datasets["requests"])
