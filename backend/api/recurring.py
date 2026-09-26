"""HTTP routes exposing recurring issue evidence."""

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_dataset
from backend.models.schemas import RecurringIssueResponse, RecurringSummaryResponse
from backend.services.recurring_service import (
    calculate_recurring_issues,
    calculate_recurring_summary,
)


router = APIRouter(prefix="/recurring", tags=["Recurring"])
Datasets = Annotated[dict[str, pd.DataFrame], Depends(get_dataset)]


@router.get("", response_model=list[RecurringIssueResponse])
def recurring_issues(
    datasets: Datasets,
    area: str | None = Query(default=None),
) -> list[dict]:
    return calculate_recurring_issues(datasets["requests"], area=area)


@router.get("/summary", response_model=RecurringSummaryResponse)
def recurring_summary(datasets: Datasets) -> dict:
    return calculate_recurring_summary(datasets["requests"])
