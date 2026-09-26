import { FileText } from 'lucide-react';
import { useState } from 'react';
import type { RequestItem } from '../api/types';
import { t } from '../i18n';
import { useApp } from '../lib/AppContext';
import { formatDay } from '../lib/dates';
import { deadlineText } from '../lib/labels';
import { EmptyState, StatusBadge, cx } from './ui';

const PAGE = 25;

export function RequestTable({
  items,
  showUnit = true,
  onOpen,
  emptyText = t('table.emptyText'),
}: {
  items: RequestItem[];
  showUnit?: boolean;
  onOpen: (r: RequestItem) => void;
  emptyText?: string;
}) {
  const { units } = useApp();
  const [shown, setShown] = useState(PAGE);
  if (!items.length) return <EmptyState icon={FileText} title={t('table.empty')} text={emptyText} />;

  const short = (id: string) => units.find((u) => u.id === id)?.short ?? id;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">{t('table.number')}</th>
              <th className="px-3 py-3">{t('table.subject')}</th>
              {showUnit && <th className="px-3 py-3">{t('table.sentTo')}</th>}
              <th className="px-3 py-3">{t('common.status')}</th>
              <th className="px-4 py-3 text-right">{t('table.deadline')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.slice(0, shown).map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(r))}
                tabIndex={0}
                className="cursor-pointer hover:bg-brand-50/40 focus:bg-brand-50/60 focus:outline-none"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="block font-medium text-slate-800">{r.protocolNo}</span>
                  <span className="block text-xs text-slate-500 tabular-nums">{formatDay(r.date)}</span>
                </td>
                <td className="min-w-[180px] px-3 py-3 text-slate-800">
                  <span className="line-clamp-2" title={r.subject}>
                    {r.subject}
                  </span>
                </td>
                {showUnit && <td className="px-3 py-3 whitespace-nowrap text-slate-600">{short(r.unitId)}</td>}
                <td className="px-3 py-3">
                  <StatusBadge status={r.status} overdue={r.overdue} />
                </td>
                <td
                  className={cx(
                    'px-4 py-3 text-right whitespace-nowrap tabular-nums',
                    r.overdue ? 'font-medium text-rose-700' : 'text-slate-500',
                  )}
                >
                  {deadlineText(r) ?? formatDay(r.deadline)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span>{t('table.count', { shown: Math.min(shown, items.length), total: items.length })}</span>
        {shown < items.length && (
          <button className="font-medium text-brand-700 hover:underline" onClick={() => setShown((s) => s + PAGE)}>
            {t('table.more')}
          </button>
        )}
      </div>
    </div>
  );
}
