"""HTTP routes for request trend analytics."""

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_dataset
from backend.models.schemas import (
    AreaTrendResponse,
    DirectorateTrendResponse,
    MonthlyTrendResponse,
)
from backend.services.trend_service import (
    calculate_area_trend,
    calculate_directorate_trend,
    calculate_monthly_trend,
)


router = APIRouter(prefix="/trends", tags=["Trends"])
Datasets = Annotated[dict[str, pd.DataFrame], Depends(get_dataset)]


@router.get("/monthly", response_model=list[MonthlyTrendResponse])
def monthly_trend(
    datasets: Datasets,
    area: str | None = Query(default=None),
    directorate: str | None = Query(default=None),
) -> list[dict]:
    return calculate_monthly_trend(
        datasets["requests"], area=area, directorate=directorate
    )


@router.get("/by-area", response_model=list[AreaTrendResponse])
def area_trend(
    datasets: Datasets,
    area: str | None = Query(default=None),
    directorate: str | None = Query(default=None),
    month: str | None = Query(default=None),
) -> list[dict]:
    return calculate_area_trend(
        datasets["requests"], area=area, directorate=directorate, month=month
    )


@router.get("/by-directorate", response_model=list[DirectorateTrendResponse])
def directorate_trend(
    datasets: Datasets,
    area: str | None = Query(default=None),
    directorate: str | None = Query(default=None),
    month: str | None = Query(default=None),
) -> list[dict]:
    return calculate_directorate_trend(
        datasets["requests"], area=area, directorate=directorate, month=month
    )
