import { ArrowRight, Building2, Trees } from 'lucide-react';
import { query } from '../../api/client';
import type { Stats, UnitStats } from '../../api/types';
import { PeriodPicker } from '../../components/Calendar';
import { ErrorNote, PageHeader, Spinner, cx } from '../../components/ui';
import { t } from '../../i18n';
import { useApp } from '../../lib/AppContext';
import { periodLabel, periodRange } from '../../lib/dates';
import { useApi } from '../../lib/useApi';
import { verdict } from './verdict';

function UnitCard({ stats }: { stats: UnitStats }) {
  const { units } = useApp();
  const unit = units.find((u) => u.id === stats.unitId)!;
  const v = verdict(stats);
  return (
    <a
      href={`#/drejtorite/${unit.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-800">{unit.name}</h3>
        <span className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', v.className)}>{v.label}</span>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-slate-50 py-2">
          <dt className="text-xs text-slate-500">{t('col.total')}</dt>
          <dd className="text-xl font-semibold tabular-nums text-slate-800">{stats.total}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 py-2">
          <dt className="text-xs text-slate-500">{t('col.open')}</dt>
          <dd className="text-xl font-semibold tabular-nums text-slate-800">{stats.new + stats.inProgress}</dd>
        </div>
        <div className={cx('rounded-lg py-2', stats.overdue ? 'bg-rose-50' : 'bg-slate-50')}>
          <dt className="text-xs text-slate-500">{t('col.overdue')}</dt>
          <dd className={cx('text-xl font-semibold tabular-nums', stats.overdue ? 'text-rose-700' : 'text-slate-800')}>{stats.overdue}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{t('col.onTime')}</span>
          <span className="tabular-nums">{stats.onTimeRate === null ? '–' : `${stats.onTimeRate}%`}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className={cx('h-2 rounded-full', (stats.onTimeRate ?? 0) >= 80 ? 'bg-emerald-400' : (stats.onTimeRate ?? 0) >= 60 ? 'bg-amber-400' : 'bg-rose-500')}
            style={{ width: `${stats.onTimeRate ?? 0}%` }}
          />
        </div>
      </div>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
        {t('up.open')} <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </a>
  );
}

export function UnitsPage() {
  const { units, period, setPeriod } = useApp();
  const { from, to } = periodRange(period);
  const stats = useApi<Stats>(`/requests/stats${query({ from, to })}`);
  const byType = (type: 'drejtori' | 'agjenci') =>
    (stats.data?.byUnit ?? []).filter((s) => units.find((u) => u.id === s.unitId)?.type === type);

  return (
    <>
      <PageHeader
        title={t('units.title')}
        subtitle={t('up.subtitle', { period: periodLabel(period) })}
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />
      {stats.error && <ErrorNote error={stats.error} />}
      {!stats.data ? (
        <Spinner />
      ) : (
        <div className="space-y-8">
          {[
            { title: t('units.departments'), icon: Building2, list: byType('drejtori') },
            { title: t('units.agencies'), icon: Trees, list: byType('agjenci') },
          ].map((g) => (
            <section key={g.title}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
                <g.icon size={16} aria-hidden /> {g.title}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {g.list.map((s) => (
                  <UnitCard key={s.unitId} stats={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
