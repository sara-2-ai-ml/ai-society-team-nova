from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.agent_service import (
    AgentLoopError,
    TOOL_REGISTRY,
    ask_assistant,
    execute_tool,
)
from backend.services.memory_service import (
    clear_session_memory,
    get_conversation_history,
    initialize_memory_db,
    save_message,
)


REQUIRED_TOOLS = {
    "get_kpis",
    "get_trends",
    "get_sla",
    "get_overdue_open",
    "get_recurring_issues",
    "get_waste_operations",
    "get_road_operations",
    "get_budget",
    "get_priorities",
    "get_structured_insights",
}


def tool_call(name: str, arguments: str, call_id: str = "call-1"):
    return SimpleNamespace(
        type="function_call",
        name=name,
        arguments=arguments,
        call_id=call_id,
    )


def tool_response(*calls):
    return SimpleNamespace(output=list(calls), output_text="")


def final_response(text: str):
    return SimpleNamespace(output=[], output_text=text)


class FakeResponses:
    def __init__(self, responses):
        self._responses = iter(responses)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(deepcopy(kwargs))
        return next(self._responses)


class FakeClient:
    def __init__(self, responses):
        self.responses = FakeResponses(responses)


@pytest.fixture(scope="module")
def datasets():
    return get_dataset()


def test_agent_tool_registry_is_complete():
    assert set(TOOL_REGISTRY) == REQUIRED_TOOLS


def test_core_tools_return_real_filtered_backend_data(datasets):
    kpis = execute_tool("get_kpis", {}, datasets)
    assert kpis["ok"] is True
    assert kpis["data"]["total_requests"] == 556

    area_priorities = execute_tool(
        "get_priorities", {"area": "Lagjja nr. 3"}, datasets
    )
    assert all(row["area"] == "Lagjja nr. 3" for row in area_priorities["data"])

    di_priorities = execute_tool(
        "get_priorities", {"directorate": "DI"}, datasets
    )
    assert all(row["directorate"] == "DI" for row in di_priorities["data"])


@pytest.mark.parametrize(
    "tool_name,arguments,result_key,expected",
    (
        ("get_budget", {"directorate": "DSHP"}, "directorate", "DSHP"),
        ("get_budget", {"month": "2026-09"}, "month", "2026-09"),
        ("get_waste_operations", {"area": "Lagjja nr. 3"}, "area", "Lagjja nr. 3"),
        ("get_road_operations", {"month": "2026-09"}, "month", "2026-09"),
    ),
)
def test_tool_filters(tool_name, arguments, result_key, expected, datasets):
    result = execute_tool(tool_name, arguments, datasets)
    assert result["ok"] is True
    assert result["data"]
    assert all(row[result_key] == expected for row in result["data"])


def test_recurring_tool_filter(datasets):
    result = execute_tool(
        "get_recurring_issues", {"area": "Bradashesh"}, datasets
    )
    assert result["ok"] is True
    assert result["data"]["issues"]
    assert all(
        row["area"] == "Bradashesh" for row in result["data"]["issues"]
    )
    assert result["data"]["summary"]["areas_affected"] == 1


def test_sla_filters_are_applied_before_aggregation(datasets):
    result = execute_tool(
        "get_sla",
        {
            "breakdown": "overall",
            "area": "Lagjja nr. 3",
            "directorate": "DSHP",
            "month": "2026-09",
        },
        datasets,
    )
    assert result["ok"] is True
    assert result["data"]["within_sla"] + result["data"]["outside_sla"] > 0


def test_tool_errors_and_empty_results_are_safe(datasets):
    unknown = execute_tool("not_a_tool", {}, datasets)
    invalid = execute_tool("get_budget", {"month": "September"}, datasets)
    invalid_area = execute_tool("get_priorities", {"area": "Unknown"}, datasets)
    empty = execute_tool("get_budget", {"month": "2025-01"}, datasets)
    assert unknown["ok"] is False
    assert invalid["ok"] is False
    assert invalid_area["ok"] is False
    assert empty == {
        "ok": True,
        "data": [],
        "message": "No data matched the supplied filters.",
    }


def test_memory_lifecycle_and_session_isolation(tmp_path):
    db_path = tmp_path / "memory.db"
    assert initialize_memory_db(db_path).is_file()
    save_message("session-a", "user", "First", db_path)
    save_message("session-a", "assistant", "Second", db_path)
    save_message("session-b", "user", "Other", db_path)

    history = get_conversation_history("session-a", db_path=db_path)
    assert [item["content"] for item in history] == ["First", "Second"]
    assert [item["role"] for item in history] == ["user", "assistant"]
    assert [item["content"] for item in get_conversation_history("session-b", db_path=db_path)] == ["Other"]

    clear_session_memory("session-a", db_path)
    assert get_conversation_history("session-a", db_path=db_path) == []
    assert len(get_conversation_history("session-b", db_path=db_path)) == 1


def test_ask_assistant_uses_history_and_records_tool_use(tmp_path, datasets):
    db_path = tmp_path / "agent.db"
    save_message("follow-up", "user", "Why is Lagjja nr. 3 high priority?", db_path)
    save_message("follow-up", "assistant", "It is High priority for DSHP.", db_path)
    client = FakeClient([
        tool_response(
            tool_call(
                "get_priorities",
                '{"area":"Lagjja nr. 3","directorate":"DSHP"}',
            )
        ),
        final_response("Compared with August, the verified signals increased."),
    ])

    result = ask_assistant(
        "What changed compared with August?",
        "follow-up",
        client=client,
        datasets=datasets,
        memory_db_path=db_path,
    )

    first_input = client.responses.calls[0]["input"]
    assert first_input[0]["content"] == "Why is Lagjja nr. 3 high priority?"
    assert first_input[-1]["content"] == "What changed compared with August?"
    assert result["tools_used"] == [{
        "tool": "get_priorities",
        "input": {"area": "Lagjja nr. 3", "directorate": "DSHP"},
    }]
    stored = get_conversation_history("follow-up", limit=10, db_path=db_path)
    assert stored[-2]["role"] == "user"
    assert stored[-1]["role"] == "assistant"


def test_agent_supports_multiple_tool_calls(tmp_path, datasets):
    client = FakeClient([
        tool_response(
            tool_call("get_priorities", '{"area":"Lagjja nr. 3"}', "call-1"),
            tool_call("get_budget", '{"directorate":"DSHP","month":"2026-09"}', "call-2"),
        ),
        final_response("Priority and budget evidence were reviewed."),
    ])
    result = ask_assistant(
        "Explain the priority and budget.",
        "multi-tool",
        client=client,
        datasets=datasets,
        memory_db_path=tmp_path / "multi.db",
    )
    assert [item["tool"] for item in result["tools_used"]] == [
        "get_priorities", "get_budget"
    ]
    second_input = client.responses.calls[1]["input"]
    outputs = [item for item in second_input if isinstance(item, dict) and item.get("type") == "function_call_output"]
    assert len(outputs) == 2


def test_agent_stops_at_maximum_iterations(tmp_path, datasets):
    client = FakeClient([
        tool_response(tool_call("get_kpis", "{}", f"call-{index}"))
        for index in range(2)
    ])
    with pytest.raises(AgentLoopError, match="maximum of 2"):
        ask_assistant(
            "Keep calling tools.",
            "loop",
            client=client,
            datasets=datasets,
            memory_db_path=tmp_path / "loop.db",
            max_tool_iterations=2,
        )


def test_agent_api_returns_mocked_response(monkeypatch):
    def fake_ask(question, session_id):
        return {
            "session_id": session_id,
            "answer": f"Verified answer for: {question}",
            "tools_used": [{"tool": "get_kpis", "input": {}}],
        }

    monkeypatch.setattr("backend.api.agent.ask_assistant", fake_ask)
    response = TestClient(app).post(
        "/api/ask",
        json={"question": "What are the KPIs?", "session_id": "api-test"},
    )
    assert response.status_code == 200
    assert response.json()["session_id"] == "api-test"
    assert response.json()["answer"]
    assert response.json()["tools_used"][0]["tool"] == "get_kpis"


@pytest.mark.parametrize(
    "payload",
    ({"question": "Hello"}, {"session_id": "missing-question"}),
)
def test_agent_api_requires_question_and_session_id(payload):
    assert TestClient(app).post("/api/ask", json=payload).status_code == 422
