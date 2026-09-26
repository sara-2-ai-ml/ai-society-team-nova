from pathlib import Path

import pandas as pd
import pytest

from backend.data.loader import DEFAULT_WORKBOOK_PATH, load_workbook
from backend.data.validators import (
    REQUIRED_COLUMNS,
    REQUIRED_SHEETS,
    validate_required_columns,
    validate_required_sheets,
    validate_workbook_path,
)


@pytest.fixture(scope="module")
def workbook_data() -> dict[str, pd.DataFrame]:
    return load_workbook()


def test_workbook_loads_successfully(
    workbook_data: dict[str, pd.DataFrame],
) -> None:
    assert isinstance(workbook_data, dict)


def test_all_required_sheets_are_returned(
    workbook_data: dict[str, pd.DataFrame],
) -> None:
    assert set(workbook_data) == set(REQUIRED_SHEETS)


@pytest.mark.parametrize(
    "sheet_name",
    ("Kerkesat", "Operacione_Mbetje", "Operacione_Rruge", "Buxhet_Finance"),
)
def test_main_operational_sheet_is_not_empty(
    workbook_data: dict[str, pd.DataFrame], sheet_name: str
) -> None:
    assert not workbook_data[sheet_name].empty


def test_default_workbook_path_points_to_source_file() -> None:
    assert DEFAULT_WORKBOOK_PATH == (
        Path(__file__).resolve().parents[2]
        / "data"
        / "raw"
        / "Bashkia_360_Data.xlsx"
    )
    assert DEFAULT_WORKBOOK_PATH.is_file()


def test_missing_workbook_raises_clear_error(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="workbook was not found"):
        validate_workbook_path(tmp_path / "missing.xlsx")


def test_missing_required_sheet_raises_clear_error() -> None:
    available_sheets = set(REQUIRED_SHEETS) - {"Kerkesat"}
    with pytest.raises(ValueError, match="Kerkesat"):
        validate_required_sheets(available_sheets)


def test_missing_required_column_raises_clear_error() -> None:
    valid_frames = {
        sheet_name: pd.DataFrame(columns=list(required_columns))
        for sheet_name, required_columns in REQUIRED_COLUMNS.items()
    }
    valid_frames["Kerkesat"] = valid_frames["Kerkesat"].drop(columns=["ID"])

    with pytest.raises(ValueError, match="Sheet 'Kerkesat'.*ID"):
        validate_required_columns(valid_frames)
