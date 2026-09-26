import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import {
  PERIOD_PRESETS,
  formatDay,
  monthName,
  periodLabel,
  toDay,
  today,
  weekdayNames,
  type Period,
  type PresetOption,
} from '../lib/dates';
import { cx } from './ui';

/** A month grid. Highlights `value`, or the range from–to. Days after `max` cannot be picked. */
export function Calendar({
  value,
  from,
  to,
  max,
  onSelect,
}: {
  value?: string;
  from?: string;
  to?: string;
  max?: string;
  onSelect: (day: string) => void;
}) {
  const start = value ?? to ?? from ?? today();
  const [month, setMonth] = useState(() => new Date(`${start.slice(0, 7)}-01T12:00:00`));
  const year = month.getFullYear();
  const m = month.getMonth();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(year, m + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => toDay(new Date(year, m, i + 1)))];
  const now = today();
  const shift = (n: number) => setMonth(new Date(year, m + n, 1, 12));

  return (
    <div className="w-72 select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label={t('cal.prevMonth')}>
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {monthName(m)} {year}
        </span>
        <button type="button" onClick={() => shift(1)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label={t('cal.nextMonth')}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekdayNames().map((d) => (
          <span key={d} className="py-1 text-xs font-medium text-slate-400">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const disabled = !!max && day > max;
          const selected = day === value || day === from || day === to;
          const inRange = !!from && !!to && day > from && day < to;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(day)}
              aria-pressed={selected}
              aria-label={formatDay(day)}
              className={cx(
                'h-9 rounded-md text-sm tabular-nums transition',
                selected
                  ? 'bg-brand-700 font-semibold text-white'
                  : inRange
                    ? 'bg-brand-50 text-brand-800'
                    : disabled
                      ? 'text-slate-300'
                      : 'text-slate-700 hover:bg-slate-100',
                day === now && !selected && 'font-semibold text-brand-700 ring-1 ring-inset ring-brand-200',
              )}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Closes on outside click or Escape. */
function Popover({ open, onClose, children, align = 'left' }: { open: boolean; onClose: () => void; children: ReactNode; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cx(
        'absolute top-full z-30 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      {children}
    </div>
  );
}

export function DatePicker({ value, onChange, max }: { value: string; onChange: (day: string) => void; max?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 hover:border-slate-400"
      >
        <CalendarDays size={16} className="text-slate-500" aria-hidden />
        {formatDay(value)}
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <Calendar
          value={value}
          max={max}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
        <div className="mt-3 flex justify-between border-t border-slate-100 pt-3">
          <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => (onChange(today()), setOpen(false))}>
            {t('cal.today')}
          </button>
        </div>
      </Popover>
    </div>
  );
}

/** Quick periods (today, 7 days…) plus a calendar for any from–to range. */
export function PeriodPicker({
  value,
  onChange,
  presets = PERIOD_PRESETS,
}: {
  value: Period;
  onChange: (p: Period) => void;
  presets?: PresetOption[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: string; to?: string }>({});

  const pick = (day: string) => {
    if (!draft.from || draft.to) setDraft({ from: day });
    else setDraft(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day });
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <div role="group" aria-label={t('common.period')} className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={value.preset === p.id}
            onClick={() => onChange({ preset: p.id })}
            className={cx(
              'rounded-md px-3 py-1.5 text-sm transition',
              value.preset === p.id ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setDraft(value.preset === 'custom' ? { from: value.from, to: value.to } : {});
            setOpen((o) => !o);
          }}
          aria-expanded={open}
          className={cx(
            'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition',
            value.preset === 'custom'
              ? 'border-brand-300 bg-brand-50 font-medium text-brand-800'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          <CalendarDays size={16} aria-hidden />
          {value.preset === 'custom' ? periodLabel(value) : t('cal.pickDates')}
        </button>
        <Popover open={open} onClose={() => setOpen(false)} align="right">
          <p className="mb-3 text-xs text-slate-500">
            {!draft.from ? t('cal.pickStart') : !draft.to ? t('cal.pickEnd') : t('cal.picked')}
          </p>
          <Calendar from={draft.from} to={draft.to} max={today()} onSelect={pick} />
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-700">
              {draft.from ? `${formatDay(draft.from)} – ${draft.to ? formatDay(draft.to) : '…'}` : '–'}
            </span>
            <button
              type="button"
              disabled={!draft.from}
              onClick={() => {
                onChange({ preset: 'custom', from: draft.from, to: draft.to ?? draft.from });
                setOpen(false);
              }}
              className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:bg-slate-300"
            >
              {t('cal.apply')}
            </button>
          </div>
        </Popover>
      </div>
    </div>
  );
}
