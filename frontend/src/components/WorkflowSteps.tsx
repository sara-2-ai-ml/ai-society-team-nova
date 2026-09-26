import { ArrowRight, CheckCircle2, CornerUpLeft, Inbox, PlayCircle, Send } from 'lucide-react';
import type { StatusCounts } from '../api/types';
import { t } from '../i18n';
import { cx } from './ui';

export type StepFilter = 'new' | 'in_progress' | 'done' | 'returned';

/**
 * The request workflow as four steps with live counts:
 * Operatori regjistron → Drejtoria merr → Në proces → E përfunduar, and the side path back to the operator.
 */
export function WorkflowSteps({ counts, onSelect }: { counts: StatusCounts; onSelect?: (s: StepFilter) => void }) {
  const steps = [
    { id: null, icon: Send, title: t('wf.registration'), who: t('wf.operator'), value: counts.total, text: t('wf.registeredSent') },
    { id: 'new' as const, icon: Inbox, title: t('wf.new'), who: t('wf.unit'), value: counts.new, text: t('wf.waiting') },
    { id: 'in_progress' as const, icon: PlayCircle, title: t('wf.inProgress'), who: t('wf.unit'), value: counts.inProgress, text: t('wf.working') },
    { id: 'done' as const, icon: CheckCircle2, title: t('wf.done'), who: t('wf.unit'), value: counts.done, text: t('wf.closed') },
  ];

  return (
    <div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => {
          const Tag = s.id && onSelect ? 'button' : 'div';
          return (
            <li key={s.title} className="relative">
              <Tag
                onClick={s.id && onSelect ? () => onSelect(s.id!) : undefined}
                className={cx(
                  'flex h-full w-full flex-col rounded-2xl bg-slate-50 p-4 text-left',
                  s.id && onSelect && 'transition hover:bg-gold-50',
                )}
              >
                <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-[11px] text-white">{i + 1}</span>
                  {s.who}
                </span>
                <span className="mt-3 flex items-center gap-2 font-semibold text-slate-800">
                  <s.icon size={18} className="text-gold-600" aria-hidden />
                  {s.title}
                </span>
                <span className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">{s.value}</span>
                <span className="text-xs text-slate-500">{s.text}</span>
              </Tag>
              {i < steps.length - 1 && (
                <ArrowRight
                  size={18}
                  className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 rounded-full bg-white text-slate-400 xl:block"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={onSelect ? () => onSelect('returned') : undefined}
        disabled={!onSelect}
        className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-left text-sm text-slate-600 enabled:hover:bg-slate-50"
      >
        <CornerUpLeft size={16} className="shrink-0 text-slate-500" aria-hidden />
        <span>
          <strong className="font-semibold text-slate-800">{t('wf.returned', { n: counts.returned })}</strong>
          {t('wf.returnedText')}
        </span>
        {counts.overdue > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
            {t('wf.overdue', { n: counts.overdue })}
          </span>
        )}
      </button>
    </div>
  );
}
