"""Evidence-based recurring issue analytics for Closed != Solved."""

import pandas as pd


RESOLVED_STATUS = "E zgjidhur"


def calculate_recurring_issues(
    requests: pd.DataFrame, *, area: str | None = None
) -> list[dict[str, str | int | float]]:
    recurring = requests[requests["Is_recurring"].eq(True)].copy()
    if area is not None:
        recurring = recurring[recurring["Lagjja / Fshati"].eq(area)]

    group_columns = ["Recurring group", "Lagjja / Fshati", "Vendi", "Kategoria"]
    records: list[dict[str, str | int | float]] = []
    for keys, group in recurring.groupby(group_columns, sort=True, dropna=False):
        recurring_group, group_area, location, category = keys
        total_reports = int(len(group))
        resolved_reports = int(group["Statusi"].eq(RESOLVED_STATUS).sum())
        records.append({
            "recurring_group": str(recurring_group),
            "area": str(group_area),
            "location": str(location),
            "category": str(category),
            "total_reports": total_reports,
            "resolved_reports": resolved_reports,
            "resolved_pct": round(resolved_reports / total_reports * 100, 2),
            "first_report": group["Data e regjistrimit"].min().strftime("%Y-%m-%d"),
            "last_report": group["Data e regjistrimit"].max().strftime("%Y-%m-%d"),
        })
    return records


def calculate_recurring_summary(requests: pd.DataFrame) -> dict[str, int]:
    recurring = requests[requests["Is_recurring"].eq(True)]
    return {
        "recurring_requests": int(len(recurring)),
        "recurring_issue_groups": int(recurring["Recurring group"].nunique()),
        "areas_affected": int(recurring["Lagjja / Fshati"].nunique()),
    }
