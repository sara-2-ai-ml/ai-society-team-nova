"""HTTP routes for deterministic decision-support insights."""

from typing import Annotated, Literal

import pandas as pd
from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_dataset
from backend.models.schemas import StructuredInsightResponse
from backend.services.insight_service import get_insights


router = APIRouter(prefix="/insights", tags=["Insights"])
Datasets = Annotated[dict[str, pd.DataFrame], Depends(get_dataset)]


@router.get("", response_model=list[StructuredInsightResponse])
def insights(
    datasets: Datasets,
    directorate: str | None = Query(default=None),
    area: str | None = Query(default=None),
    priority: Literal["Medium", "High"] | None = Query(default=None),
) -> list[dict]:
    return get_insights(
        datasets, directorate=directorate, area=area, priority=priority
    )
