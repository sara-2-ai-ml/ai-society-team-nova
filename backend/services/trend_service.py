"""Request trend calculations based on the cleaned requests dataset."""

import pandas as pd


def _filter_requests(
    requests: pd.DataFrame,
    *,
    area: str | None = None,
    directorate: str | None = None,
    month: str | None = None,
) -> pd.DataFrame:
    filtered = requests
    if area is not None:
        filtered = filtered[filtered["Lagjja / Fshati"].eq(area)]
    if directorate is not None:
        filtered = filtered[filtered["Drejtoria"].eq(directorate)]
    if month is not None:
        filtered = filtered[filtered["Muaji"].astype("string").eq(month)]
    return filtered


def calculate_monthly_trend(
    requests: pd.DataFrame,
    *,
    area: str | None = None,
    directorate: str | None = None,
) -> list[dict[str, str | int]]:
    filtered = _filter_requests(requests, area=area, directorate=directorate)
    grouped = filtered.groupby("Muaji", dropna=True).size().sort_index()
    return [
        {"month": str(month), "requests": int(count)}
        for month, count in grouped.items()
    ]


def calculate_area_trend(
    requests: pd.DataFrame,
    *,
    area: str | None = None,
    directorate: str | None = None,
    month: str | None = None,
) -> list[dict[str, str | int]]:
    filtered = _filter_requests(
        requests, area=area, directorate=directorate, month=month
    )
    grouped = (
        filtered.dropna(subset=["Muaji", "Lagjja / Fshati"])
        .groupby(["Muaji", "Lagjja / Fshati"])
        .size()
        .sort_index()
    )
    return [
        {"month": str(period), "area": str(group_area), "requests": int(count)}
        for (period, group_area), count in grouped.items()
    ]


def calculate_directorate_trend(
    requests: pd.DataFrame,
    *,
    area: str | None = None,
    directorate: str | None = None,
    month: str | None = None,
) -> list[dict[str, str | int]]:
    filtered = _filter_requests(
        requests, area=area, directorate=directorate, month=month
    )
    grouped = (
        filtered.dropna(subset=["Muaji", "Drejtoria"])
        .groupby(["Muaji", "Drejtoria"])
        .size()
        .sort_index()
    )
    return [
        {
            "month": str(period),
            "directorate": str(group_directorate),
            "requests": int(count),
        }
        for (period, group_directorate), count in grouped.items()
    ]
