import { Bot, Database, SendHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { AiStatus, AssistantAnswer } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Card, PageHeader, cx } from '../components/ui';
import { t } from '../i18n';
import { useApp } from '../lib/AppContext';
import { useApi } from '../lib/useApi';

interface Message {
  from: 'user' | 'assistant';
  text: string;
  facts?: AssistantAnswer['facts'];
}

export function AssistantPage() {
  const { user } = useAuth();
  const { unitName } = useApp();
  const initial = useApi<string[]>('/assistant/suggestions');
  const status = useApi<AiStatus>('/ai/status');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial.data) setSuggestions(initial.data);
  }, [initial.data]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    setMessages((m) => [...m, { from: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await api<AssistantAnswer>('/assistant/ask', { method: 'POST', json: { question: q } });
      setMessages((m) => [...m, { from: 'assistant', text: res.answer, facts: res.facts }]);
      setSuggestions(res.suggestions);
    } catch (e) {
      setMessages((m) => [...m, { from: 'assistant', text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(text);
  };

  const scope = user?.role === 'DREJTORIA' ? unitName(user.unitId) : t('as.scopeAll');

  return (
    <>
      <PageHeader
        title={t('as.title')}
        subtitle={t('as.subtitle', { scope })}
      />
      {status.data && <AiStatusBar status={status.data} />}
      <Card padded={false} className="flex min-h-[560px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Sparkles size={22} aria-hidden />
              </span>
              <p className="font-medium text-slate-800">{t('as.emptyTitle')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('as.emptyText')}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cx('flex gap-3', m.from === 'user' && 'justify-end')}>
              {m.from === 'assistant' && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white" aria-hidden>
                  <Bot size={16} />
                </span>
              )}
              <div
                className={cx(
                  'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                  m.from === 'user' ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800',
                )}
              >
                <p className="whitespace-pre-line">{m.text}</p>
                {!!m.facts?.length && (
                  <dl className="mt-3 divide-y divide-slate-200 rounded-lg bg-white px-3">
                    {m.facts.map((f) => (
                      <div key={f.label} className="flex justify-between gap-4 py-2">
                        <dt className="text-slate-600">{f.label}</dt>
                        <dd className="font-medium whitespace-nowrap text-slate-900 tabular-nums">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          ))}
          {busy && <p className="pl-11 text-sm text-slate-500">{t('as.thinking')}</p>}
          <div ref={end} />
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={busy}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('as.placeholder')}
              aria-label={t('as.question')}
              maxLength={500}
              className="h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim() || busy}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-300"
              aria-label={t('as.send')}
            >
              <SendHorizontal size={18} />
            </button>
          </form>
        </div>
      </Card>
    </>
  );
}

/** Whether answers come from the AI, and where the data comes from. */
export function AiStatusBar({ status }: { status: AiStatus }) {
  const on = status.pythonReachable && status.configured;
  const label = on ? t('ai.on', { model: status.model ?? '' }) : status.pythonReachable ? t('ai.noKey') : t('ai.noPython');
  return (
    <div className="mb-4 flex flex-wrap gap-2 text-xs">
      <span
        className={cx(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ring-1 ring-inset',
          on ? 'bg-violet-50 text-violet-800 ring-violet-200' : 'bg-amber-50 text-amber-800 ring-amber-200',
        )}
      >
        <Sparkles size={13} aria-hidden /> {label}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
        <Database size={13} aria-hidden /> {status.dataSource === 'dataset' ? t('ai.dataReal') : t('ai.dataMock')}
      </span>
    </div>
  );
}
