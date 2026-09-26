"""HTTP routes for SLA analytics."""

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends

from backend.dependencies import get_dataset
from backend.models.schemas import (
    SLAAreaResponse,
    SLADirectorateResponse,
    SLAMonthResponse,
    SLAOverallResponse,
)
from backend.services.sla_service import (
    calculate_overall_sla,
    calculate_sla_by_area,
    calculate_sla_by_directorate,
    calculate_sla_by_month,
)


router = APIRouter(prefix="/sla", tags=["SLA"])
Datasets = Annotated[dict[str, pd.DataFrame], Depends(get_dataset)]


@router.get("/overall", response_model=SLAOverallResponse)
def overall_sla(datasets: Datasets) -> dict:
    return calculate_overall_sla(datasets["requests"])


@router.get("/by-month", response_model=list[SLAMonthResponse])
def sla_by_month(datasets: Datasets) -> list[dict]:
    return calculate_sla_by_month(datasets["requests"])


@router.get("/by-directorate", response_model=list[SLADirectorateResponse])
def sla_by_directorate(datasets: Datasets) -> list[dict]:
    return calculate_sla_by_directorate(datasets["requests"])


@router.get("/by-area", response_model=list[SLAAreaResponse])
def sla_by_area(datasets: Datasets) -> list[dict]:
    return calculate_sla_by_area(datasets["requests"])
