import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { query } from '../../api/client';
import type { RequestItem } from '../../api/types';
import { PeriodPicker } from '../../components/Calendar';
import { RequestDrawer } from '../../components/RequestDrawer';
import { RequestTable } from '../../components/RequestTable';
import { Card, ErrorNote, Input, PageHeader, Segmented, Spinner } from '../../components/ui';
import { t } from '../../i18n';
import { useApp } from '../../lib/AppContext';
import { periodLabel, periodRange } from '../../lib/dates';
import { useApi } from '../../lib/useApi';
import { STATUS_TABS, useDebounced, type StatusFilter } from '../RegistryPage';

// Work order: new first, then in progress; each tab sorted by the closest deadline.
const INBOX_TABS = ['new', 'in_progress', 'overdue', 'done', 'returned', 'all'] as const;

export function InboxPage({ unitId, initialStatus }: { unitId: string; initialStatus?: string }) {
  const { unitName, period, setPeriod } = useApp();
  const [status, setStatus] = useState<StatusFilter>(
    INBOX_TABS.includes(initialStatus as (typeof INBOX_TABS)[number]) ? (initialStatus as StatusFilter) : 'new',
  );
  useEffect(() => {
    if (initialStatus && INBOX_TABS.includes(initialStatus as (typeof INBOX_TABS)[number])) setStatus(initialStatus as StatusFilter);
  }, [initialStatus]);
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [open, setOpen] = useState<RequestItem | null>(null);
  const { from, to } = periodRange(period);
  const list = useApi<RequestItem[]>(`/requests${query({ from, to, q })}`);
  const items = list.data ?? [];

  const tabs = INBOX_TABS.map((id) => STATUS_TABS.find((s) => s.id === id)!);
  const tab = tabs.find((s) => s.id === status)!;
  const shown = items.filter(tab.match);
  if (status === 'new' || status === 'in_progress' || status === 'overdue') {
    shown.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  }

  return (
    <>
      <PageHeader
        title={t('inbox.title')}
        subtitle={t('inbox.subtitle', { unit: unitName(unitId), period: periodLabel(period) })}
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <Segmented
            label={t('common.status')}
            value={status}
            onChange={setStatus}
            options={tabs.map((s) => ({ id: s.id, label: t(s.labelKey), count: items.filter(s.match).length }))}
          />
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.searchPlaceholder')}
              aria-label={t('common.search')}
              className="pl-9 sm:w-72"
            />
          </div>
        </div>
        {list.error ? (
          <div className="p-5">
            <ErrorNote error={list.error} />
          </div>
        ) : !list.data ? (
          <Spinner />
        ) : (
          <RequestTable
            items={shown}
            showUnit={false}
            onOpen={setOpen}
            emptyText={status === 'new' ? t('inbox.emptyNew') : undefined}
          />
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
