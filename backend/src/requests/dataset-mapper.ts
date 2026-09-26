import { UNIT_BY_DIRECTORATE, type DatasetRequest } from '../analytics/python-api.service';
import { HistoryEntry, RequestRecord, RequestStatus } from './request.entity';

// Bashkia 360 statuses → this app's workflow.
const STATUS: Record<string, RequestStatus> = {
  'E re': 'new', // registered, not yet assigned: waits at the unit its category belongs to
  'E caktuar': 'new', // assigned to the directorate, work not started
  'Në proces': 'in_progress',
  'E zgjidhur': 'done',
  'E ridrejtuar': 'returned', // redirected: back with the operator
};

const unitAccount = (unitId: string) => `drejtoria.${unitId}`;

/** Turns one dataset row into a register record, with a history rebuilt from its dates. */
export function fromDataset(row: DatasetRequest, id: number): RequestRecord | null {
  const unitId = UNIT_BY_DIRECTORATE[row.directorate];
  const status = STATUS[row.status];
  if (!unitId || !status) return null;

  const by = unitAccount(unitId);
  const acted = row.assigned_at ?? row.date;
  const history: HistoryEntry[] = [{ at: `${row.date}T09:00:00`, by: row.registered_by ?? 'operator', action: 'sent', unitId }];
  if (status === 'returned') history.push({ at: `${acted}T10:00:00`, by, action: 'returned', note: row.note ?? undefined });
  if (status === 'in_progress' || status === 'done') history.push({ at: `${acted}T10:00:00`, by, action: 'started' });
  if (status === 'done' && row.resolved_at) {
    history.push({ at: `${row.resolved_at}T14:00:00`, by, action: 'completed', note: row.note ?? undefined });
  }

  return {
    id,
    protocolNo: row.id,
    date: row.date,
    subject: row.category ?? row.description ?? '–',
    unitId,
    status,
    deadline: row.deadline,
    completedAt: status === 'done' ? row.resolved_at : null,
    source: 'dataset',
    createdBy: row.registered_by ?? 'operator',
    history,
    description: row.description,
    area: row.area,
    place: row.place,
  };
}
