"""Endpoints and scoping used by the main app (NestJS)."""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_dataset
from backend.main import app
from backend.services.agent_service import ask_assistant
from backend.services.narrative_service import write_narrative
from backend.services.scope_service import scope_datasets


client = TestClient(app)


def test_register_exports_every_request_with_a_directorate():
    records = client.get("/api/requests").json()
    assert len(records) == len(get_dataset()["requests"])
    assert len({r["id"] for r in records}) == len(records)
    assert {r["directorate"] for r in records} == {"DSHP", "DI"}
    unassigned = [r for r in records if not r["assigned"]]
    assert unassigned and all(r["status"] == "E re" for r in unassigned)
    assert all(r["date"] and r["deadline"] for r in records)
    assert all(r["resolved_at"] for r in records if r["status"] == "E zgjidhur")


def test_scope_keeps_only_one_directorate():
    scoped = scope_datasets(get_dataset(), "DI")
    assert set(scoped["requests"]["Drejtoria"]) == {"DI"}
    assert scoped["waste"].empty  # waste collection is a DSHP operation
    assert set(scoped["budget"]["directorate"]) == {"DI"}
    assert scope_datasets(get_dataset(), None)["requests"].shape == get_dataset()["requests"].shape


class RecordingClient:
    """Fake OpenAI client: asks for the budget once, then answers."""

    def __init__(self):
        self.calls = []
        self.responses = SimpleNamespace(create=self.create)

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            call = SimpleNamespace(type="function_call", name="get_budget", arguments="{}", call_id="c1")
            return SimpleNamespace(output=[call], output_text="")
        return SimpleNamespace(output=[], output_text="Only DSHP data.")


def test_directorate_scope_limits_what_the_agent_sees(tmp_path):
    fake = RecordingClient()
    result = ask_assistant("Budget?", "scope-test", client=fake, memory_db_path=tmp_path / "m.db", directorate="DSHP")
    assert result["answer"] == "Only DSHP data."
    tool_output = json.loads(fake.calls[1]["input"][-1]["output"])
    assert {row["directorate"] for row in tool_output["data"]} == {"DSHP"}
    assert "directorate DSHP" in fake.calls[0]["instructions"]


def test_directorate_scope_rejects_unknown_values(tmp_path):
    with pytest.raises(ValueError):
        ask_assistant("x", "s", client=RecordingClient(), memory_db_path=tmp_path / "m.db", directorate="XYZ")


def test_ai_status_reports_whether_a_key_is_set(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert client.get("/api/ai/status").json()["configured"] is False
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    assert client.get("/api/ai/status").json()["configured"] is True


def test_report_narrative_without_key_is_503(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/report-narrative", json={"facts": {"a": 1}, "language": "en"})
    assert response.status_code == 503


def test_write_narrative_uses_structured_output():
    narrative = {"headline": "H", "summary": "S", "highlights": ["a"], "concerns": ["b"], "recommendations": ["c"]}
    seen = {}

    def create(**kwargs):
        seen.update(kwargs)
        return SimpleNamespace(output_text=json.dumps(narrative))

    result = write_narrative({"metrics": {"total": 3}}, "en", client=SimpleNamespace(responses=SimpleNamespace(create=create)))
    assert result["headline"] == "H" and result["model"]
    assert seen["text"]["format"]["type"] == "json_schema"
    assert seen["text"]["format"]["strict"] is True
    assert "English" in seen["instructions"]


def test_overdue_tool_counts_like_the_dashboard():
    """The register gives unassigned requests their category's directorate; the agent must agree."""
    from datetime import date

    from backend.services.overdue_service import calculate_open_overdue

    records = client.get("/api/requests").json()
    today = date.today().isoformat()
    open_late = [r for r in records if r["status"] not in ("E zgjidhur", "E ridrejtuar") and r["deadline"] < today]
    expected = {d: sum(r["directorate"] == d for r in open_late) for d in ("DSHP", "DI")}

    overdue = calculate_open_overdue(scope_datasets(get_dataset(), None)["requests"])
    assert overdue["overdue_open_requests"] == len(open_late)
    assert {row["name"]: row["overdue"] for row in overdue["by_directorate"]} == {k: v for k, v in expected.items() if v}
    assert calculate_open_overdue(scope_datasets(get_dataset(), "DSHP")["requests"])["overdue_open_requests"] == expected["DSHP"]


def test_snapshot_matches_the_dashboard_and_the_scope():
    from datetime import date

    from backend.services.snapshot_service import build_snapshot

    today = date.today()
    records = [r for r in client.get("/api/requests").json() if r["date"] <= today.isoformat()]
    month = [r for r in records if r["date"].startswith(today.strftime("%Y-%m"))]
    snapshot = build_snapshot(scope_datasets(get_dataset(), None), today)
    assert snapshot["this_month"]["requests"] == len(month)
    assert snapshot["this_month"]["by_directorate"] == {
        d: n for d in ("DSHP", "DI") if (n := sum(r["directorate"] == d for r in month))
    }

    scoped = build_snapshot(scope_datasets(get_dataset(), "DI"), today)
    assert set(scoped["overdue_open_today"]["by_directorate"]) <= {"DI"}
    assert {row["directorate"] for row in scoped["latest_budget"]} == {"DI"}


def test_suggest_unit_returns_only_known_units(monkeypatch):
    from backend.services.unit_suggest_service import suggest_unit

    units = [{"id": "infrastruktura", "name": "Drejtoria e Infrastrukturës", "usual_subjects": ["Gropë në rrugë"]}]
    seen = {}

    def create(**kwargs):
        seen.update(kwargs)
        return SimpleNamespace(output_text=json.dumps({"unit_id": "infrastruktura", "reason": "Rrugët i mbulon Infrastruktura."}))

    fake = SimpleNamespace(responses=SimpleNamespace(create=create))
    result = suggest_unit("Gropë e made te shkolla", units, "sq", client=fake)
    assert result["unit_id"] == "infrastruktura" and result["reason"]
    assert seen["text"]["format"]["schema"]["properties"]["unit_id"]["enum"] == ["infrastruktura", "none"]

    none = SimpleNamespace(responses=SimpleNamespace(create=lambda **_: SimpleNamespace(output_text=json.dumps({"unit_id": "none", "reason": "-"}))))
    assert suggest_unit("x y z", units, client=none)["unit_id"] is None

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/suggest-unit", json={"subject": "Gropë", "units": units})
    assert response.status_code == 503
