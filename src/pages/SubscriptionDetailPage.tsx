import {
  ArrowLeft,
  Copy,
  ExternalLink,
  FileText,
  Pencil,
  RotateCcw,
  Scissors,
  Trash2,
} from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog, Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { DecisionBadge, Field, Money, StatusBadge } from '@/components/ui';
import { useAppData } from '@/hooks/useAppData';
import { formatDisplayDate, relativeDays } from '@/lib/dates';
import { repository } from '@/lib/db/repository';
import { monthlyOf, yearlyOf } from '@/lib/insights';
import { buildCancellationRequest, buildRefundRequest, cancellationHelpUrl } from '@/lib/letters';
import { logger } from '@/lib/logger';
import { formatMoney, minorUnitFactor, parseAmount, toMajor, toMinor } from '@/lib/money';
import {
  CYCLE_LABELS,
  DECISIONS,
  DECISION_LABELS,
  type Currency,
  type Decision,
  type ISODate,
  type Subscription,
} from '@/lib/types';

const USAGE_LABELS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Daily'];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function SubscriptionDetailPage() {
  const { id } = useParams();
  const { subscriptions, settings, today } = useAppData();
  const sub = subscriptions.find((s) => s.id === id);
  const navigate = useNavigate();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const usageGroupId = useId();

  if (!sub) {
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

  const currency = settings.currency;
  const fmt = (m: number) => formatMoney(m, currency);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.show(success);
    } catch (error) {
      logger.error('Subscription action failed', error);
      toast.show('That didn’t work. Please try again.', 'error');
    }
  };

  const setDecision = (d: Decision) =>
    run(
      () => repository.setDecision(sub.id, sub.decision === d ? undefined : d),
      sub.decision === d ? 'Decision cleared.' : `Marked as “${DECISION_LABELS[d]}”.`,
    );

  const setUsage = (u: number) =>
    run(
      () => repository.setUsage(sub.id, u),
      `Usage set to ${USAGE_LABELS[u - 1]?.toLowerCase()}.`,
    );

  const onDelete = async () => {
    setDeleteOpen(false);
    try {
      await repository.deleteSubscription(sub.id);
      toast.show(`Deleted ${sub.name}.`);
      navigate('/app/subscriptions');
    } catch (error) {
      logger.error('Delete failed', error);
      toast.show('Could not delete. Please try again.', 'error');
    }
  };

  const history = [...sub.priceHistory].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <Link to="/app/subscriptions" className="link mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft aria-hidden="true" className="size-4" /> All subscriptions
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{sub.name}</h1>
            <StatusBadge status={sub.status} />
            {sub.decision && <DecisionBadge decision={sub.decision} />}
          </div>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            <Money
              minor={sub.amountMinor}
              currency={currency}
              className="font-semibold text-slate-900 dark:text-slate-100"
            />{' '}
            {sub.cycle === 'custom'
              ? `every ${sub.customDays} days`
              : CYCLE_LABELS[sub.cycle].toLowerCase()}{' '}
            · {fmt(monthlyOf(sub))}/mo · {fmt(yearlyOf(sub))}/yr
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/app/subscriptions/${sub.id}/edit`} className="btn-secondary">
            <Pencil aria-hidden="true" className="size-4" /> Edit
          </Link>
          {sub.status === 'canceled' ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => setRefundOpen(true)}>
                <FileText aria-hidden="true" className="size-4" /> Draft refund request
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  run(() => repository.reactivate(sub.id), `${sub.name} is active again.`)
                }
              >
                <RotateCcw aria-hidden="true" className="size-4" /> Reactivate
              </button>
            </>
          ) : (
            <button type="button" className="btn-danger" onClick={() => setCancelOpen(true)}>
              <Scissors aria-hidden="true" className="size-4" /> Cancel it
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {sub.status !== 'canceled' && (
            <section aria-labelledby="decide-heading" className="card p-5">
              <h2 id="decide-heading" className="text-lg font-semibold">
                Keep or cut?
              </h2>
              <div className="mt-4">
                <p id={usageGroupId} className="label">
                  How much do you use it?
                </p>
                <div role="group" aria-labelledby={usageGroupId} className="flex flex-wrap gap-2">
                  {USAGE_LABELS.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={sub.usage === i + 1}
                      onClick={() => setUsage(i + 1)}
                      className={`btn-sm rounded-lg border px-3 font-medium ${
                        sub.usage === i + 1
                          ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-slate-950'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <p className="label" id={`${usageGroupId}-decision`}>
                  Decision
                </p>
                <div
                  role="group"
                  aria-labelledby={`${usageGroupId}-decision`}
                  className="flex flex-wrap gap-2"
                >
                  {DECISIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={sub.decision === d}
                      onClick={() => setDecision(d)}
                      className={`btn-sm rounded-lg border px-4 font-semibold ${
                        sub.decision === d
                          ? d === 'cut'
                            ? 'border-rose-700 bg-rose-700 text-white dark:border-rose-400 dark:bg-rose-500 dark:text-slate-950'
                            : d === 'keep'
                              ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-slate-950'
                              : 'border-amber-600 bg-amber-500 text-slate-950'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {DECISION_LABELS[d]}
                    </button>
                  ))}
                </div>
                {sub.decision === 'cut' && (
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                    Cutting this saves <strong>{fmt(yearlyOf(sub))}</strong> a year.{' '}
                    <button type="button" className="link" onClick={() => setCancelOpen(true)}>
                      Start cancelling
                    </button>
                  </p>
                )}
              </div>
            </section>
          )}

          <section aria-labelledby="details-heading" className="card p-5">
            <h2 id="details-heading" className="text-lg font-semibold">
              Details
            </h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Category</dt>
                <dd className="font-medium">{sub.category}</dd>
              </div>
              {sub.status === 'trial' && sub.trialEndsOn && (
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">Free trial ends</dt>
                  <dd className="font-medium">
                    {formatDisplayDate(sub.trialEndsOn)} ({relativeDays(sub.trialEndsOn, today)})
                  </dd>
                </div>
              )}
              {sub.status !== 'canceled' && (
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">Next renewal</dt>
                  <dd className="font-medium">
                    {formatDisplayDate(sub.nextRenewal)} ({relativeDays(sub.nextRenewal, today)})
                  </dd>
                </div>
              )}
              {sub.cancellation && (
                <>
                  <div>
                    <dt className="text-slate-600 dark:text-slate-400">Cancelled on</dt>
                    <dd className="font-medium">
                      {formatDisplayDate(sub.cancellation.canceledOn)}
                    </dd>
                  </div>
                  {sub.cancellation.confirmation && (
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Confirmation number</dt>
                      <dd className="font-mono font-medium">{sub.cancellation.confirmation}</dd>
                    </div>
                  )}
                  {sub.cancellation.method && (
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Cancelled via</dt>
                      <dd className="font-medium">{sub.cancellation.method}</dd>
                    </div>
                  )}
                </>
              )}
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Added from</dt>
                <dd className="font-medium">
                  {sub.source === 'import'
                    ? 'Statement import'
                    : sub.source === 'demo'
                      ? 'Demo data'
                      : 'Manual entry'}
                </dd>
              </div>
              {sub.cancelUrl && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">Cancellation page</dt>
                  <dd>
                    <a
                      href={sub.cancelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link inline-flex items-center gap-1 break-all"
                    >
                      {sub.cancelUrl}
                      <ExternalLink aria-hidden="true" className="size-3" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </dd>
                </div>
              )}
              {sub.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">Notes</dt>
                  <dd className="whitespace-pre-wrap">{sub.notes}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="history-heading" className="card p-5">
            <h2 id="history-heading" className="text-lg font-semibold">
              Price history
            </h2>
            <ol className="mt-3 space-y-2 text-sm">
              {history.map((p, i) => {
                const prev = history[i + 1];
                const delta = prev ? p.amountMinor - prev.amountMinor : 0;
                return (
                  <li key={`${p.date}-${i}`} className="flex justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      {formatDisplayDate(p.date)}
                    </span>
                    <span className="tabular-nums">
                      {fmt(p.amountMinor)}
                      {delta !== 0 && (
                        <span
                          className={`ml-2 text-xs font-semibold ${delta > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-brand-700 dark:text-brand-400'}`}
                        >
                          {delta > 0 ? '+' : '−'}
                          {fmt(Math.abs(delta))}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="danger-heading" className="card p-5">
            <h2 id="danger-heading" className="text-lg font-semibold">
              Remove from Keepcut
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Deleting only removes it from this tracker. It does not cancel the subscription with
              the provider.
            </p>
            <button
              type="button"
              className="btn-secondary mt-3"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" className="size-4" /> Delete
            </button>
          </section>
        </div>
      </div>

      {cancelOpen && (
        <CancelAssistant sub={sub} today={today} onClose={() => setCancelOpen(false)} />
      )}
      {refundOpen && (
        <RefundLetter
          sub={sub}
          currency={currency}
          today={today}
          onClose={() => setRefundOpen(false)}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${sub.name}?`}
        message="This removes it and its history from Keepcut on this device. This can’t be undone."
        confirmLabel="Delete"
        onConfirm={onDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}

const CANCEL_STEPS = [
  'Open the provider’s account or billing page and choose cancel (not pause).',
  'Look for a confirmation screen or email and note the confirmation number.',
  'Subscribed through Apple, Google Play, PayPal or Amazon? Cancel it there too.',
  'Screenshot the confirmation and check your next statement.',
];

const METHODS = [
  'Website or app settings',
  'App Store / Google Play',
  'Email',
  'Phone',
  'Live chat',
  'Other',
];

function CancelAssistant({
  sub,
  today,
  onClose,
}: {
  sub: Subscription;
  today: ISODate;
  onClose: () => void;
}) {
  const toast = useToast();
  const [done, setDone] = useState<boolean[]>(CANCEL_STEPS.map(() => false));
  const [canceledOn, setCanceledOn] = useState(today);
  const [confirmation, setConfirmation] = useState('');
  const [method, setMethod] = useState(METHODS[0]!);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const helpUrl = sub.cancelUrl ?? cancellationHelpUrl(sub.name);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await repository.markCanceled(sub.id, { canceledOn, confirmation, method });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      toast.show(`${sub.name} marked as cancelled. Nice cut!`);
      onClose();
    } catch (error) {
      logger.error('Mark cancelled failed', error);
      toast.show('Could not save the cancellation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyEmail = async () => {
    const ok = await copyText(buildCancellationRequest({ subscription: sub }));
    toast.show(
      ok
        ? 'Cancellation email copied to clipboard.'
        : 'Copy failed — your browser blocked clipboard access.',
      ok ? 'success' : 'error',
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Cancel ${sub.name}`}
      description="Keepcut can’t cancel for you — but it keeps you on track and records proof."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Not now
          </button>
          <button type="submit" form="cancel-form" className="btn-danger" disabled={saving}>
            {saving ? 'Saving…' : 'Mark as cancelled'}
          </button>
        </>
      }
    >
      <ol className="space-y-2">
        {CANCEL_STEPS.map((step, i) => (
          <li key={step}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-brand-700"
                checked={done[i]}
                onChange={(e) => setDone((d) => d.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <span className={done[i] ? 'text-slate-500 line-through' : ''}>{step}</span>
            </label>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary btn-sm"
        >
          <ExternalLink aria-hidden="true" className="size-3" />
          {sub.cancelUrl ? 'Open cancellation page' : 'Find cancellation steps'}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <button type="button" className="btn-secondary btn-sm" onClick={copyEmail}>
          <Copy aria-hidden="true" className="size-3" /> Copy cancellation email
        </button>
      </div>

      <form
        id="cancel-form"
        onSubmit={onSubmit}
        noValidate
        className="mt-6 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-800"
      >
        <Field label="Date cancelled" error={errors.canceledOn}>
          <input
            type="date"
            className="input"
            value={canceledOn}
            onChange={(e) => setCanceledOn(e.target.value)}
          />
        </Field>
        <Field label="How you cancelled" error={errors.method}>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Confirmation number (optional)"
          error={errors.confirmation}
          className="sm:col-span-2"
          hint="Proof if you’re charged again"
        >
          <input
            className="input"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            maxLength={120}
            autoComplete="off"
          />
        </Field>
      </form>
    </Modal>
  );
}

function RefundLetter({
  sub,
  currency,
  today,
  onClose,
}: {
  sub: Subscription;
  currency: Currency;
  today: ISODate;
  onClose: () => void;
}) {
  const toast = useToast();
  const [chargeDate, setChargeDate] = useState(today);
  const [amount, setAmount] = useState(
    toMajor(sub.amountMinor, currency).toFixed(minorUnitFactor(currency) === 1 ? 0 : 2),
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const parsed = parseAmount(amount);
  const letter = buildRefundRequest({
    subscription: sub,
    currency,
    chargeDate: /^\d{4}-\d{2}-\d{2}$/.test(chargeDate) ? chargeDate : today,
    chargeAmountMinor: parsed !== null && parsed >= 0 ? toMinor(parsed, currency) : sub.amountMinor,
    yourName: name,
    accountEmail: email,
  });

  const copy = async () => {
    const ok = await copyText(letter);
    toast.show(
      ok ? 'Letter copied to clipboard.' : 'Copy failed — select the text and copy it manually.',
      ok ? 'success' : 'error',
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Charged after cancelling?"
      description="Fill in the details and send this to the provider’s support. Template only — not legal advice."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" onClick={copy}>
            <Copy aria-hidden="true" className="size-4" /> Copy letter
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of the unwanted charge">
          <input
            type="date"
            className="input"
            value={chargeDate}
            onChange={(e) => setChargeDate(e.target.value)}
          />
        </Field>
        <Field label={`Amount charged (${currency})`}>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Your name (optional)">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </Field>
        <Field label="Account email (optional)">
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Letter" className="sm:col-span-2">
          <textarea readOnly className="input min-h-72 font-mono text-xs" value={letter} />
        </Field>
      </div>
    </Modal>
  );
}
