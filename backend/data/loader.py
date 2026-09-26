"""Load the source datasets used by the Bashkia 360 backend."""

from pathlib import Path

import pandas as pd

from backend.data.validators import (
    REQUIRED_SHEETS,
    validate_required_columns,
    validate_required_sheets,
    validate_workbook_path,
)


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WORKBOOK_PATH = PROJECT_ROOT / "data" / "raw" / "Bashkia_360_Data.xlsx"


def load_workbook(
    workbook_path: str | Path = DEFAULT_WORKBOOK_PATH,
) -> dict[str, pd.DataFrame]:
    """Load and validate all required Bashkia 360 workbook sheets.

    A custom path can be supplied for tests or alternative deployments. The
    returned dictionary is keyed by the original Excel sheet names.
    """
    validated_path = validate_workbook_path(workbook_path)

    with pd.ExcelFile(validated_path) as workbook:
        validate_required_sheets(workbook.sheet_names)
        sheets = {
            sheet_name: workbook.parse(sheet_name)
            for sheet_name in REQUIRED_SHEETS
        }

    validate_required_columns(sheets)
    return sheets


# Preserve compatibility with the initial backend scaffold.
load_data = load_workbook
