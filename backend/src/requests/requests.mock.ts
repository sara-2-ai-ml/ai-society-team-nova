import { addDays, daysBetween } from '../common/dates';
import { Unit } from '../units/unit.entity';
import { MOCK_SUBJECTS } from '../units/units.mock';
import { HistoryEntry, RequestRecord, RequestStatus } from './request.entity';

// Small, repeatable mock register for the last ~11 weeks, relative to `today` so it always looks current.
// Planted story for the demo: Shërbimet Sociale gets a wave of "ndihmë ekonomike" requests in the last
// three weeks and falls behind, while Shërbimet Publike stays fast.

const WEIGHTS: Record<string, number> = {
  sociale: 5,
  publike: 6,
  infrastruktura: 5,
  urbanistika: 3,
  parqet: 2,
  transporti: 2,
};

function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mock requests for `units`; protocol numbers continue from `firstNumber`, ids from `firstId`. */
export function generateMockRequests(units: Unit[], today: string, firstNumber = 412, firstId = 1): RequestRecord[] {
  const rand = seededRandom(2026);
  const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];
  const weighted = units.flatMap((u) => Array<Unit>(WEIGHTS[u.id] ?? 1).fill(u));
  const sociale = units.find((u) => u.id === 'sociale');

  const drafts: { day: string; unit: Unit; subject: string }[] = [];
  for (let back = 75; back >= 0; back--) {
    const day = addDays(today, -back);
    const weekday = new Date(`${day}T12:00:00`).getDay();
    if (weekday === 0 || weekday === 6) continue;

    const count = Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const unit = pick(weighted);
      drafts.push({ day, unit, subject: pick(MOCK_SUBJECTS[unit.id] ?? ['Kërkesë e përgjithshme']) });
    }
    if (sociale && back <= 21 && rand() < 0.6) {
      drafts.push({ day, unit: sociale, subject: 'Kërkesë për ndihmë ekonomike' });
    }
  }

  const year = today.slice(0, 4);
  return drafts.map(({ day, unit, subject }, index) => {
    const age = daysBetween(day, today);
    const slow = unit.id === 'sociale' && age <= 21;
    const account = `${unit.type === 'agjenci' ? 'agjencia' : 'drejtoria'}.${unit.id}`;
    const history: HistoryEntry[] = [{ at: `${day}T09:00:00`, by: 'operator', action: 'sent', unitId: unit.id }];
    let status: RequestStatus = 'new';
    let completedAt: string | null = null;

    if (age >= 1 && rand() < 0.05) {
      status = 'returned';
      history.push({
        at: `${addDays(day, 1)}T10:00:00`,
        by: account,
        action: 'returned',
        note: 'Nuk është në kompetencën tonë.',
      });
    } else if (age >= 1) {
      const doneChance = slow ? 0.25 : Math.min(0.92, age / (unit.slaDays * 1.1));
      if (rand() < doneChance) {
        status = 'done';
        const took = 1 + Math.floor(rand() * unit.slaDays * (slow ? 1.8 : 1.2));
        completedAt = addDays(day, Math.min(took, age));
      } else if (rand() < 0.65) {
        status = 'in_progress';
      }
      if (status !== 'new') history.push({ at: `${addDays(day, 1)}T10:00:00`, by: account, action: 'started' });
      if (completedAt) history.push({ at: `${completedAt}T14:00:00`, by: account, action: 'completed' });
    }

    return {
      id: firstId + index,
      protocolNo: `K-${year}-${String(firstNumber + index).padStart(4, '0')}`,
      date: day,
      subject,
      unitId: unit.id,
      status,
      deadline: addDays(day, unit.slaDays),
      completedAt,
      source: 'mock',
      createdBy: 'operator',
      history,
    };
  });
}
