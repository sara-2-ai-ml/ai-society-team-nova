/** The written part of a report. Numbers inside it always come from ReportFacts. */
export interface Narrative {
  headline: string;
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}

export interface PeriodRange {
  from: string;
  to: string;
}

export interface UnitLine {
  unitId: string;
  name: string;
  total: number;
  open: number;
  overdue: number;
  done: number;
  onTimeRate: number | null;
}

/** Everything the report says, computed from the register. */
export interface ReportFacts {
  scope: { unitId: string | null; name: string };
  period: PeriodRange;
  previousPeriod: PeriodRange;
  metrics: {
    total: number;
    previousTotal: number;
    changePercent: number | null;
    new: number;
    inProgress: number;
    done: number;
    returned: number;
    /** Open and past their deadline today, whenever they were registered. */
    overdue: number;
    onTimeRate: number | null;
    /** Completed requests in the report period that met their deadline. */
    onTimeDone: number;
    previousOnTimeRate: number | null;
    avgDaysToComplete: number | null;
  };
  byUnit: UnitLine[];
  topSubjects: { subject: string; total: number; previous: number }[];
  overdueItems: { protocolNo: string; subject: string; unit: string; daysLate: number }[];
}

export interface Report extends ReportFacts {
  narrative: Narrative;
  /** 'ai' when OpenAI wrote the narrative (via the Python service); 'auto' when rules composed it from the same facts. */
  generatedBy: 'ai' | 'auto';
  model: string | null;
  generatedAt: string;
}
