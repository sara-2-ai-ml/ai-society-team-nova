import type { HistoryEntry, RequestItem, RequestStatus } from '../api/types';
import { t } from '../i18n';

export const STATUS_STYLE: Record<RequestStatus, { badge: string; dot: string }> = {
  new: { badge: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  in_progress: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  done: { badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  returned: { badge: 'bg-slate-100 text-slate-700 ring-slate-300', dot: 'bg-slate-400' },
};

export const statusLabel = (s: RequestStatus) => t(`status.${s}`);
export const historyLabel = (a: HistoryEntry['action']) => t(`history.${a}`);

/** "3 ditë afat", "Skadon sot", "5 ditë vonesë" (or the English equivalent). */
export function deadlineText(r: RequestItem): string | null {
  if (r.daysLeft === null) return null;
  if (r.daysLeft < 0) return t('deadline.late', { n: -r.daysLeft });
  if (r.daysLeft === 0) return t('deadline.today');
  return t('deadline.left', { n: r.daysLeft });
}
