"""Single-agent, tool-grounded assistant for Bashkia 360."""

from __future__ import annotations

import json
import os
import re
from datetime import date
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

import pandas as pd
from openai import OpenAI

from backend.dependencies import get_dataset
from backend.services.budget_service import calculate_budget, calculate_latest_budget
from backend.services.insight_service import get_insights
from backend.services.kpi_service import calculate_kpis
from backend.services.memory_service import (
    DEFAULT_MEMORY_DB_PATH,
    get_conversation_history,
    save_message,
)
from backend.services.overdue_service import calculate_open_overdue
from backend.services.operations_service import (
    calculate_roads_monthly,
    calculate_waste_monthly,
)
from backend.services.priority_service import get_priorities
from backend.services.scope_service import scope_datasets
from backend.services.snapshot_service import build_snapshot
from backend.services.recurring_service import (
    calculate_recurring_issues,
    calculate_recurring_summary,
)
from backend.services.sla_service import (
    calculate_overall_sla,
    calculate_sla_by_area,
    calculate_sla_by_directorate,
    calculate_sla_by_month,
)
from backend.services.trend_service import (
    calculate_area_trend,
    calculate_directorate_trend,
    calculate_monthly_trend,
)


DEFAULT_MODEL = "gpt-5-mini"
# Low reasoning effort answers about twice as fast and still uses the tools ("minimal" skips them).
DEFAULT_REASONING_EFFORT = "low"
MAX_TOOL_ITERATIONS = 5
MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")

SYSTEM_PROMPT = """You are the assistant of the Municipality of Elbasan's requests dashboard. You talk with the mayor
and with department staff like a helpful, well-informed colleague.

Facts
1. Use the tools for every question about municipal facts or numbers. They are the only source of truth.
2. Never invent numbers, trends, priorities, deadlines, recurring counts or budget values.
3. Never claim a cause unless the data proves it. Correlation is not causation.
4. If the data cannot answer the question, say so plainly and say what would be needed.
5. Answer directly. When no area, directorate or month is given, use all areas and the whole period. All tool
   filters are optional; for example get_sla with breakdown by_directorate compares DSHP and DI.
6. For delays or overdue requests ("vonesa", "me afat të kaluar"), use get_overdue_open: open requests past their
   deadline today, the same number the dashboard shows. get_sla is about requests that were already resolved.
7. Budget data is per directorate, not per area.
8. The final decision belongs to municipal staff.

How to write
9. Reply in the language of the user's latest message (Albanian or English), in plain everyday words.
10. Sound like a person, not a report: start with the direct answer in one sentence, then add only what helps
    (2-4 short sentences, or a short list of up to 4 items when comparing or listing). Normally under 80 words.
11. No headings such as "Gjetja kryesore", "Dëshmi", "Findings" or "Evidence". No tool names and no technical
    terms like "overdue", "SLA", "KPI" or "breakdown"; in Albanian say "me vonesë", "brenda afatit".
12. Give a recommendation only when it is useful or asked for, in one sentence.
13. If the user says they did not understand, explain again more simply with fewer numbers; do not repeat the
    same answer.
14. Do not end with a question and do not offer extra reports.
15. Keep names as in the data: Lagjja nr. 2, Lagjja nr. 3, Lagjja nr. 5, Bradashesh, Papër, DSHP (Shërbimet
    Publike) and DI (Infrastruktura).
"""


class AgentConfigurationError(RuntimeError):
    pass


class AgentLoopError(RuntimeError):
    pass


def _function_tool(name: str, description: str, properties: dict[str, Any]) -> dict:
    return {
        "type": "function",
        "name": name,
        "description": description,
        "parameters": {
            "type": "object",
            "properties": properties,
            "additionalProperties": False,
        },
    }


OPTIONAL_AREA = {"type": "string", "description": "Exact municipal area name."}
OPTIONAL_DIRECTORATE = {"type": "string", "enum": ["DSHP", "DI"]}
OPTIONAL_MONTH = {"type": "string", "description": "Month formatted YYYY-MM."}
OPTIONAL_PRIORITY = {"type": "string", "enum": ["Low", "Medium", "High"]}

TOOL_DEFINITIONS = [
    _function_tool("get_kpis", "Return the verified core dashboard KPIs.", {}),
    _function_tool(
        "get_trends",
        "Return monthly request totals and breakdowns by area and directorate.",
        {"area": OPTIONAL_AREA, "directorate": OPTIONAL_DIRECTORATE, "month": OPTIONAL_MONTH},
    ),
    _function_tool(
        "get_sla",
        "Return SLA performance of resolved requests (closed within or outside their deadline). "
        "All filters are optional; omit month for the whole period.",
        {
            "breakdown": {
                "type": "string",
                "enum": ["overall", "by_month", "by_area", "by_directorate"],
            },
            "area": OPTIONAL_AREA,
            "directorate": OPTIONAL_DIRECTORATE,
            "month": OPTIONAL_MONTH,
        },
    ),
    _function_tool(
        "get_overdue_open",
        "Return open requests that are past their deadline today: totals, by directorate, category and area, "
        "and the oldest ones. Use for any question about delays or overdue requests.",
        {},
    ),
    _function_tool(
        "get_recurring_issues",
        "Return recurring issue evidence and its verified summary.",
        {"area": OPTIONAL_AREA},
    ),
    _function_tool(
        "get_waste_operations",
        "Return aggregated waste operations by month and area.",
        {"area": OPTIONAL_AREA, "month": OPTIONAL_MONTH},
    ),
    _function_tool(
        "get_road_operations",
        "Return aggregated road operations by month and area.",
        {"area": OPTIONAL_AREA, "month": OPTIONAL_MONTH},
    ),
    _function_tool(
        "get_budget",
        "Return directorate-level budget records or latest records.",
        {
            "directorate": OPTIONAL_DIRECTORATE,
            "month": OPTIONAL_MONTH,
            "latest": {"type": "boolean"},
        },
    ),
    _function_tool(
        "get_priorities",
        "Return deterministic cross-source priorities and their signals.",
        {"area": OPTIONAL_AREA, "directorate": OPTIONAL_DIRECTORATE, "priority": OPTIONAL_PRIORITY},
    ),
    _function_tool(
        "get_structured_insights",
        "Return Medium and High decision insights grounded in priority evidence.",
        {"area": OPTIONAL_AREA, "directorate": OPTIONAL_DIRECTORATE, "priority": OPTIONAL_PRIORITY},
    ),
]


def _filter_records(records: list[dict], field: str, value: str | None) -> list[dict]:
    return records if value is None else [row for row in records if row.get(field) == value]


def _filter_requests(
    requests: pd.DataFrame,
    *,
    area: str | None = None,
    directorate: str | None = None,
    month: str | None = None,
) -> pd.DataFrame:
    filtered = requests
    if area is not None:
        filtered = filtered[filtered["Lagjja / Fshati"].eq(area)]
    if directorate is not None:
        filtered = filtered[filtered["Drejtoria"].eq(directorate)]
    if month is not None:
        filtered = filtered[filtered["Muaji"].astype("string").eq(month)]
    return filtered


def _tool_get_kpis(datasets: Mapping[str, pd.DataFrame], _: dict) -> Any:
    return calculate_kpis(datasets["requests"])


def _tool_get_trends(datasets: Mapping[str, pd.DataFrame], args: dict) -> Any:
    area, directorate, month = args.get("area"), args.get("directorate"), args.get("month")
    monthly = calculate_monthly_trend(
        datasets["requests"], area=area, directorate=directorate
    )
    monthly = _filter_records(monthly, "month", month)
    return {
        "monthly": monthly,
        "by_area": calculate_area_trend(
            datasets["requests"], area=area, directorate=directorate, month=month
        ),
        "by_directorate": calculate_directorate_trend(
            datasets["requests"], area=area, directorate=directorate, month=month
        ),
    }


def _tool_get_sla(datasets: Mapping[str, pd.DataFrame], args: dict) -> Any:
    requests = _filter_requests(
        datasets["requests"],
        area=args.get("area"),
        directorate=args.get("directorate"),
        month=args.get("month"),
    )
    breakdown = args.get("breakdown", "overall")
    if breakdown == "overall":
        return calculate_overall_sla(requests)
    mapping = {
        "by_month": (calculate_sla_by_month, "month", args.get("month")),
        "by_area": (calculate_sla_by_area, "area", args.get("area")),
        "by_directorate": (
            calculate_sla_by_directorate,
            "directorate",
            args.get("directorate"),
        ),
    }
    function, field, value = mapping[breakdown]
    return _filter_records(function(requests), field, value)


def _tool_get_overdue_open(datasets: Mapping[str, pd.DataFrame], _: dict) -> Any:
    return calculate_open_overdue(datasets["requests"])


def _tool_get_recurring(datasets: Mapping[str, pd.DataFrame], args: dict) -> Any:
    requests = _filter_requests(datasets["requests"], area=args.get("area"))
    return {
        "summary": calculate_recurring_summary(requests),
        "issues": calculate_recurring_issues(requests),
    }


def _tool_get_waste(datasets: Mapping[str, pd.DataFrame], args: dict) -> Any:
    return calculate_waste_monthly(
        datasets["waste"], area=args.get("area"), month=args.get("month")
    )


def _tool_get_roads(datasets: Mapping[str, pd.DataFrame], args: dict) -> Any:
    return calculate_roads_monthly(
        datasets["roads"], area=args.get("area"), month=args.get("month")
    )


def _tool_get_budget(datasets: Mapping[str, pd.DataFrame], args: dict) -> Any:
    if args.get("latest"):
        return calculate_latest_budget(
            datasets["budget"], directorate=args.get("directorate")
        )
    return calculate_budget(
        datasets["budget"],
        directorate=args.get("directorate"),
        month=args.get("month"),
    )


def _tool_get_priorities(datasets: Mapping[str, pd.DataFrame], args: dict) -> Any:
    return get_priorities(
        datasets,
        area=args.get("area"),
        directorate=args.get("directorate"),
        priority=args.get("priority"),
    )


def _tool_get_insights(datasets: Mapping[str, pd.DataFrame], args: dict) -> Any:
    return get_insights(
        datasets,
        area=args.get("area"),
        directorate=args.get("directorate"),
        priority=args.get("priority"),
    )


ToolHandler = Callable[[Mapping[str, pd.DataFrame], dict], Any]
TOOL_REGISTRY: dict[str, ToolHandler] = {
    "get_kpis": _tool_get_kpis,
    "get_trends": _tool_get_trends,
    "get_sla": _tool_get_sla,
    "get_overdue_open": _tool_get_overdue_open,
    "get_recurring_issues": _tool_get_recurring,
    "get_waste_operations": _tool_get_waste,
    "get_road_operations": _tool_get_roads,
    "get_budget": _tool_get_budget,
    "get_priorities": _tool_get_priorities,
    "get_structured_insights": _tool_get_insights,
}


def _validate_arguments(
    tool_name: str, args: dict, datasets: Mapping[str, pd.DataFrame]
) -> str | None:
    if not isinstance(args, dict):
        return "Tool arguments must be a JSON object."
    month = args.get("month")
    if month is not None and (
        not isinstance(month, str) or MONTH_PATTERN.fullmatch(month) is None
    ):
        return "month must use the YYYY-MM format."
    area = args.get("area")
    valid_areas = set(datasets["requests"]["Lagjja / Fshati"].dropna().astype(str))
    if area is not None and area not in valid_areas:
        return f"Unknown area '{area}'. Valid areas: {', '.join(sorted(valid_areas))}."
    directorate = args.get("directorate")
    valid_directorates = set(datasets["budget"]["directorate"].dropna().astype(str))
    if directorate is not None and directorate not in valid_directorates:
        return (
            f"Unknown directorate '{directorate}'. Valid directorates: "
            f"{', '.join(sorted(valid_directorates))}."
        )
    priority = args.get("priority")
    if priority is not None and priority not in {"Low", "Medium", "High"}:
        return "priority must be Low, Medium, or High."
    if tool_name == "get_sla" and args.get("breakdown", "overall") not in {
        "overall", "by_month", "by_area", "by_directorate"
    }:
        return "Unsupported SLA breakdown."
    return None


def execute_tool(
    tool_name: str,
    arguments: dict,
    datasets: Mapping[str, pd.DataFrame] | None = None,
) -> dict[str, Any]:
    """Validate and execute one registered backend tool without raising."""
    if tool_name not in TOOL_REGISTRY:
        return {"ok": False, "error": f"Unknown tool '{tool_name}'."}
    clean_datasets = get_dataset() if datasets is None else datasets
    validation_error = _validate_arguments(tool_name, arguments, clean_datasets)
    if validation_error:
        return {"ok": False, "error": validation_error}
    try:
        data = TOOL_REGISTRY[tool_name](clean_datasets, arguments)
    except Exception as exc:
        return {
            "ok": False,
            "error": f"Tool '{tool_name}' could not complete: {type(exc).__name__}: {exc}",
        }
    empty = data == [] or (
        isinstance(data, dict)
        and bool(data)
        and all(value == [] for value in data.values())
    )
    result: dict[str, Any] = {"ok": True, "data": data}
    if empty:
        result["message"] = "No data matched the supplied filters."
    return result


def _response_tool_calls(response: Any) -> list[Any]:
    return [
        item for item in getattr(response, "output", [])
        if getattr(item, "type", None) == "function_call"
    ]


def _speed_options(model: str) -> dict[str, Any]:
    """Shorter thinking and shorter answers on GPT-5 models; other models take no such options."""
    if not model.startswith("gpt-5"):
        return {}
    effort = os.getenv("OPENAI_REASONING_EFFORT", DEFAULT_REASONING_EFFORT)
    return {"reasoning": {"effort": effort}, "text": {"verbosity": "low"}}


def ask_assistant(
    question: str,
    session_id: str,
    *,
    client: Any | None = None,
    datasets: Mapping[str, pd.DataFrame] | None = None,
    memory_db_path: str | Path = DEFAULT_MEMORY_DB_PATH,
    max_tool_iterations: int = MAX_TOOL_ITERATIONS,
    directorate: str | None = None,
    language: str | None = None,
) -> dict[str, Any]:
    """Run the grounded tool-calling loop and persist final conversation text.

    With `directorate`, every tool only sees that directorate's rows.
    """
    question = question.strip()
    session_id = session_id.strip()
    if not question or not session_id:
        raise ValueError("question and session_id must not be empty.")
    if max_tool_iterations <= 0:
        raise ValueError("max_tool_iterations must be greater than zero.")
    if directorate is not None and directorate not in {"DSHP", "DI"}:
        raise ValueError("directorate must be DSHP or DI.")

    if client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise AgentConfigurationError(
                "OPENAI_API_KEY is required for a live assistant call."
            )
        client = OpenAI(api_key=api_key)

    history = get_conversation_history(
        session_id, limit=10, db_path=memory_db_path
    )
    input_items: list[Any] = [
        {"role": item["role"], "content": item["content"]} for item in history
    ]
    input_items.append({"role": "user", "content": question})
    clean_datasets = scope_datasets(get_dataset() if datasets is None else datasets, directorate)
    today = date.today()
    instructions = SYSTEM_PROMPT + (
        f"\nToday is {today.isoformat()}. \"This month\" means {today:%Y-%m} up to today; "
        "\"this week\" means the last 7 days."
    )
    if directorate is not None:
        instructions += (
            f"\n16. You are answering a user of directorate {directorate}. The data only contains "
            f"{directorate}; do not discuss other directorates."
        )
    # Verified numbers computed now, so most questions need no tool call at all (faster).
    instructions += (
        "\n\nCURRENT FACTS (verified, computed just now). Answer from these when they cover the question; "
        "call a tool only for anything they do not contain:\n"
        + json.dumps(build_snapshot(clean_datasets, today), ensure_ascii=False, default=str)
    )
    if language in {"sq", "en"}:
        name = "Albanian" if language == "sq" else "English"
        instructions += f"\n\nAlways answer in {name}."
    tools_used: list[dict[str, Any]] = []
    model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL)

    for _ in range(max_tool_iterations):
        try:
            response = client.responses.create(
                model=model,
                instructions=instructions,
                input=input_items,
                tools=TOOL_DEFINITIONS,
                **_speed_options(model),
            )
        except Exception as exc:
            raise AgentLoopError(
                f"OpenAI request failed with {type(exc).__name__}."
            ) from exc
        tool_calls = _response_tool_calls(response)
        if not tool_calls:
            answer = str(getattr(response, "output_text", "")).strip()
            if not answer:
                raise AgentLoopError("The model returned no final answer.")
            save_message(session_id, "user", question, db_path=memory_db_path)
            save_message(session_id, "assistant", answer, db_path=memory_db_path)
            return {
                "session_id": session_id,
                "answer": answer,
                "tools_used": tools_used,
            }

        input_items.extend(getattr(response, "output", []))
        for call in tool_calls:
            try:
                arguments = json.loads(getattr(call, "arguments", "{}"))
            except json.JSONDecodeError:
                arguments = {}
                tool_result = {"ok": False, "error": "Tool arguments were not valid JSON."}
            else:
                tool_result = execute_tool(
                    getattr(call, "name", ""), arguments, clean_datasets
                )
            tools_used.append({"tool": getattr(call, "name", ""), "input": arguments})
            input_items.append({
                "type": "function_call_output",
                "call_id": getattr(call, "call_id", ""),
                "output": json.dumps(tool_result, ensure_ascii=False, default=str),
            })

    raise AgentLoopError(
        f"Assistant exceeded the maximum of {max_tool_iterations} tool iterations."
    )
