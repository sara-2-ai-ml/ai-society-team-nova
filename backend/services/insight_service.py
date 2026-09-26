"""Create deterministic decision-support insights from priority outputs."""

from collections.abc import Mapping, Sequence

import pandas as pd

from backend.services.priority_service import get_priorities


def _evidence(record: Mapping) -> dict[str, float | None]:
    if record["directorate"] == "DSHP":
        return {
            "request_growth_pct": record["request_growth_pct"],
            "missed_collections_growth_pct": record["missed_growth_pct"],
            "delay_growth_pct": record["delay_growth_pct"],
            "vehicle_availability_change_pp": record["vehicle_change_pp"],
        }
    return {
        "request_growth_pct": record["request_growth_pct"],
        "reported_incidents_growth_pct": record["reported_incidents_growth_pct"],
        "open_incidents_growth_pct": record["open_incidents_growth_pct"],
        "repair_time_growth_pct": record["repair_time_growth_pct"],
        "drainage_growth_pct": record["drainage_growth_pct"],
    }


def generate_structured_insights(
    priorities: Sequence[Mapping],
    *,
    directorate: str | None = None,
    area: str | None = None,
    priority: str | None = None,
) -> list[dict]:
    """Turn Medium/High priorities into non-causal decision-support records."""
    insights = []
    for record in priorities:
        if record["priority"] == "Low":
            continue
        if directorate is not None and record["directorate"] != directorate:
            continue
        if area is not None and record["area"] != area:
            continue
        if priority is not None and record["priority"] != priority:
            continue

        if record["priority"] == "High":
            finding = (
                f"{record['area']} shows significant deterioration in "
                f"{record['directorate']} performance based on multiple independent signals."
            )
        else:
            finding = (
                f"{record['area']} shows emerging operational pressure in "
                f"{record['directorate']} based on multiple signals."
            )

        recommendation = (
            "Review missed collections, service delays and vehicle availability "
            "before deciding on operational action."
            if record["directorate"] == "DSHP"
            else "Review open incidents, repair delays and drainage cases to "
            "identify the operational bottleneck."
        )
        insights.append({
            "area": record["area"],
            "directorate": record["directorate"],
            "priority": record["priority"],
            "signal_count": record["signal_count"],
            "triggered_signals": record["triggered_signals"],
            "evidence": _evidence(record),
            "finding": finding,
            "recommended_next_step": recommendation,
            "financial_context": record.get("financial_context"),
        })
    rank = {"High": 0, "Medium": 1}
    return sorted(
        insights,
        key=lambda row: (rank[row["priority"]], -row["signal_count"], row["directorate"], row["area"]),
    )


def get_insights(
    datasets: Mapping[str, pd.DataFrame],
    *,
    directorate: str | None = None,
    area: str | None = None,
    priority: str | None = None,
) -> list[dict]:
    priorities = get_priorities(datasets)
    return generate_structured_insights(
        priorities, directorate=directorate, area=area, priority=priority
    )
