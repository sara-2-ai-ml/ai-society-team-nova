import { CheckCircle2, CornerUpLeft, PlayCircle, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RequestItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useApp } from '../lib/AppContext';
import { formatDateTime, formatDay } from '../lib/dates';
import { t } from '../i18n';
import { deadlineText, historyLabel } from '../lib/labels';
import { Button, ErrorNote, Select, StatusBadge, cx } from './ui';

type Action = 'start' | 'complete' | 'return' | 'resend';

/** Details of one request, its history, and the next step the signed-in person can take. */
export function RequestDrawer({
  request,
  onClose,
  onChanged,
}: {
  request: RequestItem | null;
  onClose: () => void;
  onChanged: (r: RequestItem) => void;
}) {
  const { user } = useAuth();
  const { units, unitName } = useApp();
  const [note, setNote] = useState('');
  const [resendTo, setResendTo] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote('');
    setResendTo('');
    setError(null);
  }, [request?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!request || !user) return null;
  const r = request;
  const ownsIt = user.role === 'DREJTORIA' && user.unitId === r.unitId;
  const open = r.status === 'new' || r.status === 'in_progress';
  const canResend = user.role === 'OPERATOR' && r.status === 'returned';

  const run = async (action: Action) => {
    if (action === 'return' && !note.trim()) return setError(t('drawer.returnNeedsNote'));
    setBusy(action);
    setError(null);
    try {
      const updated = await api<RequestItem>(`/requests/${r.id}/actions`, {
        method: 'POST',
        json: { action, note: note.trim() || undefined, unitId: action === 'resend' ? resendTo : undefined },
      });
      setNote('');
      onChanged(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <button className="absolute inset-0 bg-slate-900/30" aria-label={t('common.close')} onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{t('drawer.request')}</p>
            <h2 id="drawer-title" className="text-lg font-semibold text-slate-900">
              {r.protocolNo}
            </h2>
            <div className="mt-2">
              <StatusBadge status={r.status} overdue={r.overdue} />
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-slate-500">{t('table.subject')}</dt>
            <dd className="font-medium text-slate-900">{r.subject}</dd>
            {r.description && (
              <>
                <dt className="text-slate-500">{t('drawer.description')}</dt>
                <dd className="text-slate-900">{r.description}</dd>
              </>
            )}
            {(r.area || r.place) && (
              <>
                <dt className="text-slate-500">{t('drawer.where')}</dt>
                <dd className="text-slate-900">{[r.place, r.area].filter(Boolean).join(', ')}</dd>
              </>
            )}
            <dt className="text-slate-500">{t('drawer.date')}</dt>
            <dd className="text-slate-900">{formatDay(r.date)}</dd>
            <dt className="text-slate-500">{t('table.sentTo')}</dt>
            <dd className="text-slate-900">{unitName(r.unitId)}</dd>
            <dt className="text-slate-500">{t('table.deadline')}</dt>
            <dd className={cx(r.overdue ? 'font-medium text-red-700' : 'text-slate-900')}>
              {formatDay(r.deadline)}
              {deadlineText(r) && <span className="ml-2 text-xs">({deadlineText(r)})</span>}
            </dd>
            {r.completedAt && (
              <>
                <dt className="text-slate-500">{t('drawer.completedAt')}</dt>
                <dd className="text-slate-900">{formatDay(r.completedAt)}</dd>
              </>
            )}
          </dl>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{t('drawer.history')}</h3>
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {r.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-200" />
                  <p className="text-sm font-medium text-slate-800">
                    {historyLabel(h.action)}
                    {h.unitId && (h.action === 'sent' || h.action === 'resent') && (
                      <span className="font-normal text-slate-600"> {t('history.to', { unit: unitName(h.unitId) })}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(h.at)} · {h.by}
                  </p>
                  {h.note && <p className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {(ownsIt && open) || canResend ? (
          <footer className="space-y-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            {error && <ErrorNote error={error} />}
            {ownsIt && open && (
              <>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={t('drawer.notePlaceholder')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  {r.status === 'new' && (
                    <Button icon={PlayCircle} loading={busy === 'start'} onClick={() => run('start')}>
                      {t('drawer.start')}
                    </Button>
                  )}
                  <Button variant="success" icon={CheckCircle2} loading={busy === 'complete'} onClick={() => run('complete')}>
                    {t('drawer.complete')}
                  </Button>
                  <Button variant="danger" icon={CornerUpLeft} loading={busy === 'return'} onClick={() => run('return')}>
                    {t('drawer.return')}
                  </Button>
                </div>
              </>
            )}
            {canResend && (
              <>
                <p className="text-sm text-slate-600">{t('drawer.returnedChoose')}</p>
                <Select value={resendTo} onChange={(e) => setResendTo(e.target.value)} aria-label={t('drawer.resendTo')}>
                  <option value="">{t('drawer.choose')}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
                <Button icon={Send} disabled={!resendTo} loading={busy === 'resend'} onClick={() => run('resend')} className="w-full">
                  {t('drawer.resend')}
                </Button>
              </>
            )}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
