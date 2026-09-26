"""Financial analytics based on the preprocessed budget dataset."""

import pandas as pd


BUDGET_FIELDS = (
    "month",
    "directorate",
    "directorate_name",
    "budget_allocated_all",
    "actual_spend_all",
    "committed_spend_all",
    "execution_pct",
)


def calculate_budget(
    budget: pd.DataFrame,
    *,
    directorate: str | None = None,
    month: str | None = None,
) -> list[dict[str, str | int | float]]:
    """Return API-safe monthly financial records with optional filters."""
    filtered = budget
    if directorate is not None:
        filtered = filtered[filtered["directorate"].eq(directorate)]
    if month is not None:
        filtered = filtered[filtered["month"].astype("string").eq(month)]

    filtered = filtered.sort_values(["month", "directorate"], kind="stable")
    return [
        {
            "month": str(row.month),
            "directorate": str(row.directorate),
            "directorate_name": str(row.directorate_name),
            "budget_allocated_all": float(row.budget_allocated_all),
            "actual_spend_all": float(row.actual_spend_all),
            "committed_spend_all": float(row.committed_spend_all),
            "execution_pct": round(float(row.execution_pct), 2),
        }
        for row in filtered.loc[:, BUDGET_FIELDS].itertuples(index=False)
    ]


def calculate_latest_budget(
    budget: pd.DataFrame,
    *,
    directorate: str | None = None,
) -> list[dict[str, str | int | float]]:
    """Return the latest available monthly record for each directorate."""
    records = calculate_budget(budget, directorate=directorate)
    latest: dict[str, dict[str, str | int | float]] = {}
    for record in records:
        latest[str(record["directorate"])] = record
    return [latest[key] for key in sorted(latest)]
