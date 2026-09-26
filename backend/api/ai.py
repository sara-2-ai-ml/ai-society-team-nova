"""AI status and report writing (OpenAI), used by the main app."""

from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.agent_service import AgentConfigurationError, AgentLoopError
from backend.services.narrative_service import ai_status, write_narrative
from backend.services.unit_suggest_service import suggest_unit


router = APIRouter(tags=["AI"])


class SuggestUnitRequest(BaseModel):
    subject: str
    # [{id, name, type, usual_subjects: [...]}], sent by the main app.
    units: list[dict[str, Any]]
    language: Literal["sq", "en"] = "sq"


class NarrativeRequest(BaseModel):
    facts: dict[str, Any]
    language: Literal["sq", "en"] = "sq"


@router.get("/ai/status")
def status() -> dict[str, Any]:
    return ai_status()


@router.post("/report-narrative")
def report_narrative(request: NarrativeRequest) -> dict[str, Any]:
    try:
        return write_narrative(request.facts, request.language)
    except AgentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentLoopError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/suggest-unit")
def suggest(request: SuggestUnitRequest) -> dict[str, Any]:
    try:
        return suggest_unit(request.subject, request.units, request.language)
    except AgentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentLoopError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
