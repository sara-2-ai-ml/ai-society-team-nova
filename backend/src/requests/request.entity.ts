/**
 * Workflow of a request:
 *   new (sent to a unit) → in_progress → done
 *   new | in_progress → returned (not this unit's job) → operator resends → new
 */
export type RequestStatus = 'new' | 'in_progress' | 'done' | 'returned';

export const OPEN_STATUSES: RequestStatus[] = ['new', 'in_progress'];

export type HistoryAction = 'sent' | 'started' | 'completed' | 'returned' | 'resent';

export interface HistoryEntry {
  at: string;
  by: string;
  action: HistoryAction;
  unitId?: string;
  note?: string;
}

/** One line of the protocol register. */
export interface RequestRecord {
  id: number;
  protocolNo: string;
  /** Registration day, YYYY-MM-DD. */
  date: string;
  subject: string;
  unitId: string;
  status: RequestStatus;
  /** Last day to complete it, YYYY-MM-DD. */
  deadline: string;
  completedAt: string | null;
  source: 'form' | 'excel' | 'mock' | 'dataset';
  createdBy: string;
  history: HistoryEntry[];
  /** Extra details from the Bashkia 360 dataset, when the request came from it. */
  description?: string | null;
  area?: string | null;
  place?: string | null;
}

export interface RequestView extends RequestRecord {
  overdue: boolean;
  /** Days until the deadline (negative when late); null once done or returned. */
  daysLeft: number | null;
}
