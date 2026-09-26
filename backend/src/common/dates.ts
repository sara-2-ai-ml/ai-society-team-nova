// Dates are plain calendar days as 'YYYY-MM-DD' strings, compared as text.

export function today(): string {
  return toDay(new Date());
}

export function toDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toDay(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);
}

/** Monday of the week the day falls in. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return addDays(day, -((d.getDay() + 6) % 7));
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(d.getTime()) && toDay(d) === value;
}

/**
 * Reads a day from what people type or Excel stores: a Date, an Excel serial number,
 * 'YYYY-MM-DD', or 'DD.MM.YYYY' / 'DD/MM/YYYY' / 'DD-MM-YYYY'. Returns null if unreadable.
 */
export function parseDay(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // Excel dates arrive as UTC midnight.
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    return new Date(Math.round((value - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  const text = String(value ?? '').trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return checked(iso[1], iso[2], iso[3]);
  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) return checked(dmy[3], dmy[2], dmy[1]);
  return null;
}

function checked(y: string, m: string, d: string): string | null {
  const day = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isValidDay(day) ? day : null;
}
