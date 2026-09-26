import { Fragment, createContext, useContext, useState, type ReactNode } from 'react';
import { en } from './en';
import { sq, type Dict } from './sq';

export type Lang = 'sq' | 'en';
export type Key = keyof Dict;
type Vars = Record<string, string | number>;

const DICTS: Record<Lang, Dict> = { sq, en };
const STORAGE_KEY = 'nova-lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'sq';
  } catch {
    return 'sq';
  }
}

let current: Lang = readLang();
applyToDocument();

function applyToDocument() {
  document.documentElement.lang = current;
  document.title = DICTS[current]['app.title'] as string;
}

/** The active language; also sent to the API so its messages match. */
export const getLang = (): Lang => current;

/** Text for `key` in the active language, with {name} placeholders filled from `vars`. */
export function t(key: Key, vars: Vars = {}): string {
  const entry = DICTS[current][key] as string | ((v: Vars) => string);
  const text = typeof entry === 'function' ? entry(vars) : entry;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void } | null>(null);

/** Holds the language. Changing it remounts the app, so every text and date re-renders in the new language. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  const setLang = (l: Lang) => {
    current = l;
    applyToDocument();
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    setLangState(l);
  };
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}

/** SQ | EN switch. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label={t('lang.label')} className={`inline-flex rounded-lg bg-slate-100 p-0.5 text-xs ${className ?? ''}`}>
      {(['sq', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={
            lang === l
              ? 'rounded-md bg-white px-2.5 py-1 font-semibold text-slate-900 shadow-sm'
              : 'rounded-md px-2.5 py-1 font-medium text-slate-500 hover:text-slate-900'
          }
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
