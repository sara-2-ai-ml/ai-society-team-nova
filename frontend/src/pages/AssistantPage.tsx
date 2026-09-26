import { Landmark, MessageSquarePlus, MessageSquareText, SendHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { AssistantAnswer, ConversationDetail, ConversationSummary } from '../api/types';
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const loadConversations = () =>
    api<ConversationSummary[]>('/assistant/conversations')
      .then(setConversations)
      .catch(() => setConversations([]));

  useEffect(() => {
    if (initial.data) setSuggestions(initial.data);
  }, [initial.data]);
  useEffect(() => {
    loadConversations();
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const conversationId = activeConversation ?? crypto.randomUUID();
    setActiveConversation(conversationId);
    setText('');
    setMessages((m) => [...m, { from: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await api<AssistantAnswer>('/assistant/ask', {
        method: 'POST',
        json: { question: q, conversationId },
      });
      setMessages((m) => [...m, { from: 'assistant', text: res.answer, facts: res.facts }]);
      setSuggestions(res.suggestions);
      loadConversations();
    } catch (e) {
      setMessages((m) => [...m, { from: 'assistant', text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  const newConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    setText('');
  };

  const openConversation = async (id: string) => {
    if (busy || id === activeConversation) return;
    setHistoryLoading(true);
    try {
      const conversation = await api<ConversationDetail>(`/assistant/conversations/${encodeURIComponent(id)}`);
      setActiveConversation(id);
      setMessages(
        conversation.messages.map((message) => ({
          from: message.role === 'user' ? 'user' : 'assistant',
          text: message.content,
        })),
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  // First click asks, second click deletes; the list updates right away.
  const deleteConversation = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    setConversations((list) => list.filter((c) => c.id !== id));
    if (activeConversation === id) newConversation();
    try {
      await api<void>(`/assistant/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } finally {
      loadConversations();
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
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(20,33,61,0.06)]">
          <div className="border-b border-slate-100 p-3">
            <button
              type="button"
              onClick={newConversation}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-800"
            >
              <MessageSquarePlus size={17} aria-hidden /> {t('as.newConversation')}
            </button>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-2">
            <p className="px-2 py-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{t('as.history')}</p>
            {!conversations.length && <p className="px-2 py-4 text-sm text-slate-500">{t('as.noHistory')}</p>}
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cx(
                    'group flex items-center rounded-lg transition',
                    activeConversation === conversation.id ? 'bg-brand-50' : 'hover:bg-slate-50',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-slate-800">{conversation.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {new Date(`${conversation.updated_at}Z`).toLocaleDateString()}
                    </span>
                  </button>
                  {confirmDelete === conversation.id ? (
                    <span className="mr-2 flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deleteConversation(conversation.id)}
                        className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        {t('as.confirmDelete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-md px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100"
                      >
                        {t('as.cancelDelete')}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => deleteConversation(conversation.id)}
                      className="mr-2 rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label={t('as.deleteConversation')}
                      title={t('as.deleteConversation')}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

      <Card padded={false} className="flex min-h-[560px] min-w-0 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <MessageSquareText size={22} aria-hidden />
              </span>
              <p className="font-medium text-slate-800">{t('as.emptyTitle')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('as.emptyText')}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cx('flex gap-3', m.from === 'user' && 'justify-end')}>
              {m.from === 'assistant' && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white" aria-hidden>
                  <Landmark size={15} />
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
                        <dd className="font-medium whitespace-nowrap text-slate-800 tabular-nums">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          ))}
          {(busy || historyLoading) && <p className="pl-11 text-sm text-slate-500">{historyLoading ? t('as.loadingHistory') : t('as.thinking')}</p>}
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
      </div>
    </>
  );
}

