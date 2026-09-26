"""HTTP routes for financial analytics."""

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_dataset
from backend.models.schemas import BudgetResponse
from backend.services.budget_service import calculate_budget, calculate_latest_budget


router = APIRouter(prefix="/budget", tags=["Budget"])
Datasets = Annotated[dict[str, pd.DataFrame], Depends(get_dataset)]


@router.get("", response_model=list[BudgetResponse])
def budget_records(
    datasets: Datasets,
    directorate: str | None = Query(default=None),
    month: str | None = Query(default=None),
) -> list[dict]:
    return calculate_budget(
        datasets["budget"], directorate=directorate, month=month
    )


@router.get("/latest", response_model=list[BudgetResponse])
def latest_budget(
    datasets: Datasets,
    directorate: str | None = Query(default=None),
) -> list[dict]:
    return calculate_latest_budget(datasets["budget"], directorate=directorate)
