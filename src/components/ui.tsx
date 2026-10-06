import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import {
  DECISION_LABELS,
  STATUS_LABELS,
  type Currency,
  type Decision,
  type Status,
} from '@/lib/types';

export function Money({
  minor,
  currency,
  className,
}: {
  minor: number;
  currency: Currency;
  className?: string;
}) {
  return <span className={`tabular-nums ${className ?? ''}`}>{formatMoney(minor, currency)}</span>;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}

/** Wires label, hint and error text to a single form control via ids and ARIA. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<Status, string> = {
  active: 'bg-brand-100 text-brand-900 dark:bg-brand-900/60 dark:text-brand-100',
  trial: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  paused: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  canceled:
    'bg-slate-100 text-slate-700 line-through decoration-slate-400 dark:bg-slate-800 dark:text-slate-300',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const DECISION_STYLES: Record<Decision, string> = {
  keep: 'border-brand-300 text-brand-800 dark:border-brand-700 dark:text-brand-200',
  review: 'border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200',
  cut: 'border-rose-300 text-rose-800 dark:border-rose-700 dark:text-rose-200',
};

export function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${DECISION_STYLES[decision]}`}
    >
      {DECISION_LABELS[decision]}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 rounded-full bg-brand-50 p-3 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && (
        <div className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{children}</div>
      )}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 py-16 text-sm text-slate-600 dark:text-slate-400"
    >
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-400"
      />
      {label}…
    </div>
  );
}

export function UsageMeter({ usage }: { usage?: number }) {
  if (!usage) return <span className="text-xs text-slate-500 dark:text-slate-400">Not rated</span>;
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`Usage ${usage} out of 5`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={`h-2 w-3 rounded-sm ${n <= usage ? (usage <= 2 ? 'bg-rose-500' : 'bg-brand-600 dark:bg-brand-400') : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </span>
  );
}
