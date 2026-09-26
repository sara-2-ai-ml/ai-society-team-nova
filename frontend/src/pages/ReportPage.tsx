import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bot, CheckCircle2, FileBarChart, Printer, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { query } from '../api/client';
import type { Report } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PeriodPicker } from '../components/Calendar';
import { Button, ErrorNote, PageHeader, Select, Spinner, cx } from '../components/ui';
import { t } from '../i18n';
import { useApp } from '../lib/AppContext';
import { REPORT_PRESETS, formatDateTime, formatDay, periodRange, type Period } from '../lib/dates';
import { useApi } from '../lib/useApi';

const range = (p: { from: string; to: string }) => (p.from === p.to ? formatDay(p.from) : `${formatDay(p.from)} – ${formatDay(p.to)}`);

function Delta({ now, before, suffix = '', invert = false }: { now: number | null; before: number | null; suffix?: string; invert?: boolean }) {
  if (now === null || before === null || now === before) {
    return <span className="text-xs text-slate-500">{before === null ? t('rp.noCompare') : t('rp.noChange')}</span>;
  }
  const up = now > before;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-emerald-700' : 'text-red-700')}>
      <Icon size={14} aria-hidden />
      {t('rp.from', { v: `${before}${suffix}` })}
    </span>
  );
}

function Metric({ label, value, delta }: { label: string; value: ReactNode; delta?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}

function Points({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'warn' | 'act' }) {
  const style = {
    good: { icon: CheckCircle2, color: 'text-emerald-600', bar: 'border-emerald-200' },
    warn: { icon: AlertTriangle, color: 'text-amber-600', bar: 'border-amber-200' },
    act: { icon: ArrowRight, color: 'text-brand-600', bar: 'border-brand-200' },
  }[tone];
  return (
    <section className={cx('border-l-4 pl-4', style.bar)}>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700">
            <style.icon size={16} className={cx('mt-0.5 shrink-0', style.color)} aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Periodic report, weekly by default. The mayor can pick a unit or the whole municipality; a unit sees its own. */
export function ReportPage() {
  const { user } = useAuth();
  const { units } = useApp();
  const mayor = user?.role === 'KRYETARI';
  const [period, setPeriod] = useState<Period>({ preset: 'lastWeek' });
  const [unitId, setUnitId] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const { from, to } = periodRange(period);

  const path = `/reports${query({ from, to, unitId: mayor ? unitId : undefined, refresh: refreshCount ? 'true' : undefined, n: refreshCount ? String(refreshCount) : undefined })}`;
  const report = useApi<Report>(path);
  const r = report.data;
  const m = r?.metrics;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={t('rp.title')}
          subtitle={t('rp.subtitle')}
          actions={
            <>
              <Button variant="secondary" icon={RefreshCw} loading={report.loading && !!r} onClick={() => setRefreshCount((n) => n + 1)}>
                {t('rp.regenerate')}
              </Button>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()} disabled={!r}>
                {t('rp.print')}
              </Button>
            </>
          }
        />
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <PeriodPicker value={period} onChange={(p) => (setPeriod(p), setRefreshCount(0))} presets={REPORT_PRESETS} />
          {mayor && (
            <Select value={unitId} onChange={(e) => (setUnitId(e.target.value), setRefreshCount(0))} aria-label={t('col.unit')} className="md:ml-auto md:w-64">
              <option value="">{t('rp.all')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {report.error && <ErrorNote error={report.error} />}
      {!r || (report.loading && refreshCount > 0 && !report.error) ? (
        !report.error && <Spinner label={t('rp.preparing')} />
      ) : (
        <article className="print-plain mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-8 py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-700 uppercase">
                  <FileBarChart size={15} aria-hidden /> {t('rp.kicker')}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{r.scope.name}</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  {t('rp.period')} <strong>{range(r.period)}</strong> · {t('rp.compared', { p: range(r.previousPeriod) })}
                </p>
              </div>
              <span
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
                  r.generatedBy === 'ai' ? 'bg-violet-50 text-violet-800 ring-violet-200' : 'bg-slate-100 text-slate-700 ring-slate-300',
                )}
                title={r.generatedBy === 'ai' ? t('rp.modelTitle', { m: r.model ?? '' }) : t('rp.keyHint')}
              >
                <Bot size={14} aria-hidden />
                {r.generatedBy === 'ai' ? t('rp.byAi') : t('rp.byAuto')}
              </span>
            </div>
          </header>

          <div className="space-y-8 px-8 py-6">
            <section>
              <p className="text-lg leading-snug font-semibold text-slate-900">{r.narrative.headline}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{r.narrative.summary}</p>
            </section>

            {m && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label={t('rp.requests')} value={m.total} delta={<Delta now={m.total} before={m.previousTotal} invert />} />
                <Metric label={t('rp.done')} value={m.done} delta={<span className="text-xs text-slate-500">{t('rp.stillOpen', { n: m.new + m.inProgress })}</span>} />
                <Metric
                  label={t('rp.onTime')}
                  value={m.onTimeRate === null ? '–' : `${m.onTimeRate}%`}
                  delta={<Delta now={m.onTimeRate} before={m.previousOnTimeRate} suffix="%" />}
                />
                <Metric
                  label={t('rp.lateToday')}
                  value={<span className={m.overdue ? 'text-red-700' : undefined}>{m.overdue}</span>}
                  delta={<span className="text-xs text-slate-500">{m.avgDaysToComplete === null ? '' : t('rp.solvedIn', { n: m.avgDaysToComplete })}</span>}
                />
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <Points title={t('rp.good')} items={r.narrative.highlights} tone="good" />
              <Points title={t('rp.concerns')} items={r.narrative.concerns} tone="warn" />
            </div>
            <Points title={t('rp.recs')} items={r.narrative.recommendations} tone="act" />

            {r.byUnit.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">{t('units.title')}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="py-2 pr-3">{t('col.unit')}</th>
                        <th className="px-3 py-2 text-right">{t('rp.colRequests')}</th>
                        <th className="px-3 py-2 text-right">{t('col.open')}</th>
                        <th className="px-3 py-2 text-right">{t('rp.lateToday')}</th>
                        <th className="py-2 pl-3 text-right">{t('col.onTime')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {r.byUnit.map((u) => (
                        <tr key={u.unitId}>
                          <td className="py-2 pr-3 font-medium text-slate-900">{u.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{u.total}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{u.open}</td>
                          <td className={cx('px-3 py-2 text-right tabular-nums', u.overdue ? 'font-semibold text-red-700' : 'text-slate-400')}>{u.overdue}</td>
                          <td className="py-2 pl-3 text-right tabular-nums">{u.onTimeRate === null ? '–' : `${u.onTimeRate}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">{t('rp.subjects')}</h3>
                {r.topSubjects.length ? (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {r.topSubjects.map((s) => (
                      <li key={s.subject} className="flex justify-between gap-3 py-2">
                        <span className="text-slate-700">{s.subject}</span>
                        <span className="shrink-0 tabular-nums text-slate-900">
                          {s.total} <span className="text-xs text-slate-500">{t('rp.before', { n: s.previous })}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">{t('ud.noneInPeriod')}</p>
                )}
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">{t('rp.lateList')}</h3>
                {r.overdueItems.length ? (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {r.overdueItems.map((o) => (
                      <li key={o.protocolNo} className="flex justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="font-medium text-slate-900">{o.protocolNo}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {o.subject}
                            {mayor && ` · ${o.unit}`}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-red-700">{t('common.days', { n: o.daysLate })}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">{t('rp.noLate')}</p>
                )}
              </section>
            </div>
          </div>

          <footer className="border-t border-slate-200 px-8 py-4 text-xs text-slate-500">
            {t('rp.footer', { at: formatDateTime(r.generatedAt) })}
            {r.generatedBy === 'ai' ? t('rp.footerAi') : '.'}
          </footer>
        </article>
      )}
    </>
  );
}
