"""HTTP routes for operational analytics."""

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_dataset
from backend.models.schemas import RoadOperationResponse, WasteOperationResponse
from backend.services.operations_service import (
    calculate_roads_monthly,
    calculate_waste_monthly,
)


router = APIRouter(prefix="/operations", tags=["Operations"])
Datasets = Annotated[dict[str, pd.DataFrame], Depends(get_dataset)]


@router.get("/waste", response_model=list[WasteOperationResponse])
def waste_operations(
    datasets: Datasets,
    area: str | None = Query(default=None),
    month: str | None = Query(default=None),
) -> list[dict]:
    return calculate_waste_monthly(datasets["waste"], area=area, month=month)


@router.get("/roads", response_model=list[RoadOperationResponse])
def road_operations(
    datasets: Datasets,
    area: str | None = Query(default=None),
    month: str | None = Query(default=None),
) -> list[dict]:
    return calculate_roads_monthly(datasets["roads"], area=area, month=month)
