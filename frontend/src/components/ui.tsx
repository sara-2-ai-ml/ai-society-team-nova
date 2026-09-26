// The app's building blocks, on shadcn/ui components. Pages import from here, so the look is set in one place.
import { AlertCircle, Loader2, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { RequestStatus } from '../api/types';
import { t } from '../i18n';
import { STATUS_STYLE, statusLabel } from '../lib/labels';
import { cn } from '../lib/utils';
import { Alert, AlertDescription } from './ui/alert';
import { Button as ShButton } from './ui/button';
import { Card as ShCard } from './ui/card';
import { Input as ShInput } from './ui/input';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

export const cx = (...classes: (string | false | null | undefined)[]) => cn(...classes);

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold tracking-tight text-brand-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <ShCard className={cn('gap-0 rounded-2xl py-0 shadow-[0_2px_12px_rgba(20,33,61,0.06)] ring-0', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-1">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-brand-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? 'p-6 pt-4' : 'pt-2'}>{children}</div>
    </ShCard>
  );
}

const TONES = {
  neutral: { card: 'bg-white', label: 'text-slate-500', value: 'text-brand-900', hint: 'text-slate-500', icon: 'bg-slate-100 text-slate-500' },
  brand: { card: 'bg-white', label: 'text-slate-500', value: 'text-brand-900', hint: 'text-slate-500', icon: 'bg-brand-50 text-brand-600' },
  good: { card: 'bg-white', label: 'text-slate-500', value: 'text-emerald-700', hint: 'text-slate-500', icon: 'bg-emerald-50 text-emerald-600' },
  warn: { card: 'bg-white', label: 'text-slate-500', value: 'text-amber-700', hint: 'text-slate-500', icon: 'bg-amber-50 text-amber-600' },
  bad: { card: 'bg-white', label: 'text-slate-500', value: 'text-rose-700', hint: 'text-slate-500', icon: 'bg-rose-50 text-rose-600' },
  // Solid "hero" cards for the one or two numbers that matter most on a page.
  navy: { card: 'bg-brand-900', label: 'text-brand-200', value: 'text-white', hint: 'text-brand-200', icon: 'bg-white/10 text-gold-400' },
  gold: { card: 'bg-gold-500', label: 'text-brand-900/70', value: 'text-brand-900', hint: 'text-brand-900/70', icon: 'bg-white/30 text-brand-900' },
};

/** A number with a plain sentence that says what it means. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'flex flex-col gap-3 rounded-2xl p-5 text-left shadow-[0_2px_12px_rgba(20,33,61,0.06)]',
        TONES[tone].card,
        onClick && 'transition hover:-translate-y-0.5 hover:shadow-lg',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-sm font-medium', TONES[tone].label)}>{label}</span>
        {Icon && (
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', TONES[tone].icon)}>
            <Icon size={18} aria-hidden />
          </span>
        )}
      </div>
      <div className={cn('text-[32px] leading-none font-bold tabular-nums tracking-tight', TONES[tone].value)}>{value}</div>
      {hint && <div className={cn('text-sm leading-snug', TONES[tone].hint)}>{hint}</div>}
    </Tag>
  );
}

const BUTTONS = {
  primary: { variant: 'default', className: '' },
  secondary: { variant: 'outline', className: 'bg-white text-slate-700' },
  ghost: { variant: 'ghost', className: 'text-slate-600' },
  success: { variant: 'default', className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  danger: { variant: 'destructive', className: '' },
} as const;

export function Button({
  variant = 'primary',
  icon: Icon,
  loading,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTONS; icon?: LucideIcon; loading?: boolean }) {
  const v = BUTTONS[variant];
  return (
    <ShButton
      {...props}
      variant={v.variant}
      disabled={props.disabled || loading}
      className={cn('h-10 shrink-0 gap-2 rounded-xl px-4 text-sm font-medium whitespace-nowrap', v.className, className)}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : Icon && <Icon size={16} aria-hidden />}
      {children}
    </ShButton>
  );
}

export function StatusBadge({ status, overdue }: { status: RequestStatus; overdue?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', s.badge)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
        {statusLabel(status)}
      </span>
      {overdue && (
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-rose-700">{t('status.overdue')}</span>
      )}
    </span>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-rose-600">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

const FIELD = 'h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-none placeholder:text-slate-400';

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => <ShInput {...props} className={cn(FIELD, className)} />;

// A native select keeps keyboard and screen-reader behaviour simple; styled like the other fields.
export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={cn(
      FIELD,
      'border pr-8 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40',
      className,
    )}
  />
);

export function Spinner({ label = t('common.loading') }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500" role="status">
      <Loader2 size={18} className="animate-spin text-gold-500" aria-hidden /> {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: Error | string }) {
  return (
    <Alert variant="destructive" className="border-rose-200 bg-rose-50/70 text-rose-800">
      <AlertCircle aria-hidden />
      <AlertDescription className="text-rose-800">{typeof error === 'string' ? error : error.message}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-50 text-gold-600">
        <Icon size={22} aria-hidden />
      </span>
      <p className="font-medium text-slate-700">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
    </div>
  );
}

/** Tabs with counts, e.g. "Të reja 5 · Në proces 3". */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList aria-label={label} className="h-auto flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm">
        {options.map((o) => (
          <TabsTrigger key={o.id} value={o.id} className="h-8 gap-1.5 rounded-lg px-3 text-sm data-[state=active]:bg-brand-900 data-[state=active]:text-white data-[state=active]:shadow-none">
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  value === o.id ? 'bg-gold-500 text-brand-900' : 'bg-slate-200/70 text-slate-500',
                )}
              >
                {o.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
