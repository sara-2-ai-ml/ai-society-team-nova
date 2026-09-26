"""Monthly waste and road operational analytics."""

import pandas as pd


def _filter_operations(
    data: pd.DataFrame,
    *,
    area: str | None = None,
    month: str | None = None,
) -> pd.DataFrame:
    filtered = data
    if area is not None:
        filtered = filtered[filtered["area"].eq(area)]
    if month is not None:
        filtered = filtered[filtered["month"].astype("string").eq(month)]
    return filtered


def calculate_waste_monthly(
    waste: pd.DataFrame,
    *,
    area: str | None = None,
    month: str | None = None,
    round_averages: bool = True,
) -> list[dict[str, str | int | float]]:
    """Aggregate waste operations by month and area."""
    filtered = _filter_operations(waste, area=area, month=month)
    grouped = (
        filtered.dropna(subset=["month", "area"])
        .groupby(["month", "area"], as_index=False)
        .agg(
            scheduled_collections=("scheduled_collections", "sum"),
            completed_collections=("completed_collections", "sum"),
            missed_collections=("missed_collections", "sum"),
            avg_delay_hours=("avg_delay_hours", "mean"),
            vehicle_availability_pct=("vehicle_availability_pct", "mean"),
        )
        .sort_values(["month", "area"], kind="stable")
    )
    return [
        {
            "month": str(row.month),
            "area": str(row.area),
            "scheduled_collections": int(row.scheduled_collections),
            "completed_collections": int(row.completed_collections),
            "missed_collections": int(row.missed_collections),
            "avg_delay_hours": (
                round(float(row.avg_delay_hours), 2)
                if round_averages else float(row.avg_delay_hours)
            ),
            "vehicle_availability_pct": (
                round(float(row.vehicle_availability_pct), 2)
                if round_averages else float(row.vehicle_availability_pct)
            ),
        }
        for row in grouped.itertuples(index=False)
    ]


def calculate_roads_monthly(
    roads: pd.DataFrame,
    *,
    area: str | None = None,
    month: str | None = None,
) -> list[dict[str, str | int | float]]:
    """Aggregate road operations by month and area."""
    filtered = _filter_operations(roads, area=area, month=month)
    grouped = (
        filtered.dropna(subset=["month", "area"])
        .groupby(["month", "area"], as_index=False)
        .agg(
            reported_incidents=("reported_incidents", "sum"),
            open_incidents=("open_incidents", "sum"),
            avg_repair_days=("avg_repair_days", "mean"),
            drainage_cases=("drainage_cases", "sum"),
            emergency_repairs=("emergency_repairs", "sum"),
        )
        .sort_values(["month", "area"], kind="stable")
    )
    return [
        {
            "month": str(row.month),
            "area": str(row.area),
            "reported_incidents": int(row.reported_incidents),
            "open_incidents": int(row.open_incidents),
            "avg_repair_days": round(float(row.avg_repair_days), 2),
            "drainage_cases": int(row.drainage_cases),
            "emergency_repairs": int(row.emergency_repairs),
        }
        for row in grouped.itertuples(index=False)
    ]
