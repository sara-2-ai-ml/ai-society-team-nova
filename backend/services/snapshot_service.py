"""A small, pre-computed summary of the data, given to the agent with every question.

Most questions ("how many this month?", "who has the most delays?") can then be answered in one
model call, without tool calls: faster, and the numbers are the verified ones.
"""

from collections.abc import Mapping
from datetime import date, timedelta
from typing import Any

import pandas as pd

from backend.services.budget_service import calculate_latest_budget
from backend.services.kpi_service import calculate_kpis
from backend.services.overdue_service import calculate_open_overdue
from backend.services.recurring_service import calculate_recurring_issues, calculate_recurring_summary
from backend.services.sla_service import calculate_overall_sla, calculate_sla_by_directorate


def _count_by(frame: pd.DataFrame, column: str, top: int | None = None) -> dict[str, int]:
    counts = frame[column].fillna("pa caktuar").value_counts()
    return {str(k): int(v) for k, v in (counts.head(top) if top else counts).items()}


def build_snapshot(datasets: Mapping[str, pd.DataFrame], today: date | None = None) -> dict[str, Any]:
    day = today or date.today()
    requests = datasets["requests"]
    registered = requests["Data e regjistrimit"]
    # Up to today, like the dashboard's "this month" (the dataset also holds a few later-dated rows).
    this_month = requests[(registered.dt.strftime("%Y-%m") == day.strftime("%Y-%m")) & (registered <= pd.Timestamp(day))]
    this_week = requests[(registered > pd.Timestamp(day - timedelta(days=7))) & (registered <= pd.Timestamp(day))]
    overdue = calculate_open_overdue(requests, day)

    return {
        "today": day.isoformat(),
        "all_time": calculate_kpis(requests),
        "this_month": {
            "month": day.strftime("%Y-%m"),
            "requests": int(len(this_month)),
            "by_directorate": _count_by(this_month, "Drejtoria"),
            "by_category": _count_by(this_month, "Kategoria", 5),
            "by_area": _count_by(this_month, "Lagjja / Fshati"),
        },
        "last_7_days": {"requests": int(len(this_week)), "by_directorate": _count_by(this_week, "Drejtoria")},
        "overdue_open_today": {
            "total": overdue["overdue_open_requests"],
            "open_total": overdue["open_requests"],
            "by_directorate": {r["name"]: r["overdue"] for r in overdue["by_directorate"]},
            "by_category": {r["name"]: r["overdue"] for r in overdue["by_category"][:5]},
            "by_area": {r["name"]: r["overdue"] for r in overdue["by_area"][:5]},
            "oldest": overdue["oldest"][:3],
        },
        "resolved_on_time": {
            "overall": calculate_overall_sla(requests),
            "by_directorate": calculate_sla_by_directorate(requests),
        },
        "recurring": {
            "summary": calculate_recurring_summary(requests),
            "top_places": [
                {k: issue[k] for k in ("area", "location", "category", "total_reports")}
                for issue in sorted(calculate_recurring_issues(requests), key=lambda i: -i["total_reports"])[:3]
            ],
        },
        "latest_budget": calculate_latest_budget(datasets["budget"]),
    }
