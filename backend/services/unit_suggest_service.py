"""Suggest which department or agency a request belongs to, from its subject.

The operator types the subject; the AI picks one of the municipality's units and says why in one
sentence. It only suggests: the operator confirms or chooses another unit.
"""

from __future__ import annotations

import json
import os
from typing import Any

from openai import OpenAI

from backend.services.agent_service import (
    DEFAULT_MODEL,
    DEFAULT_REASONING_EFFORT,
    AgentConfigurationError,
    AgentLoopError,
)


INSTRUCTIONS = """You route citizens' requests to the right unit of the Municipality of Elbasan.
You get the request's subject and the list of units, each with the subjects it usually handles.
Pick the one unit whose responsibilities best fit the subject. Choose "none" only if no unit fits at all.
Give the reason in one short sentence (under 15 words) in {language}, naming the unit's area of work.
Base the choice only on the units' descriptions and usual subjects."""


def suggest_unit(
    subject: str,
    units: list[dict[str, Any]],
    language: str = "sq",
    *,
    client: Any | None = None,
) -> dict[str, Any]:
    """Return {"unit_id": <id or None>, "reason": str, "model": str}."""
    subject = subject.strip()
    if not subject:
        raise ValueError("subject must not be empty.")
    ids = [str(u["id"]) for u in units]
    if not ids:
        raise ValueError("units must not be empty.")

    if client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise AgentConfigurationError("OPENAI_API_KEY is required for AI suggestions.")
        client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL)
    schema = {
        "type": "object",
        "properties": {
            "unit_id": {"type": "string", "enum": [*ids, "none"]},
            "reason": {"type": "string"},
        },
        "required": ["unit_id", "reason"],
        "additionalProperties": False,
    }
    speed = (
        {"reasoning": {"effort": os.getenv("OPENAI_REASONING_EFFORT", DEFAULT_REASONING_EFFORT)}}
        if model.startswith("gpt-5")
        else {}
    )
    try:
        response = client.responses.create(
            model=model,
            instructions=INSTRUCTIONS.format(language="English" if language == "en" else "Albanian"),
            input=json.dumps({"subject": subject, "units": units}, ensure_ascii=False),
            text={"format": {"type": "json_schema", "name": "unit_suggestion", "schema": schema, "strict": True}},
            **speed,
        )
        result = json.loads(str(getattr(response, "output_text", "")))
    except json.JSONDecodeError as exc:
        raise AgentLoopError("The model did not return valid JSON.") from exc
    except Exception as exc:
        raise AgentLoopError(f"OpenAI request failed with {type(exc).__name__}.") from exc

    unit_id = result.get("unit_id")
    return {
        "unit_id": unit_id if unit_id in ids else None,
        "reason": str(result.get("reason", "")).strip(),
        "model": model,
    }
