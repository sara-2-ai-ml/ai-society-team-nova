"""Write a report's text with OpenAI from facts the main app has already computed."""

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


INSTRUCTIONS = {
    "sq": """Ju shkruani raporte periodike për administratën e Bashkisë Elbasan.
Lexuesi është kryetari ose drejtuesi i një drejtorie: njerëz të zënë që duan të dinë shpejt çfarë ndodhi dhe çfarë duhet bërë.
Rregulla:
- Shqip standard, ton institucional, i qartë dhe i shkurtër.
- Përdorni VETËM shifrat dhe emrat në të dhënat JSON. Mos llogaritni përqindje të reja dhe mos shpikni shifra, emra ose shkaqe.
- Kur një shifër mungon (null), mos e përmendni.
- metrics.overdue, byUnit[].overdue dhe overdueItems janë kërkesat e hapura që kanë kaluar afatin sot. Shifrat e tjera i përkasin periudhës së raportit.
- headline: një fjali. summary: 2–3 fjali me krahasimin me periudhën e mëparshme.
- highlights: 2–4 gjëra që shkuan mirë. concerns: 1–4 probleme konkrete. recommendations: 2–4 veprime konkrete.
- Çdo pikë është një fjali e vetme. Vendimi përfundimtar i takon stafit të Bashkisë.""",
    "en": """You write periodic reports for the administration of the Municipality of Elbasan.
The reader is the mayor or the head of a department: busy people who want to know quickly what happened and what to do.
Rules:
- Clear, concise English with an institutional tone. Keep department and subject names exactly as in the data.
- Use ONLY the numbers and names in the JSON data. Do not compute new percentages and do not invent numbers, names or causes.
- When a number is missing (null), do not mention it.
- metrics.overdue, byUnit[].overdue and overdueItems are the open requests past their deadline today. All other numbers belong to the report period.
- headline: one sentence. summary: 2–3 sentences including the comparison with the previous period.
- highlights: 2–4 things that went well. concerns: 1–4 concrete problems. recommendations: 2–4 concrete actions.
- Every point is a single sentence. The final decision belongs to municipal staff.""",
}

NARRATIVE_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "summary": {"type": "string"},
        "highlights": {"type": "array", "items": {"type": "string"}},
        "concerns": {"type": "array", "items": {"type": "string"}},
        "recommendations": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["headline", "summary", "highlights", "concerns", "recommendations"],
    "additionalProperties": False,
}


def ai_status() -> dict[str, Any]:
    return {
        "provider": "openai",
        "configured": bool(os.getenv("OPENAI_API_KEY")),
        "model": os.getenv("OPENAI_MODEL", DEFAULT_MODEL),
    }


def write_narrative(facts: dict[str, Any], language: str, *, client: Any | None = None) -> dict[str, Any]:
    """Return {headline, summary, highlights, concerns, recommendations, model}."""
    if client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise AgentConfigurationError("OPENAI_API_KEY is required to write reports with AI.")
        client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL)
    lang = "en" if language == "en" else "sq"
    try:
        response = client.responses.create(
            model=model,
            instructions=INSTRUCTIONS[lang],
            input=json.dumps(facts, ensure_ascii=False),
            text={"format": {"type": "json_schema", "name": "report_narrative", "schema": NARRATIVE_SCHEMA, "strict": True}},
            **(
                {"reasoning": {"effort": os.getenv("OPENAI_REASONING_EFFORT", DEFAULT_REASONING_EFFORT)}}
                if model.startswith("gpt-5")
                else {}
            ),
        )
    except Exception as exc:
        raise AgentLoopError(f"OpenAI request failed with {type(exc).__name__}.") from exc

    try:
        narrative = json.loads(str(getattr(response, "output_text", "")))
    except json.JSONDecodeError as exc:
        raise AgentLoopError("The model did not return valid JSON.") from exc
    if not isinstance(narrative, dict) or set(NARRATIVE_SCHEMA["required"]) - set(narrative):
        raise AgentLoopError("The model returned an incomplete report.")
    return {**narrative, "model": model}
