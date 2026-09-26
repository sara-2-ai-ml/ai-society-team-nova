"""Validation rules for the Bashkia 360 Excel workbook."""

from collections.abc import Collection, Mapping
from pathlib import Path

import pandas as pd


REQUIRED_SHEETS: tuple[str, ...] = (
    "Njesite", "Drejtorite", "Kategorite", "Perdoruesit", "Kerkesat",
    "Operacione_Mbetje", "Operacione_Rruge", "Buxhet_Finance",
)

REQUIRED_COLUMNS: dict[str, frozenset[str]] = {
    "Kerkesat": frozenset({
        "ID", "Data e regjistrimit", "Kanali", "Njësia (kodi)",
        "Njësia administrative", "Lagjja / Fshati", "Vendi", "Kategoria",
        "Përshkrimi", "Regjistruar nga", "Drejtoria", "Përgjegjësi",
        "Data e caktimit", "Afati (ditë)", "Data limit", "Statusi",
        "Data e zgjidhjes", "Shënim i përgjegjësit", "Ditë trajtimi",
        "Brenda afatit?", "Recurring group",
    }),
    "Operacione_Mbetje": frozenset({
        "Data", "Njësia (kodi)", "Njësia administrative", "Lagjja / Fshati",
        "Drejtoria", "Mbledhje planifikuara", "Mbledhje realizuara",
        "Mbledhje të humbura", "Vonesa mesatare (orë)",
        "Disponueshmëri mjetesh %",
    }),
    "Operacione_Rruge": frozenset({
        "Muaji", "Njësia (kodi)", "Njësia administrative", "Lagjja / Fshati",
        "Drejtoria", "Incidente të raportuara", "Incidente të hapura",
        "Ditë mesatare riparimi", "Raste kullimi", "Ndërhyrje urgjente",
    }),
    "Buxhet_Finance": frozenset({
        "Muaji", "Kodi drejtoria", "Drejtoria", "Buxheti planifikuar ALL",
        "Shpenzimi real ALL", "Shpenzimi angazhuar ALL", "Realizimi %",
    }),
}


def validate_workbook_path(path: str | Path) -> Path:
    """Return a resolved workbook path, or raise if it is not a file."""
    workbook_path = Path(path).expanduser().resolve()
    if not workbook_path.is_file():
        raise FileNotFoundError(
            f"Bashkia 360 workbook was not found at: {workbook_path}"
        )
    return workbook_path


def validate_required_sheets(available_sheets: Collection[str]) -> None:
    """Ensure that every sheet required by the backend is present."""
    missing_sheets = sorted(set(REQUIRED_SHEETS) - set(available_sheets))
    if missing_sheets:
        raise ValueError(
            "Bashkia 360 workbook is missing required sheet(s): "
            + ", ".join(missing_sheets)
        )


def validate_required_columns(sheets: Mapping[str, pd.DataFrame]) -> None:
    """Ensure that each operational sheet contains its required columns."""
    for sheet_name, required_columns in REQUIRED_COLUMNS.items():
        if sheet_name not in sheets:
            raise ValueError(
                f"Cannot validate columns because sheet '{sheet_name}' is missing."
            )

        missing_columns = sorted(required_columns - set(sheets[sheet_name].columns))
        if missing_columns:
            raise ValueError(
                f"Sheet '{sheet_name}' is missing required column(s): "
                + ", ".join(missing_columns)
            )


def validate_dataframe(
    data: pd.DataFrame, required_columns: Collection[str] | None = None
) -> None:
    """Validate one dataframe for backward compatibility with the scaffold."""
    if data.empty:
        raise ValueError("Dataset is empty.")

    missing_columns = sorted(set(required_columns or ()) - set(data.columns))
    if missing_columns:
        raise ValueError(
            "Dataset is missing required column(s): " + ", ".join(missing_columns)
        )
