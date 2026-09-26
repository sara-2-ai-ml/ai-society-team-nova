import { AlarmClock, ArrowRight, CheckCircle2, CornerUpLeft, FileText, FolderOpen, Inbox, ThumbsUp, type LucideIcon } from 'lucide-react';
import { query } from '../../api/client';
import type { Stats, UnitStats } from '../../api/types';
import { PeriodPicker } from '../../components/Calendar';
import { BarList, WeeklyChart } from '../../components/Charts';
import { Progress } from '../../components/ui/progress';
import { Card, ErrorNote, PageHeader, Spinner, StatCard, cx } from '../../components/ui';
import { t } from '../../i18n';
import { useApp } from '../../lib/AppContext';
import { greeting, periodLabel, periodRange } from '../../lib/dates';
import { useApi } from '../../lib/useApi';
import { go } from '../../lib/useHashRoute';
import { verdict } from './verdict';

interface Insight {
  icon: LucideIcon;
  tone: string;
  line: string;
  sub?: string;
  to?: string;
}

/** Up to three plain sentences about what needs the mayor's attention, most urgent first. */
function insights(s: Stats, short: (id: string) => string): Insight[] {
  const list: Insight[] = [];
  const worst = [...s.byUnit].sort((a, b) => b.overdue - a.overdue)[0];
  if (s.overdue > 0) {
    list.push({
      icon: AlarmClock,
      tone: 'bg-rose-50 text-rose-600',
      line: t('ov.lateLine', { n: s.overdue }),
      sub: worst?.overdue ? t('ov.lateMost', { unit: short(worst.unitId), k: worst.overdue }) : undefined,
      to: 'regjistri/overdue',
    });
  }
  if (s.new > 0) {
    list.push({ icon: Inbox, tone: 'bg-sky-50 text-sky-600', line: t('ov.newLine', { n: s.new }), sub: t('ov.newSub'), to: 'regjistri/new' });
  }
  if (s.returned > 0) {
    list.push({
      icon: CornerUpLeft,
      tone: 'bg-amber-50 text-amber-600',
      line: t('ov.returnedLine', { n: s.returned }),
      sub: t('ov.returnedSub'),
      to: 'regjistri/returned',
    });
  }
  const best = s.byUnit.filter((u) => u.onTimeRate !== null && u.done >= 3).sort((a, b) => b.onTimeRate! - a.onTimeRate!)[0];
  if (best && list.length < 3) {
    list.push({
      icon: ThumbsUp,
      tone: 'bg-emerald-50 text-emerald-600',
      line: t('ov.bestLine', { unit: short(best.unitId), n: best.onTimeRate! }),
      sub: t('ov.bestSub'),
      to: `drejtorite/${best.unitId}`,
    });
  }
  return list.slice(0, 3);
}

function UnitRow({ u }: { u: UnitStats }) {
  const { units } = useApp();
  const unit = units.find((x) => x.id === u.unitId);
  const v = verdict(u);
  const rate = u.onTimeRate;
  return (
    <button
      onClick={() => go(`drejtorite/${u.unitId}`)}
      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-800">{unit?.short}</span>
        <span className="block text-xs text-slate-500">{t('ov.unitLine', { open: u.new + u.inProgress, late: u.overdue })}</span>
      </span>
      <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', v.className)}>{v.label}</span>
      <span className="col-span-2 flex items-center gap-3">
        <Progress
          value={rate ?? 0}
          className={cx(
            'h-1.5 bg-slate-100',
            rate === null
              ? ''
              : rate >= 80
                ? '[&>[data-slot=progress-indicator]]:bg-emerald-400'
                : rate >= 60
                  ? '[&>[data-slot=progress-indicator]]:bg-amber-400'
                  : '[&>[data-slot=progress-indicator]]:bg-rose-400',
          )}
          aria-label={t('col.onTime')}
        />
        <span className="w-24 shrink-0 text-right text-xs text-slate-500 tabular-nums">
          {rate === null ? '–' : t('ov.onTimeShort', { n: rate })}
        </span>
      </span>
    </button>
  );
}

export function OverviewPage() {
  const { units, period, setPeriod } = useApp();
  const { from, to } = periodRange(period);
  const stats = useApi<Stats>(`/requests/stats${query({ from, to })}`);
  const s = stats.data;
  const short = (id: string) => units.find((u) => u.id === id)?.short ?? id;
  const byType = (type: 'drejtori' | 'agjenci') => (s?.byUnit ?? []).filter((u) => units.find((x) => x.id === u.unitId)?.type === type);

  return (
    <>
      <PageHeader
        title={greeting()}
        subtitle={t('ov.greetSub', { period: periodLabel(period) })}
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />
      {stats.error && <ErrorNote error={stats.error} />}
      {!s ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <Card title={t('ov.todayTitle')} subtitle={t('ov.todaySub')} padded={false}>
            {(() => {
              const list = insights(s, short);
              if (!list.length) return <p className="px-6 py-5 text-sm text-slate-600">{t('ov.allGood')}</p>;
              return (
                <ul className="divide-y divide-slate-100">
                  {list.map((i) => (
                    <li key={i.line} className="flex items-center gap-4 px-6 py-4">
                      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', i.tone)}>
                        <i.icon size={18} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-800">{i.line}</span>
                        {i.sub && <span className="block text-sm text-slate-500">{i.sub}</span>}
                      </span>
                      {i.to && (
                        <button
                          onClick={() => go(i.to!)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                        >
                          {t('common.view')} <ArrowRight size={15} aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('kpi.total')} value={s.total} icon={FileText} tone="brand" hint={t('kpi.totalHint')} onClick={() => go('regjistri')} />
            <StatCard
              label={t('kpi.open')}
              value={s.new + s.inProgress}
              icon={FolderOpen}
              hint={t('kpi.openHint2', { a: s.new, b: s.inProgress })}
            />
            <StatCard
              label={t('kpi.overdue')}
              value={s.overdue}
              icon={AlarmClock}
              tone={s.overdue ? 'bad' : 'good'}
              hint={s.overdue ? t('kpi.lateHint') : t('kpi.lateNone')}
              onClick={() => go('regjistri/overdue')}
            />
            <StatCard
              label={t('kpi.onTime')}
              value={s.onTimeRate === null ? '–' : `${s.onTimeRate}%`}
              icon={CheckCircle2}
              tone={s.onTimeRate === null ? 'neutral' : s.onTimeRate >= 80 ? 'good' : 'warn'}
              hint={s.avgDaysToComplete === null ? t('kpi.onTimeHintNoAvg') : t('kpi.onTimeHint2', { n: s.avgDaysToComplete })}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {[
              { title: t('units.departments'), list: byType('drejtori') },
              { title: t('units.agencies'), list: byType('agjenci') },
            ].map((g) => (
              <Card key={g.title} title={g.title} subtitle={t('ov.unitsSub')} padded={false}>
                <div className="p-3">
                  {g.list.map((u) => (
                    <UnitRow key={u.unitId} u={u} />
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <Card title={t('ov.chartTitle')} subtitle={t('ov.chartSub')}>
              <WeeklyChart weeks={s.byWeek} />
            </Card>
            <Card title={t('ud.topSubjects')} subtitle={t('ov.subjectsSub')}>
              <BarList items={s.topSubjects.map((x) => ({ label: x.subject, value: x.total }))} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
