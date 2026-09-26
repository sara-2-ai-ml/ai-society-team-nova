import { AlarmClock, CheckCircle2, FileText, FolderOpen } from 'lucide-react';
import { query } from '../../api/client';
import type { Stats } from '../../api/types';
import { PeriodPicker } from '../../components/Calendar';
import { BarList, WeeklyChart } from '../../components/Charts';
import { WorkflowSteps } from '../../components/WorkflowSteps';
import { Card, ErrorNote, PageHeader, Spinner, StatCard, cx } from '../../components/ui';
import { t } from '../../i18n';
import { useApp } from '../../lib/AppContext';
import { periodLabel, periodRange } from '../../lib/dates';
import { useApi } from '../../lib/useApi';
import { go } from '../../lib/useHashRoute';
import { verdict } from './verdict';

export function OverviewPage() {
  const { units, period, setPeriod } = useApp();
  const { from, to } = periodRange(period);
  const stats = useApi<Stats>(`/requests/stats${query({ from, to })}`);
  const s = stats.data;
  const unit = (id: string) => units.find((u) => u.id === id);

  const worst = s?.byUnit.find((u) => u.overdue > 0);

  return (
    <>
      <PageHeader
        title={t('ov.title')}
        subtitle={t('ov.subtitle', { period: periodLabel(period) })}
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />
      {stats.error && <ErrorNote error={stats.error} />}
      {!s ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <p className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-4 text-[15px] text-brand-900">
            <strong>{t('ov.sumRequests', { n: s.total })}</strong>
            {t('ov.sumPeriod')}
            {s.onTimeRate !== null && (
              <>{t('ov.sumOnTime', { n: s.onTimeRate })}</>
            )}
            .{' '}
            {worst ? (
              <>
                <strong className="text-red-700">{t('ov.sumLate', { n: s.overdue })}</strong>
                {t('ov.sumMost')}{' '}
                <a href={`#/drejtorite/${worst.unitId}`} className="font-semibold underline">
                  {unit(worst.unitId)?.short}
                </a>{' '}
                ({worst.overdue}).
              </>
            ) : (
              t('ov.sumNoLate')
            )}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('kpi.total')} value={s.total} icon={FileText} tone="brand" onClick={() => go('regjistri')} />
            <StatCard label={t('kpi.open')} value={s.new + s.inProgress} icon={FolderOpen} hint={t('kpi.openHint', { a: s.new, b: s.inProgress })} />
            <StatCard
              label={t('kpi.overdue')}
              value={s.overdue}
              icon={AlarmClock}
              tone={s.overdue ? 'bad' : 'good'}
              onClick={() => go('regjistri/overdue')}
            />
            <StatCard
              label={t('kpi.onTime')}
              value={s.onTimeRate === null ? '–' : `${s.onTimeRate}%`}
              icon={CheckCircle2}
              tone={s.onTimeRate === null ? 'neutral' : s.onTimeRate >= 80 ? 'good' : 'warn'}
              hint={s.avgDaysToComplete === null ? undefined : t('kpi.avg', { n: s.avgDaysToComplete })}
            />
          </div>

          <Card title={t('ud.workflow')} subtitle={t('ov.workflowHint')}>
            <WorkflowSteps counts={s} onSelect={(step) => go(`regjistri/${step}`)} />
          </Card>

          <Card title={t('units.title')} subtitle={t('ov.unitsHint')} padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-3">{t('col.unit')}</th>
                    <th className="px-3 py-3 text-right">{t('col.total')}</th>
                    <th className="px-3 py-3 text-right">{t('col.open')}</th>
                    <th className="px-3 py-3 text-right">{t('col.overdue')}</th>
                    <th className="px-3 py-3">{t('col.onTime')}</th>
                    <th className="px-5 py-3">{t('col.state')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {s.byUnit.map((u) => {
                    const v = verdict(u);
                    return (
                      <tr
                        key={u.unitId}
                        onClick={() => go(`drejtorite/${u.unitId}`)}
                        onKeyDown={(e) => e.key === 'Enter' && go(`drejtorite/${u.unitId}`)}
                        tabIndex={0}
                        className="cursor-pointer hover:bg-brand-50/40 focus:bg-brand-50/60 focus:outline-none"
                      >
                        <td className="px-5 py-3">
                          <span className="block font-medium whitespace-nowrap text-slate-900">{unit(u.unitId)?.short}</span>
                          <span className="block text-xs text-slate-500">{t(`type.${unit(u.unitId)?.type ?? 'drejtori'}`)}</span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{u.total}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{u.new + u.inProgress}</td>
                        <td className={cx('px-3 py-3 text-right tabular-nums', u.overdue ? 'font-semibold text-red-700' : 'text-slate-400')}>
                          {u.overdue}
                        </td>
                        <td className="px-3 py-3">
                          {u.onTimeRate === null ? (
                            <span className="text-slate-400">–</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-24 rounded-full bg-slate-100">
                                <span
                                  className={cx('block h-2 rounded-full', u.onTimeRate >= 80 ? 'bg-emerald-500' : u.onTimeRate >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                                  style={{ width: `${u.onTimeRate}%` }}
                                />
                              </span>
                              <span className="tabular-nums">{u.onTimeRate}%</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', v.className)}>{v.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <Card title={t('chart.byWeek')}>
              <WeeklyChart weeks={s.byWeek} />
            </Card>
            <Card title={t('ud.topSubjects')}>
              <BarList items={s.topSubjects.map((t) => ({ label: t.subject, value: t.total }))} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
