import { CalendarDays, CheckCircle2, CornerUpLeft, MapPin, PlayCircle, Send } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { RequestItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n';
import { useApp } from '../lib/AppContext';
import { formatDateTime, formatDay } from '../lib/dates';
import { deadlineText, historyLabel } from '../lib/labels';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Textarea } from './ui/textarea';
import { Button, ErrorNote, Select, StatusBadge, cx } from './ui';

type Action = 'start' | 'complete' | 'return' | 'resend';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 py-2.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

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
  // Keep the last request on screen while the panel slides out.
  const [shown, setShown] = useState<RequestItem | null>(request);

  useEffect(() => {
    if (request) setShown(request);
    setNote('');
    setResendTo('');
    setError(null);
  }, [request?.id, request]);

  const r = request ?? shown;
  if (!r || !user) return null;
  const ownsIt = user.role === 'DREJTORIA' && user.unitId === r.unitId;
  const isOpen = r.status === 'new' || r.status === 'in_progress';
  const canResend = user.role === 'OPERATOR' && r.status === 'returned';

  // "drejtoria.publike" → "Drejtoria e Shërbimeve Publike"; "operator.telefon" → "Operatori".
  const who = (by: string) => {
    const [kind, id] = by.split('.');
    if ((kind === 'drejtoria' || kind === 'agjencia') && id) return unitName(id);
    if (kind === 'operator') return t('role.OPERATOR');
    if (kind === 'kryetari') return t('role.KRYETARI');
    return by;
  };

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
    <Sheet open={!!request} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="gap-2 border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{t('drawer.request')}</p>
          <SheetTitle className="text-xl font-semibold text-slate-800">{r.subject}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="font-medium text-slate-600">{r.protocolNo}</span>
            <StatusBadge status={r.status} overdue={r.overdue} />
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <dl className="divide-y divide-slate-100">
            {r.description && <Row label={t('drawer.description')}>{r.description}</Row>}
            {(r.area || r.place) && (
              <Row label={t('drawer.where')}>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400" aria-hidden />
                  {[r.place, r.area].filter(Boolean).join(', ')}
                </span>
              </Row>
            )}
            <Row label={t('drawer.date')}>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} className="text-slate-400" aria-hidden />
                {formatDay(r.date)}
              </span>
            </Row>
            <Row label={t('table.sentTo')}>{unitName(r.unitId)}</Row>
            <Row label={t('table.deadline')}>
              <span className={cx(r.overdue && 'font-medium text-rose-700')}>
                {formatDay(r.deadline)}
                {deadlineText(r) && <span className="ml-2 text-xs text-slate-500">({deadlineText(r)})</span>}
              </span>
            </Row>
            {r.completedAt && <Row label={t('drawer.completedAt')}>{formatDay(r.completedAt)}</Row>}
          </dl>

          <section>
            <h3 className="mb-4 text-sm font-semibold text-slate-800">{t('drawer.history')}</h3>
            <ol className="relative space-y-5 border-l border-slate-200 pl-5">
              {r.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute top-1 -left-[26px] h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
                  <p className="text-sm font-medium text-slate-800">
                    {historyLabel(h.action)}
                    {h.unitId && (h.action === 'sent' || h.action === 'resent') && (
                      <span className="font-normal text-slate-500"> {t('history.to', { unit: unitName(h.unitId) })}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTime(h.at)} · {who(h.by)}
                  </p>
                  {h.note && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {(ownsIt && isOpen) || canResend ? (
          <footer className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5">
            {error && <ErrorNote error={error} />}
            {ownsIt && isOpen && (
              <>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={t('drawer.notePlaceholder')}
                  className="bg-white text-sm"
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
      </SheetContent>
    </Sheet>
  );
}
