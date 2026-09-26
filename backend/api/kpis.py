"""HTTP endpoint for Bashkia 360 dashboard KPIs."""

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends

from backend.dependencies import get_dataset
from backend.models.schemas import KPIResponse
from backend.services.kpi_service import get_kpis


router = APIRouter(prefix="/kpis", tags=["KPIs"])


@router.get("", response_model=KPIResponse)
def read_kpis(
    datasets: Annotated[dict[str, pd.DataFrame], Depends(get_dataset)],
) -> KPIResponse:
    """Return KPIs calculated from the cached clean requests dataset."""
    return KPIResponse(**get_kpis(datasets))
