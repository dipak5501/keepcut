import { ArrowLeft } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useToast } from '@/hooks/useToast';
import { Field, PageHeader } from '@/components/ui';
import { useAppData } from '@/hooks/useAppData';
import { shiftDays } from '@/lib/dates';
import { NotFoundError, repository } from '@/lib/db/repository';
import { logger } from '@/lib/logger';
import { minorUnitFactor, parseAmount, toMajor, toMinor } from '@/lib/money';
import { fieldErrors, subscriptionInputSchema, type SubscriptionInput } from '@/lib/schema';
import {
  CATEGORIES,
  CYCLES,
  CYCLE_LABELS,
  DECISIONS,
  DECISION_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Category,
  type Cycle,
  type Decision,
  type Status,
  type Subscription,
} from '@/lib/types';

interface FormState {
  name: string;
  amount: string;
  cycle: Cycle;
  customDays: string;
  nextRenewal: string;
  category: Category;
  status: Status;
  trialEndsOn: string;
  usage: string;
  decision: Decision | '';
  cancelUrl: string;
  notes: string;
}

const USAGE_LABELS = ['', 'Never', 'Rarely', 'Sometimes', 'Often', 'Daily'];

function initialState(sub: Subscription | undefined, today: string, currency: string): FormState {
  if (!sub) {
    return {
      name: '',
      amount: '',
      cycle: 'monthly',
      customDays: '',
      nextRenewal: shiftDays(today, 30),
      category: 'Other',
      status: 'active',
      trialEndsOn: shiftDays(today, 7),
      usage: '',
      decision: '',
      cancelUrl: '',
      notes: '',
    };
  }
  return {
    name: sub.name,
    amount: toMajor(sub.amountMinor, currency).toFixed(minorUnitFactor(currency) === 1 ? 0 : 2),
    cycle: sub.cycle,
    customDays: sub.customDays ? String(sub.customDays) : '',
    nextRenewal: sub.nextRenewal,
    category: sub.category,
    status: sub.status,
    trialEndsOn: sub.trialEndsOn ?? shiftDays(today, 7),
    usage: sub.usage ? String(sub.usage) : '',
    decision: sub.decision ?? '',
    cancelUrl: sub.cancelUrl ?? '',
    notes: sub.notes ?? '',
  };
}

export function SubscriptionFormPage() {
  const { id } = useParams();
  const { subscriptions, settings, today } = useAppData();
  const existing = id ? subscriptions.find((s) => s.id === id) : undefined;
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(() =>
    initialState(existing, today, settings.currency),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (id && !existing) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-semibold">Subscription not found</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">It may have been deleted.</p>
        <Link to="/app/subscriptions" className="btn-primary mt-4">
          Back to subscriptions
        </Link>
      </div>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const focusFirstError = () => {
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(form.amount);
    const localErrors: Record<string, string> = {};
    if (amount === null) localErrors.amountMinor = 'Enter an amount, for example 12.99';
    else if (amount < 0) localErrors.amountMinor = 'Amount cannot be negative';
    if (form.cycle === 'custom' && form.customDays && !/^\d+$/.test(form.customDays)) {
      localErrors.customDays = 'Use whole days';
    }

    const input: SubscriptionInput = {
      name: form.name,
      amountMinor: amount !== null && amount >= 0 ? toMinor(amount, settings.currency) : 0,
      cycle: form.cycle,
      customDays:
        form.cycle === 'custom' && /^\d+$/.test(form.customDays)
          ? Number(form.customDays)
          : undefined,
      nextRenewal: form.nextRenewal,
      category: form.category,
      status: form.status,
      trialEndsOn: form.status === 'trial' ? form.trialEndsOn : undefined,
      usage: form.usage ? Number(form.usage) : undefined,
      decision: form.decision || undefined,
      cancelUrl: form.cancelUrl,
      notes: form.notes,
    };

    const parsed = subscriptionInputSchema.safeParse(input);
    const allErrors = { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...localErrors };
    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      focusFirstError();
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const result = existing
        ? await repository.updateSubscription(existing.id, input)
        : await repository.createSubscription(input);
      if (!result.ok) {
        setErrors(result.errors);
        focusFirstError();
        return;
      }
      toast.show(
        existing ? `Saved changes to ${result.value.name}.` : `Added ${result.value.name}.`,
      );
      navigate(`/app/subscriptions/${result.value.id}`);
    } catch (error) {
      logger.error('Saving subscription failed', error);
      toast.show(
        error instanceof NotFoundError ? error.message : 'Could not save. Please try again.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const backTo = existing ? `/app/subscriptions/${existing.id}` : '/app/subscriptions';

  return (
    <>
      <Link to={backTo} className="link mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft aria-hidden="true" className="size-4" /> Back
      </Link>
      <PageHeader title={existing ? `Edit ${existing.name}` : 'Add a subscription'} />

      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        className="card max-w-3xl space-y-6 p-5 sm:p-6"
      >
        {errors._form && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          >
            {errors._form}
          </p>
        )}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-base font-semibold">Billing</legend>
          <Field label="Name" error={errors.name} className="sm:col-span-2">
            <input
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={80}
              autoComplete="off"
              required
              placeholder="e.g. Netflix"
            />
          </Field>
          <Field
            label={`Amount (${settings.currency})`}
            error={errors.amountMinor}
            hint="What you pay each billing cycle"
          >
            <input
              className="input"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              required
              placeholder="12.99"
            />
          </Field>
          <Field label="Billing cycle" error={errors.cycle}>
            <select
              className="input"
              value={form.cycle}
              onChange={(e) => set('cycle', e.target.value as Cycle)}
            >
              {CYCLES.map((c) => (
                <option key={c} value={c}>
                  {CYCLE_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          {form.cycle === 'custom' && (
            <Field label="Days between charges" error={errors.customDays}>
              <input
                className="input"
                inputMode="numeric"
                value={form.customDays}
                onChange={(e) => set('customDays', e.target.value)}
                placeholder="28"
              />
            </Field>
          )}
          <Field label="Next renewal date" error={errors.nextRenewal}>
            <input
              type="date"
              className="input"
              value={form.nextRenewal}
              onChange={(e) => set('nextRenewal', e.target.value)}
              required
            />
          </Field>
          <Field label="Category" error={errors.category}>
            <select
              className="input"
              value={form.category}
              onChange={(e) => set('category', e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={errors.status}>
            <select
              className="input"
              value={form.status}
              onChange={(e) => set('status', e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          {form.status === 'trial' && (
            <Field
              label="Free trial ends on"
              error={errors.trialEndsOn}
              hint="You’ll be charged after this date"
            >
              <input
                type="date"
                className="input"
                value={form.trialEndsOn}
                onChange={(e) => set('trialEndsOn', e.target.value)}
              />
            </Field>
          )}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-base font-semibold">Your decision</legend>
          <Field label="How much do you use it?" error={errors.usage}>
            <select
              className="input"
              value={form.usage}
              onChange={(e) => set('usage', e.target.value)}
            >
              <option value="">Not rated</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} – {USAGE_LABELS[n]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Keep or cut?" error={errors.decision}>
            <select
              className="input"
              value={form.decision}
              onChange={(e) => set('decision', e.target.value as Decision | '')}
            >
              <option value="">Undecided</option>
              {DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {DECISION_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Cancellation page (optional)"
            error={errors.cancelUrl}
            hint="Link to the account page where you cancel"
            className="sm:col-span-2"
          >
            <input
              type="url"
              className="input"
              value={form.cancelUrl}
              onChange={(e) => set('cancelUrl', e.target.value)}
              placeholder="https://"
              autoComplete="off"
            />
          </Field>
          <Field label="Notes (optional)" error={errors.notes} className="sm:col-span-2">
            <textarea
              className="input min-h-24"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={1000}
            />
          </Field>
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Link to={backTo} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add subscription'}
          </button>
        </div>
      </form>
    </>
  );
}
