export type Role = 'OPERATOR' | 'DREJTORIA' | 'KRYETARI';

export interface User {
  id: number;
  username: string;
  fullName: string;
  fullNameEn: string;
  role: Role;
  unitId: string | null;
}

export interface DemoAccount {
  username: string;
  fullName: string;
  fullNameEn: string;
  role: Role;
  unitId: string | null;
}

export interface Unit {
  id: string;
  name: string;
  short: string;
  nameEn: string;
  shortEn: string;
  type: 'drejtori' | 'agjenci';
  slaDays: number;
}

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'returned';

export interface HistoryEntry {
  at: string;
  by: string;
  action: 'sent' | 'started' | 'completed' | 'returned' | 'resent';
  unitId?: string;
  note?: string;
}

export interface RequestItem {
  id: number;
  protocolNo: string;
  date: string;
  subject: string;
  unitId: string;
  status: RequestStatus;
  deadline: string;
  completedAt: string | null;
  source: 'form' | 'excel' | 'mock' | 'dataset';
  createdBy: string;
  history: HistoryEntry[];
  description?: string | null;
  area?: string | null;
  place?: string | null;
  overdue: boolean;
  daysLeft: number | null;
}

export interface StatusCounts {
  total: number;
  new: number;
  inProgress: number;
  done: number;
  returned: number;
  overdue: number;
}

export interface UnitStats extends StatusCounts {
  unitId: string;
  onTimeRate: number | null;
}

export interface Stats extends StatusCounts {
  unitId: string | null;
  onTimeRate: number | null;
  avgDaysToComplete: number | null;
  byUnit: UnitStats[];
  byWeek: { week: string; total: number; done: number }[];
  topSubjects: { subject: string; total: number }[];
}

export interface ImportResult {
  dryRun: boolean;
  accepted: { row: number; protocolNo: string; date: string; subject: string; unitId: string }[];
  rejected: { row: number; protocolNo: string; errors: string[] }[];
}

export interface AssistantAnswer {
  answer: string;
  facts: { label: string; value: string }[];
  suggestions: string[];
  source: 'ai' | 'offline';
  tools?: string[];
}

export interface UnitSuggestion {
  unitId: string | null;
  reason: string;
  source: 'ai' | 'history';
}

export interface AiStatus {
  provider: 'openai';
  pythonReachable: boolean;
  configured: boolean;
  model: string | null;
  dataSource: 'dataset' | 'mock';
}

export interface Report {
  scope: { unitId: string | null; name: string };
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  metrics: {
    total: number;
    previousTotal: number;
    changePercent: number | null;
    new: number;
    inProgress: number;
    done: number;
    returned: number;
    overdue: number;
    onTimeRate: number | null;
    previousOnTimeRate: number | null;
    avgDaysToComplete: number | null;
  };
  byUnit: { unitId: string; name: string; total: number; open: number; overdue: number; done: number; onTimeRate: number | null }[];
  topSubjects: { subject: string; total: number; previous: number }[];
  overdueItems: { protocolNo: string; subject: string; unit: string; daysLate: number }[];
  narrative: {
    headline: string;
    summary: string;
    highlights: string[];
    concerns: string[];
    recommendations: string[];
  };
  generatedBy: 'ai' | 'auto';
  model: string | null;
  generatedAt: string;
}
