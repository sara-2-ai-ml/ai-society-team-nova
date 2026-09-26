"""Limit the Bashkia 360 datasets to one directorate.

The main app (NestJS) signs users in with roles. When a directorate user asks the assistant,
the agent only receives that directorate's rows, so it cannot reveal another directorate's data
whatever the model asks for.
"""

from collections.abc import Mapping

import pandas as pd


DIRECTORATE_COLUMNS = {
    "requests": "Drejtoria",
    "waste": "directorate",
    "roads": "directorate",
    "budget": "directorate",
}


def with_category_directorate(requests: pd.DataFrame) -> pd.DataFrame:
    """Give not-yet-assigned requests the directorate of their category.

    The main app's dashboard counts them that way (they wait at the unit they will go to), so the
    assistant does the same and both show the same numbers.
    """
    missing = requests["Drejtoria"].isna()
    if not missing.any():
        return requests
    by_category = requests[~missing].groupby("Kategoria")["Drejtoria"].agg(lambda s: s.mode().iat[0])
    filled = requests.copy()
    filled.loc[missing, "Drejtoria"] = filled.loc[missing, "Kategoria"].map(by_category)
    return filled


def scope_datasets(
    datasets: Mapping[str, pd.DataFrame], directorate: str | None
) -> dict[str, pd.DataFrame]:
    """Requests with every directorate filled in; then, with `directorate`, only its rows."""
    scoped = dict(datasets)
    scoped["requests"] = with_category_directorate(datasets["requests"])
    if directorate is None:
        return scoped
    for name, column in DIRECTORATE_COLUMNS.items():
        frame = scoped[name]
        scoped[name] = frame[frame[column].eq(directorate)].copy()
    return scoped
