"""HTTP endpoint for the grounded Bashkia 360 assistant."""

from fastapi import APIRouter, HTTPException, Query

from backend.models.schemas import AskAgentRequest, AskAgentResponse
from backend.services.agent_service import (
    AgentConfigurationError,
    AgentLoopError,
    ask_assistant,
)
from backend.services.memory_service import (
    delete_user_conversation,
    get_user_conversation,
    list_user_conversations,
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
        return AskAgentResponse(**ask_assistant(request.question, request.session_id, user_id=request.user_id, **scope))
    except AgentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentLoopError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/conversations")
def conversations(user_id: str = Query(min_length=1)) -> list[dict[str, str]]:
    return list_user_conversations(user_id)


@router.get("/conversations/{conversation_id}")
def conversation(conversation_id: str, user_id: str = Query(min_length=1)) -> dict:
    try:
        return get_user_conversation(conversation_id, user_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, user_id: str = Query(min_length=1)) -> None:
    try:
        delete_user_conversation(conversation_id, user_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
