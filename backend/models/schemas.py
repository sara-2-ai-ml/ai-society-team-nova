from typing import Any

from pydantic import BaseModel, Field


class MetricResponse(BaseModel):
    name: str
    value: float
    unit: str | None = None


class KPIResponse(BaseModel):
    total_requests: int
    active_requests: int
    resolved_requests: int
    resolution_rate_pct: float
    avg_resolution_days: float
    sla_compliance_pct: float
    recurring_requests: int


class MonthlyTrendResponse(BaseModel):
    month: str
    requests: int


class AreaTrendResponse(MonthlyTrendResponse):
    area: str


class DirectorateTrendResponse(MonthlyTrendResponse):
    directorate: str


class SLAOverallResponse(BaseModel):
    within_sla: int
    outside_sla: int
    sla_compliance_pct: float


class SLAMonthResponse(SLAOverallResponse):
    month: str
    resolved_requests: int


class SLADirectorateResponse(SLAOverallResponse):
    directorate: str
    resolved_requests: int


class SLAAreaResponse(SLAOverallResponse):
    area: str
    resolved_requests: int


class RecurringIssueResponse(BaseModel):
    recurring_group: str
    area: str
    location: str
    category: str
    total_reports: int
    resolved_reports: int
    resolved_pct: float
    first_report: str
    last_report: str


class RecurringSummaryResponse(BaseModel):
    recurring_requests: int
    recurring_issue_groups: int
    areas_affected: int


class WasteOperationResponse(BaseModel):
    month: str
    area: str
    scheduled_collections: int
    completed_collections: int
    missed_collections: int
    avg_delay_hours: float
    vehicle_availability_pct: float


class RoadOperationResponse(BaseModel):
    month: str
    area: str
    reported_incidents: int
    open_incidents: int
    avg_repair_days: float
    drainage_cases: int
    emergency_repairs: int


class BudgetResponse(BaseModel):
    month: str
    directorate: str
    directorate_name: str
    budget_allocated_all: float
    actual_spend_all: float
    committed_spend_all: float
    execution_pct: float


class FinancialContextResponse(BaseModel):
    scope: str
    month: str
    execution_pct: float
    budget_pressure: bool


class PriorityResponse(BaseModel):
    area: str
    directorate: str
    comparison_period: str
    priority: str
    signal_count: int
    triggered_signals: list[str]
    request_growth_pct: float | None = None
    missed_growth_pct: float | None = None
    delay_growth_pct: float | None = None
    vehicle_change_pp: float | None = None
    reported_incidents_growth_pct: float | None = None
    open_incidents_growth_pct: float | None = None
    repair_time_growth_pct: float | None = None
    drainage_growth_pct: float | None = None
    budget_execution_pct: float | None = None
    budget_pressure: bool | None = None
    financial_context: FinancialContextResponse | None = None


class StructuredInsightResponse(BaseModel):
    area: str
    directorate: str
    priority: str
    signal_count: int
    triggered_signals: list[str]
    evidence: dict[str, float | None]
    finding: str
    recommended_next_step: str
    financial_context: FinancialContextResponse | None = None


class AskAgentRequest(BaseModel):
    question: str = Field(min_length=1)
    session_id: str = Field(min_length=1)
    # Set by the main app for directorate users: the agent then only sees that directorate.
    directorate: str | None = None
    # The website's language ("sq" or "en"), so answers match what the user sees.
    language: str | None = None
    # Set by the authenticated NestJS layer; owns persistent conversation history.
    user_id: str | None = None


class AgentToolUse(BaseModel):
    tool: str
    input: dict[str, Any]


class AskAgentResponse(BaseModel):
    session_id: str
    answer: str
    tools_used: list[AgentToolUse]


class InsightResponse(BaseModel):
    title: str
    description: str
    severity: str = "info"


class CollectionResponse(BaseModel):
    items: list[dict[str, Any]] = Field(default_factory=list)
