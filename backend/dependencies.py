from functools import lru_cache

import pandas as pd

from backend.data.loader import load_workbook
from backend.services.preprocessing_service import get_clean_datasets


@lru_cache(maxsize=1)
def get_workbook() -> dict[str, pd.DataFrame]:
    """Load and cache the validated raw workbook."""
    return load_workbook()


@lru_cache(maxsize=1)
def get_dataset() -> dict[str, pd.DataFrame]:
    """Build and cache the business-ready datasets."""
    return get_clean_datasets(get_workbook())
