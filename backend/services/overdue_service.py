"""Open requests that are past their deadline today (the dashboard's "me afat të kaluar")."""

from datetime import date
from typing import Any

import pandas as pd


CLOSED_STATUSES = {"E zgjidhur", "E ridrejtuar"}


def calculate_open_overdue(requests: pd.DataFrame, today: date | None = None) -> dict[str, Any]:
    """Count still-open requests whose deadline has passed, with the oldest ones listed.

    Unassigned requests have no deadline yet; theirs is the registration day plus the category's days.
    """
    day = pd.Timestamp(today or date.today())
    deadline = requests["Data_limit_clean"].fillna(
        requests["Data e regjistrimit"] + pd.to_timedelta(requests["Afati_i_pritur"], unit="D")
    )
    open_requests = ~requests["Statusi"].isin(CLOSED_STATUSES)
    late = requests[open_requests & (deadline < day)].assign(days_late=(day - deadline).dt.days)

    def counts(column: str) -> list[dict[str, Any]]:
        grouped = late.groupby(late[column].fillna("pa caktuar"), dropna=False).size()
        return [{"name": str(k), "overdue": int(v)} for k, v in grouped.sort_values(ascending=False).items()]

    oldest = late.sort_values("days_late", ascending=False).head(5)
    return {
        "as_of": day.strftime("%Y-%m-%d"),
        "open_requests": int(open_requests.sum()),
        "overdue_open_requests": int(len(late)),
        "by_directorate": counts("Drejtoria"),
        "by_category": counts("Kategoria"),
        "by_area": counts("Lagjja / Fshati"),
        "oldest": [
            {
                "id": str(row["ID"]),
                "category": str(row["Kategoria"]),
                "area": str(row["Lagjja / Fshati"]),
                "directorate": None if pd.isna(row["Drejtoria"]) else str(row["Drejtoria"]),
                "days_late": int(row["days_late"]),
            }
            for _, row in oldest.iterrows()
        ],
    }
