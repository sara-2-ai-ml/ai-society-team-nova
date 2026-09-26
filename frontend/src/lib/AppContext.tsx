import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Unit } from '../api/types';
import { getLang } from '../i18n';
import type { Period } from './dates';

interface AppState {
  units: Unit[];
  unitName: (id: string | null | undefined) => string;
  /** The period chosen in the period picker, kept while moving between pages. */
  period: Period;
  setPeriod: (p: Period) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ units: raw, children }: { units: Unit[]; children: ReactNode }) {
  // Unit names in the active language, so every page can use `name` and `short` as they are.
  const units = getLang() === 'en' ? raw.map((u) => ({ ...u, name: u.nameEn, short: u.shortEn })) : raw;
  const [period, setPeriod] = useState<Period>({ preset: 'all' });
  const unitName = (id: string | null | undefined) => units.find((u) => u.id === id)?.name ?? id ?? '–';
  return <AppContext.Provider value={{ units, unitName, period, setPeriod }}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
