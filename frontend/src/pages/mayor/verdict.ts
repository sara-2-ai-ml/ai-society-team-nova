import type { UnitStats } from '../../api/types';
import { t } from '../../i18n';

/** A plain-language judgement of how a unit is doing, from its delays and on-time rate. */
export function verdict(u: UnitStats): { label: string; className: string } {
  if (u.overdue >= 3 || (u.overdue > 0 && u.onTimeRate !== null && u.onTimeRate < 70)) {
    return { label: t('verdict.attention'), className: 'bg-red-50 text-red-700 ring-red-200' };
  }
  if (u.overdue > 0 || (u.onTimeRate !== null && u.onTimeRate < 70)) return { label: t('verdict.follow'), className: 'bg-amber-50 text-amber-800 ring-amber-200' };
  return { label: t('verdict.ok'), className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
}
