import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Stats } from '../api/types';
import { t } from '../i18n';
import { formatShort } from '../lib/dates';

const BRAND = '#2f5f8f';
const DONE = '#10b981';

/** Requests registered per week, and how many of them are already done. */
export function WeeklyChart({ weeks }: { weeks: Stats['byWeek'] }) {
  const data = weeks.map((w) => ({ ...w, label: formatShort(w.week) }));
  return (
    <div className="h-64" role="img" aria-label={t('chart.byWeek')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            labelFormatter={(l) => t('chart.weekOf', { d: String(l) })}
            contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="total" name={t('chart.registered')} fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="done" name={t('chart.completed')} fill={DONE} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars: label, bar, value. Plain HTML so it reads well at any width. */
export function BarList({ items, max }: { items: { label: string; value: number; hint?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">
              {i.value}
              {i.hint && <span className="ml-1 text-xs font-normal text-slate-500">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(i.value / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
