import { ArrowRight, Building2, Check, CheckCircle2, CornerUpLeft, FileSpreadsheet, Loader2, Send } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, query } from '../../api/client';
import type { RequestItem, Unit, UnitSuggestion } from '../../api/types';
import { DatePicker } from '../../components/Calendar';
import { RequestDrawer } from '../../components/RequestDrawer';
import { Button, Card, ErrorNote, Field, Input, PageHeader, StatusBadge, cx } from '../../components/ui';
import { useApp } from '../../lib/AppContext';
import { t } from '../../i18n';
import { today } from '../../lib/dates';
import { useApi } from '../../lib/useApi';

// Ready-made examples for presenting the form quickly; each click fills the next one.
const EXAMPLES = [
  { subject: 'Kërkesë për ndihmë ekonomike', unitId: 'sociale' },
  { subject: 'Gropë në rrugë', unitId: 'infrastruktura' },
  { subject: 'Mbetje të pagrumbulluara', unitId: 'publike' },
  { subject: 'Pemë e rrëzuar', unitId: 'parqet' },
  { subject: 'Kërkesë për informacion urbanistik', unitId: 'urbanistika' },
  { subject: 'Stacion autobusi i dëmtuar', unitId: 'transporti' },
];

function UnitChoice({
  units,
  value,
  suggested,
  onChange,
}: {
  units: Unit[];
  value: string;
  suggested?: string | null;
  onChange: (id: string) => void;
}) {
  const groups = [
    { title: t('units.departments'), list: units.filter((u) => u.type === 'drejtori') },
    { title: t('units.agencies'), list: units.filter((u) => u.type === 'agjenci') },
  ];
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <fieldset key={g.title}>
          <legend className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">{g.title}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.list.map((u) => (
              <label
                key={u.id}
                className={cx(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition',
                  value === u.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <input
                  type="radio"
                  name="unit"
                  value={u.id}
                  checked={value === u.id}
                  onChange={() => onChange(u.id)}
                  className="mt-0.5 accent-brand-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800">{u.short}</span>
                  <span className="text-xs text-slate-500">{t('unit.sla', { n: u.slaDays })}</span>
                </span>
                {suggested === u.id && (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
                    {t('reg.suggestedBadge')}
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function RegisterPage() {
  const { units, unitName } = useApp();
  const [protocolNo, setProtocolNo] = useState('');
  const [date, setDate] = useState(today());
  const [subject, setSubject] = useState('');
  const [unitId, setUnitId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<RequestItem | null>(null);
  const [open, setOpen] = useState<RequestItem | null>(null);
  const [example, setExample] = useState(0);
  const [suggestion, setSuggestion] = useState<UnitSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  // While the operator types the subject, ask which unit it belongs to (after a short pause).
  useEffect(() => {
    const text = subject.trim();
    setSuggestion(null);
    if (text.length < 4) return setSuggesting(false);
    let live = true;
    const timer = setTimeout(() => {
      setSuggesting(true);
      api<UnitSuggestion>('/requests/suggest-unit', { method: 'POST', json: { subject: text } })
        .then((s) => live && setSuggestion(s.unitId ? s : null))
        .catch(() => live && setSuggestion(null))
        .finally(() => live && setSuggesting(false));
    }, 700);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [subject]);

  const fillExample = () => {
    const ex = EXAMPLES[example % EXAMPLES.length];
    setSubject(ex.subject);
    setUnitId(ex.unitId);
    setDate(today());
    setError(null);
    setExample((i) => i + 1);
  };

  const all = useApi<RequestItem[]>('/requests');
  const todays = useApi<RequestItem[]>(`/requests${query({ from: today(), to: today() })}`);
  const returned = (all.data ?? []).filter((r) => r.status === 'returned');
  const subjects = useMemo(() => [...new Set((all.data ?? []).map((r) => r.subject))].sort(), [all.data]);

  const loadNext = () =>
    api<{ protocolNo: string }>('/requests/next-number')
      .then((r) => setProtocolNo(r.protocolNo))
      .catch(() => {});
  useEffect(() => {
    loadNext();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!unitId) return setError(t('reg.chooseUnit'));
    setBusy(true);
    setError(null);
    try {
      const created = await api<RequestItem>('/requests', { method: 'POST', json: { protocolNo, date, subject, unitId } });
      setSent(created);
      setSubject('');
      setUnitId('');
      loadNext();
      todays.reload();
      all.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('reg.title')}
        subtitle={t('reg.subtitle')}
        actions={
          <a href="#/excel" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <FileSpreadsheet size={16} aria-hidden /> {t('reg.fromExcel')}
          </a>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card
          title={t('reg.card')}
          action={
            <Button type="button" variant="secondary" onClick={fillExample} className="h-9">
              {t('reg.example')}
            </Button>
          }
        >
          <form onSubmit={submit} className="space-y-5">
            {sent && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  <strong>{sent.protocolNo}</strong> {t('reg.sentTo', { unit: unitName(sent.unitId) })}
                </span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('reg.protocol')} hint={t('reg.protocolHint')}>
                <Input value={protocolNo} onChange={(e) => setProtocolNo(e.target.value)} required maxLength={40} />
              </Field>
              <Field label={t('reg.date')}>
                <DatePicker value={date} onChange={setDate} max={today()} />
              </Field>
            </div>
            <Field label={t('reg.subject')} hint={t('reg.subjectHint')}>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} list="subjects" required maxLength={300} />
              <datalist id="subjects">
                {subjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            {suggesting && (
              <p className="-mt-2 flex items-center gap-2 text-sm text-slate-500" role="status">
                <Loader2 size={15} className="animate-spin" aria-hidden /> {t('reg.suggesting')}
              </p>
            )}
            {suggestion?.unitId && (
              <div
                className={cx(
                  '-mt-2 overflow-hidden rounded-xl border bg-white shadow-sm transition-colors',
                  unitId === suggestion.unitId ? 'border-emerald-300' : 'border-slate-200',
                )}
                role="status"
              >
                <div className="flex">
                  <div className={cx('w-1 shrink-0', unitId === suggestion.unitId ? 'bg-emerald-500' : 'bg-brand-700')} />
                  <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <div
                      className={cx(
                        'flex size-11 shrink-0 items-center justify-center rounded-xl',
                        unitId === suggestion.unitId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-brand-800',
                      )}
                    >
                      {unitId === suggestion.unitId ? <Check size={21} strokeWidth={2.2} aria-hidden /> : <Building2 size={21} strokeWidth={1.8} aria-hidden />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
                          {t('reg.routeRecommendation')}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {t(suggestion.source === 'ai' ? 'reg.sourceAi' : 'reg.sourceHistory')}
                        </span>
                      </div>
                      <p className="text-base font-semibold text-slate-950">{unitName(suggestion.unitId)}</p>
                      {suggestion.reason && <p className="mt-1 text-sm leading-5 text-slate-600">{suggestion.reason}</p>}
                    </div>

                    {unitId === suggestion.unitId ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 sm:self-center">
                        <Check size={16} aria-hidden /> {t('reg.suggestionUsed')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 sm:self-center"
                        onClick={() => setUnitId(suggestion.unitId!)}
                      >
                        {t('reg.useSuggestion')} <ArrowRight size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">{t('reg.sendTo')}</span>
              <UnitChoice units={units} value={unitId} suggested={suggestion?.unitId} onChange={setUnitId} />
            </div>
            {error && <ErrorNote error={error} />}
            <div className="flex justify-end border-t border-slate-100 pt-5">
              <Button type="submit" icon={Send} loading={busy}>
                {t('reg.submit')}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          {returned.length > 0 && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <CornerUpLeft size={16} className="text-amber-600" aria-hidden /> {t('reg.returnedTitle')}
                </span>
              }
              padded={false}
            >
              <ul className="divide-y divide-slate-100">
                {returned.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setOpen(r)} className="w-full px-5 py-3 text-left hover:bg-slate-50">
                      <span className="block text-sm font-medium text-slate-800">{r.protocolNo}</span>
                      <span className="block truncate text-xs text-slate-500">{r.subject}</span>
                      <span className="mt-1 block text-xs text-amber-700">{r.history.at(-1)?.note}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={t('reg.today')} subtitle={t('reg.todayCount', { n: todays.data?.length ?? 0 })} padded={false}>
            {!todays.data?.length ? (
              <p className="px-5 py-6 text-sm text-slate-500">{t('reg.noneToday')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {todays.data.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setOpen(r)} className="flex w-full items-start justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800">{r.protocolNo}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {r.subject} · {units.find((u) => u.id === r.unitId)?.short}
                        </span>
                      </span>
                      <StatusBadge status={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <RequestDrawer
        request={open}
        onClose={() => setOpen(null)}
        onChanged={(r) => {
          setOpen(r);
          all.reload();
          todays.reload();
        }}
      />
    </>
  );
}
