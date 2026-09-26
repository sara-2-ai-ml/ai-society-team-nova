"""Cleaned requests for the main app's register (NestJS loads them at start-up)."""

from typing import Any

from fastapi import APIRouter

from backend.dependencies import get_dataset, get_workbook
from backend.services.register_service import get_register


router = APIRouter(tags=["Register"])


@router.get("/requests")
def requests() -> list[dict[str, Any]]:
    return get_register(get_dataset(), get_workbook()["Kategorite"])
