import { AlarmClock, ArrowLeft, CheckCircle2, Inbox, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { query } from '../api/client';
import type { RequestItem, Stats } from '../api/types';
import { PeriodPicker } from '../components/Calendar';
import { BarList, WeeklyChart } from '../components/Charts';
import { RequestDrawer } from '../components/RequestDrawer';
import { RequestTable } from '../components/RequestTable';
import { WorkflowSteps, type StepFilter } from '../components/WorkflowSteps';
import { Card, ErrorNote, PageHeader, Segmented, Spinner, StatCard, StatusBadge, cx } from '../components/ui';
import { t } from '../i18n';
import { useApp } from '../lib/AppContext';
import { formatDay, periodLabel, periodRange } from '../lib/dates';
import { deadlineText } from '../lib/labels';
import { useApi } from '../lib/useApi';
import { go } from '../lib/useHashRoute';
import { STATUS_TABS, type StatusFilter } from './RegistryPage';

/**
 * One unit's work: numbers, the workflow, trend, subjects and what needs attention.
 * `own` is the unit's own view (steps open its inbox); otherwise the mayor is looking (read-only, with its register).
 */
export function UnitDashboard({ unitId, own }: { unitId: string; own: boolean }) {
  const { units, period, setPeriod } = useApp();
  const unit = units.find((u) => u.id === unitId);
  const { from, to } = periodRange(period);
  const stats = useApi<Stats>(`/requests/stats${query({ from, to, unitId })}`);
  const list = useApi<RequestItem[]>(`/requests${query({ from, to, unitId })}`);
  const [open, setOpen] = useState<RequestItem | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');

  if (!unit) return <ErrorNote error={t('ud.notFound')} />;
  const s = stats.data;
  const items = list.data ?? [];
  const attention = items
    .filter((r) => r.daysLeft !== null)
    .sort((a, b) => a.daysLeft! - b.daysLeft!)
    .slice(0, 6);

  const pickStep = (step: StepFilter) => {
    if (own) go(`kerkesat/${step}`);
    else {
      setStatus(step);
      document.getElementById('unit-register')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {!own && (
        <a href="#/drejtorite" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} aria-hidden /> {t('units.title')}
        </a>
      )}
      <PageHeader
        title={unit.name}
        subtitle={t('ud.subtitle', { type: t(`type.${unit.type}`), n: unit.slaDays, period: periodLabel(period) })}
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />

      {stats.error && <ErrorNote error={stats.error} />}
      {!s ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('kpi.new')} value={s.new} icon={Inbox} tone="brand" hint={t('kpi.newHint')} onClick={() => pickStep('new')} />
            <StatCard label={t('kpi.inProgress')} value={s.inProgress} icon={PlayCircle} tone="warn" hint={t('kpi.inProgressHint')} onClick={() => pickStep('in_progress')} />
            <StatCard
              label={t('kpi.overdue')}
              value={s.overdue}
              icon={AlarmClock}
              tone={s.overdue ? 'bad' : 'good'}
              hint={s.overdue ? t('kpi.overdueHint') : t('kpi.noOverdue')}
            />
            <StatCard
              label={t('kpi.onTime')}
              value={s.onTimeRate === null ? '–' : `${s.onTimeRate}%`}
              icon={CheckCircle2}
              tone={s.onTimeRate === null ? 'neutral' : s.onTimeRate >= 80 ? 'good' : s.onTimeRate >= 60 ? 'warn' : 'bad'}
              hint={t('kpi.onTimeHint', { n: s.done }) + (s.avgDaysToComplete === null ? '' : t('kpi.avgSuffix', { n: s.avgDaysToComplete }))}
            />
          </div>

          <Card title={t('ud.workflow')} subtitle={own ? t('ud.workflowHint') : undefined}>
            <WorkflowSteps counts={s} onSelect={pickStep} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <Card title={t('chart.byWeek')}>
              <WeeklyChart weeks={s.byWeek} />
            </Card>
            <Card title={t('ud.topSubjects')}>
              {s.topSubjects.length ? (
                <BarList items={s.topSubjects.map((t) => ({ label: t.subject, value: t.total }))} />
              ) : (
                <p className="text-sm text-slate-500">{t('ud.noneInPeriod')}</p>
              )}
            </Card>
          </div>

          <Card title={t('ud.attention')} subtitle={t('ud.attentionHint')} padded={false}>
            {!attention.length ? (
              <p className="px-5 py-6 text-sm text-slate-500">{t('ud.allDone')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {attention.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setOpen(r)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left hover:bg-slate-50">
                      <span className="w-32 font-medium text-slate-900">{r.protocolNo}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.subject}</span>
                      <span className="text-xs text-slate-500">{formatDay(r.date)}</span>
                      <StatusBadge status={r.status} />
                      <span className={cx('w-28 text-right text-sm tabular-nums', r.overdue ? 'font-medium text-red-700' : 'text-slate-600')}>
                        {deadlineText(r)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!own && (
            <div id="unit-register">
              <Card title={t('ud.unitRequests')} padded={false}>
                <div className="border-b border-slate-100 p-4">
                  <Segmented
                    label={t('common.status')}
                    value={status}
                    onChange={setStatus}
                    options={STATUS_TABS.map((s) => ({ id: s.id, label: t(s.labelKey), count: items.filter(s.match).length }))}
                  />
                </div>
                <RequestTable
                  items={items.filter(STATUS_TABS.find((s) => s.id === status)!.match)}
                  showUnit={false}
                  onOpen={setOpen}
                />
              </Card>
            </div>
          )}
        </div>
      )}

      <RequestDrawer
        request={open}
        onClose={() => setOpen(null)}
        onChanged={(r) => {
          setOpen(r);
          list.reload();
          stats.reload();
        }}
      />
    </>
  );
}
