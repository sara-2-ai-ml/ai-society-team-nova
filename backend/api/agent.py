"""HTTP endpoint for the grounded Bashkia 360 assistant."""

from fastapi import APIRouter, HTTPException

from backend.models.schemas import AskAgentRequest, AskAgentResponse
from backend.services.agent_service import (
    AgentConfigurationError,
    AgentLoopError,
    ask_assistant,
)


router = APIRouter(tags=["Assistant"])


@router.post("/ask", response_model=AskAgentResponse)
def ask(request: AskAgentRequest) -> AskAgentResponse:
    try:
        # Scope only when the main app sets it, so the plain call stays as before.
        scope = {
            key: value
            for key, value in {"directorate": request.directorate, "language": request.language}.items()
            if value is not None
        }
        return AskAgentResponse(**ask_assistant(request.question, request.session_id, **scope))
    except AgentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentLoopError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
