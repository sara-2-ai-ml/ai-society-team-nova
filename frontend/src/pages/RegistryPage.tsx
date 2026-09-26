import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { query } from '../api/client';
import type { RequestItem } from '../api/types';
import { PeriodPicker } from '../components/Calendar';
import { RequestDrawer } from '../components/RequestDrawer';
import { RequestTable } from '../components/RequestTable';
import { Card, ErrorNote, Input, PageHeader, Segmented, Select, Spinner } from '../components/ui';
import { useApp } from '../lib/AppContext';
import { t, type Key } from '../i18n';
import { periodLabel, periodRange } from '../lib/dates';
import { useApi } from '../lib/useApi';

export type StatusFilter = 'all' | 'new' | 'in_progress' | 'done' | 'returned' | 'overdue';

export const STATUS_TABS: { id: StatusFilter; labelKey: Key; match: (r: RequestItem) => boolean }[] = [
  { id: 'all', labelKey: 'tab.all', match: () => true },
  { id: 'new', labelKey: 'tab.new', match: (r) => r.status === 'new' },
  { id: 'in_progress', labelKey: 'tab.in_progress', match: (r) => r.status === 'in_progress' },
  { id: 'done', labelKey: 'tab.done', match: (r) => r.status === 'done' },
  { id: 'returned', labelKey: 'tab.returned', match: (r) => r.status === 'returned' },
  { id: 'overdue', labelKey: 'tab.overdue', match: (r) => r.overdue },
];

/** Search box that waits for the person to stop typing before filtering. */
export function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function RegistryPage({ initialStatus }: { initialStatus?: string }) {
  const { units, period, setPeriod } = useApp();
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState<StatusFilter>(
    STATUS_TABS.some((t) => t.id === initialStatus) ? (initialStatus as StatusFilter) : 'all',
  );
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [open, setOpen] = useState<RequestItem | null>(null);

  const { from, to } = periodRange(period);
  const list = useApi<RequestItem[]>(`/requests${query({ from, to, unitId, q })}`);
  const items = list.data ?? [];
  const tab = STATUS_TABS.find((t) => t.id === status)!;

  return (
    <>
      <PageHeader
        title={t('regy.title')}
        subtitle={t('regy.subtitle', { period: periodLabel(period) })}
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <Segmented
            label={t('common.status')}
            value={status}
            onChange={setStatus}
            options={STATUS_TABS.map((s) => ({ id: s.id, label: t(s.labelKey), count: items.filter(s.match).length }))}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label={t('common.unit')} className="sm:w-56">
              <option value="">{t('common.allUnits')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.short}
                </option>
              ))}
            </Select>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.searchPlaceholder')}
                aria-label={t('common.search')}
                className="pl-9 sm:w-60"
              />
            </div>
          </div>
        </div>
        {list.error ? (
          <div className="p-5">
            <ErrorNote error={list.error} />
          </div>
        ) : !list.data ? (
          <Spinner />
        ) : (
          <RequestTable items={items.filter(tab.match)} onOpen={setOpen} />
        )}
      </Card>

      <RequestDrawer
        request={open}
        onClose={() => setOpen(null)}
        onChanged={(r) => {
          setOpen(r);
          list.reload();
        }}
      />
    </>
  );
}
