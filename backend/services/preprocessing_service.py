"""Convert validated Bashkia 360 workbook sheets into trusted datasets."""

from collections.abc import Mapping, Sequence

import pandas as pd

from backend.data.loader import load_workbook


CleanDatasets = dict[str, pd.DataFrame]

REQUEST_TEXT_COLUMNS = (
    "ID", "Kanali", "Njësia (kodi)", "Njësia administrative",
    "Lagjja / Fshati", "Vendi", "Kategoria", "Përshkrimi",
    "Regjistruar nga", "Drejtoria", "Përgjegjësi", "Statusi",
    "Shënim i përgjegjësit", "Recurring group",
)

REQUEST_OUTPUT_COLUMNS = (
    "ID", "Data e regjistrimit", "Kanali", "Njësia (kodi)",
    "Njësia administrative", "Lagjja / Fshati", "Vendi", "Kategoria",
    "Përshkrimi", "Regjistruar nga", "Drejtoria", "Përgjegjësi",
    "Data e caktimit", "Afati_i_pritur", "Data_limit_clean", "Statusi",
    "Data e zgjidhjes", "Shënim i përgjegjësit", "Dite_trajtimi_clean",
    "Brenda_afatit_clean", "Recurring group", "Is_recurring", "Muaji",
)


def _clean_text_columns(data: pd.DataFrame, columns: Sequence[str]) -> None:
    """Normalize text in-place on a dataframe that is already a safe copy."""
    for column in columns:
        data[column] = data[column].astype("string").str.strip().replace("", pd.NA)


def _to_numeric(data: pd.DataFrame, columns: Sequence[str], dataset: str) -> None:
    for column in columns:
        converted = pd.to_numeric(data[column], errors="coerce")
        invalid = converted.isna()
        if invalid.any():
            raise ValueError(
                f"{dataset}: column '{column}' contains "
                f"{int(invalid.sum())} missing or non-numeric value(s)."
            )
        data[column] = converted


def _raise_if_invalid(mask: pd.Series, dataset: str, message: str) -> None:
    invalid_count = int(mask.fillna(True).sum())
    if invalid_count:
        raise ValueError(f"{dataset}: {message} ({invalid_count} invalid row(s)).")


def _clean_requests(workbook: Mapping[str, pd.DataFrame]) -> pd.DataFrame:
    requests = workbook["Kerkesat"].copy(deep=True)
    categories = workbook["Kategorite"].copy(deep=True)

    _clean_text_columns(requests, REQUEST_TEXT_COLUMNS)
    _clean_text_columns(categories, ("Kategoria",))

    date_columns = (
        "Data e regjistrimit", "Data e caktimit", "Data e zgjidhjes"
    )
    for column in date_columns:
        requests[column] = pd.to_datetime(requests[column], errors="coerce")

    category_sla = (
        categories.dropna(subset=["Kategoria"])
        .drop_duplicates(subset=["Kategoria"], keep="last")
        .set_index("Kategoria")["Afati (ditë)"]
    )
    category_sla = pd.to_numeric(category_sla, errors="coerce")
    requests["Afati_i_pritur"] = requests["Kategoria"].map(category_sla)
    requests["Data_limit_clean"] = requests["Data e caktimit"] + pd.to_timedelta(
        requests["Afati_i_pritur"], unit="D"
    )

    resolved = requests["Statusi"].eq("E zgjidhur")
    resolution_days = (
        requests["Data e zgjidhjes"] - requests["Data e regjistrimit"]
    ).dt.days
    requests["Dite_trajtimi_clean"] = resolution_days.where(resolved).astype("Int64")

    evaluable = (
        resolved
        & requests["Data e zgjidhjes"].notna()
        & requests["Data_limit_clean"].notna()
    )
    within_sla = pd.Series(pd.NA, index=requests.index, dtype="boolean")
    within_sla.loc[evaluable] = (
        requests.loc[evaluable, "Data e zgjidhjes"]
        <= requests.loc[evaluable, "Data_limit_clean"]
    )
    requests["Brenda_afatit_clean"] = within_sla
    requests["Muaji"] = requests["Data e regjistrimit"].dt.to_period("M")
    requests["Is_recurring"] = requests["Recurring group"].notna()

    return (
        requests.loc[:, REQUEST_OUTPUT_COLUMNS]
        .sort_values(["Data e regjistrimit", "ID"], kind="stable")
        .reset_index(drop=True)
    )


def _clean_waste(raw: pd.DataFrame) -> pd.DataFrame:
    waste = raw.copy(deep=True).rename(columns={
        "Data": "date",
        "Njësia (kodi)": "unit_code",
        "Njësia administrative": "administrative_unit",
        "Lagjja / Fshati": "area",
        "Drejtoria": "directorate",
        "Mbledhje planifikuara": "scheduled_collections",
        "Mbledhje realizuara": "completed_collections",
        "Mbledhje të humbura": "missed_collections",
        "Vonesa mesatare (orë)": "avg_delay_hours",
        "Disponueshmëri mjetesh %": "vehicle_availability_pct",
    })
    waste["date"] = pd.to_datetime(waste["date"], errors="coerce")
    _raise_if_invalid(waste["date"].isna(), "Waste operations", "date must not be missing")
    _clean_text_columns(
        waste, ("unit_code", "administrative_unit", "area", "directorate")
    )
    numeric = (
        "scheduled_collections", "completed_collections", "missed_collections",
        "avg_delay_hours", "vehicle_availability_pct",
    )
    _to_numeric(waste, numeric, "Waste operations")
    for column in numeric[:-1]:
        _raise_if_invalid(
            waste[column] < 0, "Waste operations", f"'{column}' must be >= 0"
        )
    _raise_if_invalid(
        waste["completed_collections"] > waste["scheduled_collections"],
        "Waste operations", "completed collections cannot exceed scheduled collections",
    )
    _raise_if_invalid(
        waste["missed_collections"] > waste["scheduled_collections"],
        "Waste operations", "missed collections cannot exceed scheduled collections",
    )
    _raise_if_invalid(
        ~waste["vehicle_availability_pct"].between(0, 100),
        "Waste operations", "vehicle availability must be between 0 and 100",
    )
    waste["month"] = waste["date"].dt.to_period("M")
    return waste.sort_values(
        ["date", "administrative_unit", "area"], kind="stable"
    ).reset_index(drop=True)


def _clean_roads(raw: pd.DataFrame) -> pd.DataFrame:
    roads = raw.copy(deep=True).rename(columns={
        "Muaji": "month_date",
        "Njësia (kodi)": "unit_code",
        "Njësia administrative": "administrative_unit",
        "Lagjja / Fshati": "area",
        "Drejtoria": "directorate",
        "Incidente të raportuara": "reported_incidents",
        "Incidente të hapura": "open_incidents",
        "Ditë mesatare riparimi": "avg_repair_days",
        "Raste kullimi": "drainage_cases",
        "Ndërhyrje urgjente": "emergency_repairs",
    })
    roads["month_date"] = pd.to_datetime(roads["month_date"], errors="coerce")
    _raise_if_invalid(
        roads["month_date"].isna(), "Road operations", "month_date must not be missing"
    )
    _clean_text_columns(
        roads, ("unit_code", "administrative_unit", "area", "directorate")
    )
    numeric = (
        "reported_incidents", "open_incidents", "avg_repair_days",
        "drainage_cases", "emergency_repairs",
    )
    _to_numeric(roads, numeric, "Road operations")
    for column in numeric:
        _raise_if_invalid(
            roads[column] < 0, "Road operations", f"'{column}' must be >= 0"
        )
    _raise_if_invalid(
        roads["open_incidents"] > roads["reported_incidents"],
        "Road operations", "open incidents cannot exceed reported incidents",
    )
    roads["month"] = roads["month_date"].dt.to_period("M")
    return roads.sort_values(
        ["month_date", "administrative_unit", "area"], kind="stable"
    ).reset_index(drop=True)


def _clean_budget(raw: pd.DataFrame) -> pd.DataFrame:
    budget = raw.copy(deep=True).rename(columns={
        "Muaji": "month_date",
        "Kodi drejtoria": "directorate",
        "Drejtoria": "directorate_name",
        "Buxheti planifikuar ALL": "budget_allocated_all",
        "Shpenzimi real ALL": "actual_spend_all",
        "Shpenzimi angazhuar ALL": "committed_spend_all",
        "Realizimi %": "execution_pct_excel",
    })
    budget["month_date"] = pd.to_datetime(budget["month_date"], errors="coerce")
    _raise_if_invalid(
        budget["month_date"].isna(), "Budget", "month_date must not be missing"
    )
    _clean_text_columns(budget, ("directorate", "directorate_name"))
    numeric = ("budget_allocated_all", "actual_spend_all", "committed_spend_all")
    _to_numeric(budget, numeric, "Budget")
    _raise_if_invalid(
        budget["budget_allocated_all"] <= 0,
        "Budget", "budget_allocated_all must be > 0",
    )
    for column in ("actual_spend_all", "committed_spend_all"):
        _raise_if_invalid(budget[column] < 0, "Budget", f"'{column}' must be >= 0")
    budget["month"] = budget["month_date"].dt.to_period("M")
    budget["execution_pct"] = (
        budget["actual_spend_all"] / budget["budget_allocated_all"] * 100
    ).round(2)
    output_columns = (
        "month_date", "month", "directorate", "directorate_name",
        "budget_allocated_all", "actual_spend_all", "committed_spend_all",
        "execution_pct",
    )
    return (
        budget.loc[:, output_columns]
        .sort_values(["month_date", "directorate"], kind="stable")
        .reset_index(drop=True)
    )


def get_clean_datasets(
    workbook: Mapping[str, pd.DataFrame] | None = None,
) -> CleanDatasets:
    """Return clean requests, waste, roads, and budget datasets."""
    raw = load_workbook() if workbook is None else workbook
    return {
        "requests": _clean_requests(raw),
        "waste": _clean_waste(raw["Operacione_Mbetje"]),
        "roads": _clean_roads(raw["Operacione_Rruge"]),
        "budget": _clean_budget(raw["Buxhet_Finance"]),
    }
