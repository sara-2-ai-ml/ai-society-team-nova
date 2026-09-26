"""HTTP routes for cross-source priority results."""

from typing import Annotated, Literal

import pandas as pd
from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_dataset
from backend.models.schemas import PriorityResponse
from backend.services.priority_service import get_priorities


router = APIRouter(prefix="/priorities", tags=["Priorities"])
Datasets = Annotated[dict[str, pd.DataFrame], Depends(get_dataset)]


@router.get("", response_model=list[PriorityResponse])
def priorities(
    datasets: Datasets,
    directorate: str | None = Query(default=None),
    area: str | None = Query(default=None),
    priority: Literal["Low", "Medium", "High"] | None = Query(default=None),
) -> list[dict]:
    return get_priorities(
        datasets, directorate=directorate, area=area, priority=priority
    )
