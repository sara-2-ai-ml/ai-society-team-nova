import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Send, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { API_URL, api } from '../../api/client';
import type { ImportResult } from '../../api/types';
import { Button, Card, ErrorNote, PageHeader, Spinner, cx } from '../../components/ui';
import { useApp } from '../../lib/AppContext';
import { formatDay } from '../../lib/dates';
import { getLang, t } from '../../i18n';

type Step = 'pick' | 'checking' | 'review' | 'sending' | 'done';

function upload(file: File, dryRun: boolean) {
  const body = new FormData();
  body.append('file', file);
  return api<ImportResult>(`/requests/import${dryRun ? '?dryRun=true' : ''}`, { method: 'POST', body });
}

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={cx(
          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
          done ? 'bg-emerald-600 text-white' : active ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-600',
        )}
      >
        {done ? <CheckCircle2 size={16} aria-hidden /> : n}
      </span>
      <span className={active ? 'font-medium text-slate-800' : 'text-slate-500'}>{label}</span>
    </li>
  );
}

export function ImportPage() {
  const { units } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const short = (id: string) => units.find((u) => u.id === id)?.short ?? id;

  const check = async (f: File) => {
    if (!/\.xlsx$/i.test(f.name)) return setError(t('imp.onlyXlsx'));
    setFile(f);
    setError(null);
    setStep('checking');
    try {
      setResult(await upload(f, true));
      setStep('review');
    } catch (e) {
      setError((e as Error).message);
      setStep('pick');
    }
  };

  const send = async () => {
    if (!file) return;
    setStep('sending');
    try {
      setResult(await upload(file, false));
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
      setStep('review');
    }
  };

  const reset = () => {
    setStep('pick');
    setFile(null);
    setResult(null);
    setError(null);
    if (input.current) input.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) check(f);
  };

  const stepIndex = { pick: 1, checking: 2, review: 2, sending: 3, done: 3 }[step];

  return (
    <>
      <PageHeader
        title={t('imp.title')}
        subtitle={t('imp.subtitle')}
      />

      <ol className="mb-6 flex flex-wrap gap-6" aria-label={t('imp.steps')}>
        <StepDot n={1} label={t('imp.step1')} active={stepIndex === 1} done={stepIndex > 1} />
        <StepDot n={2} label={t('imp.step2')} active={stepIndex === 2} done={stepIndex > 2} />
        <StepDot n={3} label={t('imp.step3')} active={stepIndex === 3} done={step === 'done'} />
      </ol>

      {error && (
        <div className="mb-4">
          <ErrorNote error={error} />
        </div>
      )}

      {(step === 'pick' || step === 'checking') && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card>
            {step === 'checking' ? (
              <Spinner label={t('imp.checking')} />
            ) : (
              <div
                onDragOver={(e) => (e.preventDefault(), setDragging(true))}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cx(
                  'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition',
                  dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300',
                )}
              >
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Upload size={26} aria-hidden />
                </span>
                <p className="font-medium text-slate-800">{t('imp.drop')}</p>
                <p className="mb-4 text-sm text-slate-500">{t('imp.or')}</p>
                <Button icon={FileSpreadsheet} onClick={() => input.current?.click()}>
                  {t('imp.choose')}
                </Button>
                <input
                  ref={input}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && check(e.target.files[0])}
                />
                <p className="mt-4 text-xs text-slate-500">{t('imp.safe')}</p>
              </div>
            )}
          </Card>

          <Card title={t('imp.noFile')}>
            <p className="text-sm text-slate-600">
              {t('imp.templateText')}
            </p>
            <a
              href={`${API_URL}/requests/template?lang=${getLang()}`}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} aria-hidden /> {t('imp.download')}
            </a>
            <ul className="mt-5 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <li>• {t('imp.tip1')}</li>
              <li>• {t('imp.tip2')}</li>
              <li>• {t('imp.tip3')}</li>
            </ul>
          </Card>
        </div>
      )}

      {(step === 'review' || step === 'sending') && result && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm text-slate-500">{file?.name}</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">
                {t('imp.ready', { n: result.accepted.length })}
                {result.rejected.length > 0 && (
                  <span className="text-rose-700"> · {t('imp.withErrors', { n: result.rejected.length })}</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" icon={RotateCcw} onClick={reset}>
                {t('imp.other')}
              </Button>
              <Button icon={Send} disabled={!result.accepted.length} loading={step === 'sending'} onClick={send}>
                {t('imp.send', { n: result.accepted.length })}
              </Button>
            </div>
          </div>

          {result.rejected.length > 0 && (
            <Card
              title={
                <span className="flex items-center gap-2 text-rose-800">
                  <AlertTriangle size={16} aria-hidden /> {t('imp.rejectedTitle')}
                </span>
              }
              subtitle={t('imp.rejectedHint')}
              padded={false}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-2.5">{t('imp.row')}</th>
                    <th className="px-3 py-2.5">{t('reg.protocol')}</th>
                    <th className="px-5 py-2.5">{t('imp.problem')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rejected.map((r) => (
                    <tr key={r.row}>
                      <td className="px-5 py-2.5 tabular-nums text-slate-500">{r.row}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{r.protocolNo || '–'}</td>
                      <td className="px-5 py-2.5 text-rose-700">{r.errors.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {result.accepted.length > 0 && (
            <Card title={t('imp.readyTitle')} padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-5 py-2.5">{t('imp.row')}</th>
                      <th className="px-3 py-2.5">{t('reg.protocol')}</th>
                      <th className="px-3 py-2.5">{t('reg.date')}</th>
                      <th className="px-3 py-2.5">{t('reg.subject')}</th>
                      <th className="px-5 py-2.5">{t('reg.sendTo')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.accepted.map((r) => (
                      <tr key={r.row}>
                        <td className="px-5 py-2.5 tabular-nums text-slate-500">{r.row}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{r.protocolNo}</td>
                        <td className="px-3 py-2.5 tabular-nums">{formatDay(r.date)}</td>
                        <td className="px-3 py-2.5">{r.subject}</td>
                        <td className="px-5 py-2.5">{short(r.unitId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={28} aria-hidden />
            </span>
            <p className="text-lg font-semibold text-slate-800">
              {t('imp.sentTitle', { n: result.accepted.length })}
            </p>
            <p className="mt-1 text-sm text-slate-500">{t('imp.sentText')}</p>
            <div className="mt-6 flex gap-2">
              <Button variant="secondary" icon={Upload} onClick={reset}>
                {t('imp.uploadAnother')}
              </Button>
              <a href="#/regjistri" className="inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800">
                {t('imp.viewRegistry')}
              </a>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
