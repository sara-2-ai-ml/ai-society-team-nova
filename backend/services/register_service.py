"""Export the cleaned requests as plain records for the main app's request register."""

from collections.abc import Mapping
from typing import Any

import pandas as pd


def _day(value: Any) -> str | None:
    return None if pd.isna(value) else pd.Timestamp(value).strftime("%Y-%m-%d")


def _text(value: Any) -> str | None:
    return None if pd.isna(value) else str(value)


def get_register(
    datasets: Mapping[str, pd.DataFrame], categories: pd.DataFrame
) -> list[dict[str, Any]]:
    """One record per request, oldest first.

    Requests not yet assigned (status "E re", no directorate) get the directorate of their
    category, the same one the operator would send them to.
    """
    category_directorate = {
        str(row["Kategoria"]).strip(): str(row["Drejtoria"]).strip()
        for _, row in categories.iterrows()
        if not pd.isna(row["Kategoria"]) and not pd.isna(row["Drejtoria"])
    }
    requests = datasets["requests"].sort_values(["Data e regjistrimit", "ID"])

    records = []
    for _, row in requests.iterrows():
        category = _text(row["Kategoria"])
        directorate = _text(row["Drejtoria"]) or category_directorate.get(category or "")
        records.append({
            "id": _text(row["ID"]),
            "date": _day(row["Data e regjistrimit"]),
            "channel": _text(row["Kanali"]),
            "area": _text(row["Lagjja / Fshati"]),
            "place": _text(row["Vendi"]),
            "category": category,
            "description": _text(row["Përshkrimi"]),
            "registered_by": _text(row["Regjistruar nga"]),
            "directorate": directorate,
            "assigned": not pd.isna(row["Drejtoria"]),
            "assigned_at": _day(row["Data e caktimit"]),
            # Unassigned requests have no deadline yet: registration day + the category's days.
            "deadline": _day(row["Data_limit_clean"])
            or _day(row["Data e regjistrimit"] + pd.Timedelta(days=int(row["Afati_i_pritur"]))),
            "status": _text(row["Statusi"]),
            "resolved_at": _day(row["Data e zgjidhjes"]),
            "note": _text(row["Shënim i përgjegjësit"]),
        })
    return records
