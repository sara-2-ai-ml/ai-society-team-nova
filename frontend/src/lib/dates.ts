// Calendar days as 'YYYY-MM-DD', the same format the API uses.
import { getLang, t, type Key } from '../i18n';

const MONTHS = {
  sq: ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const WEEKDAYS = {
  sq: ['Hë', 'Ma', 'Më', 'En', 'Pr', 'Sh', 'Di'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
};

export const monthName = (index: number) => MONTHS[getLang()][index];
/** Monday first. */
export const weekdayNames = () => WEEKDAYS[getLang()];

export function toDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const today = () => toDay(new Date());

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** 2026-09-14 → 14.09.2026 (both languages: the format used in Albanian documents). */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '–';
  const [y, m, d] = day.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** 2026-09-14 → 14 Sht / 14 Sep */
export function formatShort(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(d)} ${monthName(Number(m) - 1).slice(0, 3)}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDay(toDay(d))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'all' | 'thisWeek' | 'lastWeek' | 'custom';

export interface Period {
  preset: PeriodPreset;
  from?: string;
  to?: string;
}

export type PresetOption = { id: Exclude<PeriodPreset, 'custom'>; labelKey: Key };

export const PERIOD_PRESETS: PresetOption[] = [
  { id: 'today', labelKey: 'preset.today' },
  { id: '7d', labelKey: 'preset.7d' },
  { id: '30d', labelKey: 'preset.30d' },
  { id: 'month', labelKey: 'preset.month' },
  { id: 'all', labelKey: 'preset.all' },
];

/** Reports are usually weekly: Monday to Sunday. */
export const REPORT_PRESETS: PresetOption[] = [
  { id: 'lastWeek', labelKey: 'preset.lastWeek' },
  { id: 'thisWeek', labelKey: 'preset.thisWeek' },
  { id: '7d', labelKey: 'preset.last7' },
  { id: 'month', labelKey: 'preset.month' },
];

/** Monday of the week the day falls in. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return addDays(day, -((d.getDay() + 6) % 7));
}

/** The from/to days a period covers (undefined = no limit). */
export function periodRange(p: Period): { from?: string; to?: string } {
  const now = today();
  switch (p.preset) {
    case 'today':
      return { from: now, to: now };
    case '7d':
      return { from: addDays(now, -6), to: now };
    case '30d':
      return { from: addDays(now, -29), to: now };
    case 'month':
      return { from: `${now.slice(0, 7)}-01`, to: now };
    case 'thisWeek':
      return { from: weekStart(now), to: now };
    case 'lastWeek':
      return { from: addDays(weekStart(now), -7), to: addDays(weekStart(now), -1) };
    case 'custom':
      return { from: p.from, to: p.to };
    default:
      return {};
  }
}

export function periodLabel(p: Period): string {
  if (p.preset !== 'custom') return t([...PERIOD_PRESETS, ...REPORT_PRESETS].find((x) => x.id === p.preset)!.labelKey);
  if (p.from && p.to) return p.from === p.to ? formatDay(p.from) : `${formatDay(p.from)} – ${formatDay(p.to)}`;
  if (p.from) return t('period.from', { d: formatDay(p.from) });
  if (p.to) return t('period.to', { d: formatDay(p.to) });
  return t('preset.all');
}
