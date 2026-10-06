import {
  ArrowLeft,
  CircleCheck,
  FileUp,
  FlaskConical,
  Lock,
  ScanSearch,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Link, useNavigate } from 'react-router';
import { useToast } from '@/hooks/useToast';
import { Field, Money, PageHeader } from '@/components/ui';
import { useAppData } from '@/hooks/useAppData';
import {
  CsvImportError,
  MAX_FILE_BYTES,
  detectChargeSign,
  guessMapping,
  isMappingComplete,
  normalizeTransactions,
  parseCsvText,
  type ChargeSign,
  type ColumnMapping,
  type ParsedTable,
} from '@/lib/csv';
import { DATE_FORMATS, detectDateFormat, formatDisplayDate, type DateFormatId } from '@/lib/dates';
import { repository } from '@/lib/db/repository';
import { buildSampleStatementCsv } from '@/lib/demo';
import { detectRecurring, type DetectedSubscription } from '@/lib/detect';
import { logger } from '@/lib/logger';
import { formatMoney, monthlyEquivalent } from '@/lib/money';
import { CATEGORIES, CYCLE_LABELS, type Category, type Subscription } from '@/lib/types';

type Step = 'upload' | 'map' | 'review';

interface Source {
  fileName: string;
  table: ParsedTable;
}

interface ReviewItem {
  detection: DetectedSubscription;
  selected: boolean;
  name: string;
  category: Category;
  alreadyTracked: boolean;
  chargedAfterCancel?: Subscription;
}

const CONFIDENCE_STYLES = {
  high: 'bg-brand-100 text-brand-900 dark:bg-brand-900/60 dark:text-brand-100',
  medium: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  low: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
};

function StepIndicator({ step }: { step: Step }) {
  const steps: Array<[Step, string]> = [
    ['upload', 'Choose file'],
    ['map', 'Check columns'],
    ['review', 'Review'],
  ];
  const current = steps.findIndex(([s]) => s === step);
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm" aria-label="Import progress">
      {steps.map(([key, label], i) => (
        <li
          key={key}
          className="flex items-center gap-2"
          aria-current={i === current ? 'step' : undefined}
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
              i <= current
                ? 'bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={i === current ? 'font-semibold' : 'text-slate-600 dark:text-slate-400'}>
            {label}
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="mx-1 h-px w-6 bg-slate-300 dark:bg-slate-700" />
          )}
        </li>
      ))}
    </ol>
  );
}

export function ImportPage() {
  const { subscriptions, settings, today } = useAppData();
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputId = useId();
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormatId>('mdy');
  const [chargeSign, setChargeSign] = useState<ChargeSign>('negative');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const loadText = (text: string, fileName: string) => {
    setError(null);
    try {
      const table = parseCsvText(text);
      const guessed = guessMapping(table);
      setSource({ fileName, table });
      setMapping(guessed);
      if (guessed.date >= 0) {
        setDateFormat(detectDateFormat(table.rows.map((r) => r[guessed.date] ?? '')) ?? 'mdy');
      }
      if (guessed.amount !== null) setChargeSign(detectChargeSign(table, guessed.amount));
      setStep('map');
    } catch (e) {
      setError(e instanceof CsvImportError ? e.message : 'This file could not be read as CSV.');
      if (!(e instanceof CsvImportError)) logger.error('CSV parse failed', e);
    }
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('This file is larger than 5 MB. Export a shorter date range and try again.');
      return;
    }
    if (!/\.(csv|txt|tsv)$/i.test(file.name) && file.type && !/csv|text|excel/.test(file.type)) {
      setError(
        'Please choose a .csv file. PDF statements aren’t supported yet — most banks offer a CSV download.',
      );
      return;
    }
    try {
      loadText(await file.text(), file.name);
    } catch (e) {
      logger.error('File read failed', e);
      setError('Your browser could not read that file.');
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void loadFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files[0]);
  };

  const preview = useMemo(() => {
    if (!source || !mapping || !isMappingComplete(mapping)) return null;
    try {
      return normalizeTransactions(source.table, {
        mapping,
        dateFormat,
        chargeSign,
        currency: settings.currency,
      });
    } catch {
      return null;
    }
  }, [source, mapping, dateFormat, chargeSign, settings.currency]);

  const runDetection = () => {
    if (!preview) return;
    const detected = detectRecurring(preview.transactions, { today, minConfidence: 0.4 });
    const tracked = new Set(
      subscriptions.filter((s) => s.status !== 'canceled').map((s) => s.merchantKey),
    );
    const canceled = new Map(
      subscriptions.filter((s) => s.status === 'canceled').map((s) => [s.merchantKey, s]),
    );
    setItems(
      detected.map((d) => {
        const alreadyTracked = tracked.has(d.merchantKey);
        const canceledSub = alreadyTracked ? undefined : canceled.get(d.merchantKey);
        const chargedAfterCancel =
          canceledSub?.cancellation && d.lastChargedOn > canceledSub.cancellation.canceledOn
            ? canceledSub
            : undefined;
        return {
          detection: d,
          alreadyTracked,
          chargedAfterCancel,
          selected:
            !alreadyTracked && !chargedAfterCancel && d.confidence >= 0.6 && !d.likelyInactive,
          name: d.name,
          category: d.category,
        };
      }),
    );
    setStep('review');
  };

  const selectedItems = items.filter((i) => i.selected && !i.alreadyTracked);
  const selectedMonthly = selectedItems.reduce(
    (sum, i) =>
      sum + monthlyEquivalent(i.detection.amountMinor, i.detection.cycle, i.detection.customDays),
    0,
  );

  const save = async () => {
    if (!source || !preview) return;
    setSaving(true);
    try {
      const { added } = await repository.addDetected(
        selectedItems.map((i) => ({
          ...i.detection,
          name: i.name.trim() || i.detection.name,
          category: i.category,
        })),
        {
          fileName: source.fileName,
          rowCount: source.table.rows.length,
          detectedCount: items.length,
        },
      );
      await repository.updateSettings({ onboarded: true });
      toast.show(
        `Added ${added.length} subscription${added.length === 1 ? '' : 's'}. Your statement was not stored.`,
      );
      navigate('/app');
    } catch (e) {
      logger.error('Saving detections failed', e);
      toast.show('Could not save. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setSource(null);
    setMapping(null);
    setItems([]);
    setError(null);
  };

  const columnOptions = (source?.table.headers ?? []).map((h, i) => (
    <option key={i} value={i}>
      {h}
    </option>
  ));

  return (
    <>
      <PageHeader
        title="Import a statement"
        description="Your file is read in this browser tab and never uploaded."
      />
      <StepIndicator step={step} />

      {step === 'upload' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div
              role="presentation"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <label
                htmlFor={fileInputId}
                className={`card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-14 text-center transition-colors ${
                  dragging
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-slate-300 hover:border-brand-600 dark:border-slate-700'
                }`}
              >
                <FileUp aria-hidden="true" className="size-10 text-brand-700 dark:text-brand-400" />
                <span className="mt-4 text-lg font-semibold">
                  Drop your CSV here or click to choose
                </span>
                <span className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Bank or credit-card export · up to 5 MB
                </span>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,.txt,.tsv,text/csv"
                  className="sr-only"
                  onChange={onFileChange}
                />
              </label>
            </div>

            {error && (
              <div
                role="alert"
                className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
              >
                <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
                {error}
              </div>
            )}

            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Paste rows instead</summary>
              <div className="mt-3">
                <Field label="CSV text" hint="Include the header row, e.g. Date,Description,Amount">
                  <textarea
                    ref={pasteRef}
                    className="input min-h-40 font-mono text-xs"
                    spellCheck={false}
                  />
                </Field>
                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={() => {
                    const text = pasteRef.current?.value ?? '';
                    if (!text.trim()) {
                      setError('Paste some CSV rows first.');
                      return;
                    }
                    loadText(text, 'Pasted rows');
                  }}
                >
                  Use pasted rows
                </button>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => loadText(buildSampleStatementCsv(today), 'sample-statement.csv')}
              >
                <FlaskConical aria-hidden="true" className="size-4" /> Try a sample statement
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                See how detection works with realistic fake data.
              </span>
            </div>
          </div>

          <aside className="card h-fit space-y-4 p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <Lock aria-hidden="true" className="size-4 text-brand-700 dark:text-brand-400" /> What
              happens to my file?
            </h2>
            <p className="text-slate-700 dark:text-slate-300">
              It’s parsed by code running in this tab. Keepcut never sends it anywhere, and only the
              subscriptions you confirm are saved — not your transactions.
            </p>
            <h2 className="font-semibold">Where do I get a CSV?</h2>
            <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
              <li>Sign in to your bank’s website (not the app).</li>
              <li>Open the account or card → Transactions / Statements.</li>
              <li>Choose Download or Export → CSV. Pick the last 3–12 months.</li>
              <li>Repeat for each card you use for subscriptions.</li>
            </ul>
          </aside>
        </div>
      )}

      {step === 'map' && source && mapping && (
        <div className="space-y-6">
          <section aria-labelledby="map-heading" className="card p-5">
            <h2 id="map-heading" className="text-lg font-semibold">
              Check the columns
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              We guessed these from <strong>{source.fileName}</strong> ({source.table.rows.length}{' '}
              rows). Adjust anything that looks wrong.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Date column">
                <select
                  className="input"
                  value={mapping.date}
                  onChange={(e) => setMapping({ ...mapping, date: Number(e.target.value) })}
                >
                  {columnOptions}
                </select>
              </Field>
              <Field label="Description column">
                <select
                  className="input"
                  value={mapping.description}
                  onChange={(e) => setMapping({ ...mapping, description: Number(e.target.value) })}
                >
                  {columnOptions}
                </select>
              </Field>
              <Field label="Date format">
                <select
                  className="input"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value as DateFormatId)}
                >
                  {DATE_FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amounts are in">
                <select
                  className="input"
                  value={mapping.debit !== null ? 'split' : 'single'}
                  onChange={(e) =>
                    setMapping(
                      e.target.value === 'split'
                        ? { ...mapping, amount: null, debit: mapping.amount ?? 0, credit: null }
                        : { ...mapping, amount: mapping.debit ?? 0, debit: null, credit: null },
                    )
                  }
                >
                  <option value="single">One amount column</option>
                  <option value="split">Separate debit / credit columns</option>
                </select>
              </Field>
              {mapping.debit === null ? (
                <>
                  <Field label="Amount column">
                    <select
                      className="input"
                      value={mapping.amount ?? 0}
                      onChange={(e) => setMapping({ ...mapping, amount: Number(e.target.value) })}
                    >
                      {columnOptions}
                    </select>
                  </Field>
                  <Field
                    label="Charges appear as"
                    hint="Most bank accounts show money out as negative"
                  >
                    <select
                      className="input"
                      value={chargeSign}
                      onChange={(e) => setChargeSign(e.target.value as ChargeSign)}
                    >
                      <option value="negative">Negative numbers (−12.99)</option>
                      <option value="positive">Positive numbers (12.99)</option>
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Debit (money out) column">
                    <select
                      className="input"
                      value={mapping.debit}
                      onChange={(e) => setMapping({ ...mapping, debit: Number(e.target.value) })}
                    >
                      {columnOptions}
                    </select>
                  </Field>
                  <Field label="Credit (money in) column">
                    <select
                      className="input"
                      value={mapping.credit ?? ''}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          credit: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    >
                      <option value="">None</option>
                      {columnOptions}
                    </select>
                  </Field>
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="preview-heading" className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
              <h2 id="preview-heading" className="text-lg font-semibold">
                Preview
              </h2>
              {preview && (
                <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
                  {preview.transactions.length} charges · {preview.skippedCredits} money-in rows
                  skipped
                  {preview.errors.length > 0 && ` · ${preview.errors.length} rows couldn’t be read`}
                </p>
              )}
            </div>
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Statement preview"
            >
              <table className="w-full text-left text-sm">
                <caption className="sr-only">First rows of the file as Keepcut reads them</caption>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-2">
                      Date
                    </th>
                    <th scope="col" className="px-5 py-2">
                      Description
                    </th>
                    <th scope="col" className="px-5 py-2 text-right">
                      Charge
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(preview?.transactions ?? []).slice(0, 6).map((t, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-5 py-2">{formatDisplayDate(t.date)}</td>
                      <td className="max-w-xs truncate px-5 py-2">{t.description}</td>
                      <td className="px-5 py-2 text-right tabular-nums">
                        {formatMoney(t.amountMinor, settings.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview && preview.transactions.length === 0 && (
              <p role="alert" className="px-5 py-4 text-sm text-rose-800 dark:text-rose-300">
                No charges found with these settings. Check the date format, amount column and
                whether charges are negative or positive.
              </p>
            )}
            {preview && preview.errors.length > 0 && (
              <details className="border-t border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
                <summary className="cursor-pointer text-amber-800 dark:text-amber-300">
                  Show {Math.min(10, preview.errors.length)} of {preview.errors.length} skipped rows
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                  {preview.errors.slice(0, 10).map((err) => (
                    <li key={err.row}>
                      Line {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="btn-ghost" onClick={reset}>
              <ArrowLeft aria-hidden="true" className="size-4" /> Choose another file
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={runDetection}
              disabled={!preview || preview.transactions.length === 0}
            >
              <ScanSearch aria-hidden="true" className="size-4" /> Find subscriptions
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          {items.length === 0 ? (
            <div className="card p-8 text-center">
              <h2 className="text-lg font-semibold">No recurring charges found</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Try a longer date range (at least 2–3 months) or another card. You can also add
                subscriptions manually.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" className="btn-secondary" onClick={() => setStep('map')}>
                  Back to columns
                </button>
                <Link to="/app/subscriptions/new" className="btn-primary">
                  Add manually
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Found <strong>{items.length}</strong> possible subscriptions. We pre-selected the
                  confident ones — untick anything that isn’t a subscription.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() =>
                      setItems((list) => list.map((i) => ({ ...i, selected: !i.alreadyTracked })))
                    }
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setItems((list) => list.map((i) => ({ ...i, selected: false })))}
                  >
                    Select none
                  </button>
                </div>
              </div>

              <ul className="space-y-3">
                {items.map((item, index) => {
                  const d = item.detection;
                  const update = (patch: Partial<ReviewItem>) =>
                    setItems((list) => list.map((x, j) => (j === index ? { ...x, ...patch } : x)));
                  const checkboxId = `detect-${index}`;
                  return (
                    <li
                      key={d.merchantKey}
                      className={`card p-4 ${item.selected ? 'ring-2 ring-brand-600/40' : ''} ${item.alreadyTracked ? 'opacity-70' : ''}`}
                    >
                      <div className="flex gap-3">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          className="mt-1 size-5 shrink-0 accent-brand-700"
                          checked={item.selected}
                          disabled={item.alreadyTracked}
                          onChange={(e) => update({ selected: e.target.checked })}
                          aria-describedby={`${checkboxId}-meta`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <label htmlFor={checkboxId} className="font-semibold">
                              {item.name || d.name}
                            </label>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CONFIDENCE_STYLES[d.confidenceLabel]}`}
                            >
                              {d.confidenceLabel} confidence
                            </span>
                            {item.alreadyTracked && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 dark:text-brand-300">
                                <CircleCheck aria-hidden="true" className="size-3" /> Already
                                tracked
                              </span>
                            )}
                          </div>
                          <p
                            id={`${checkboxId}-meta`}
                            className="mt-1 text-sm text-slate-600 dark:text-slate-400"
                          >
                            <Money
                              minor={d.amountMinor}
                              currency={settings.currency}
                              className="font-semibold text-slate-900 dark:text-slate-100"
                            />{' '}
                            {d.cycle === 'custom'
                              ? `every ${d.customDays} days`
                              : CYCLE_LABELS[d.cycle].toLowerCase()}{' '}
                            · last charged {formatDisplayDate(d.lastChargedOn)} ·{' '}
                            {d.reasons.join(' · ')}
                          </p>
                          {item.chargedAfterCancel?.cancellation && (
                            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-100">
                              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                              <span>
                                Still charged after you cancelled on{' '}
                                {formatDisplayDate(item.chargedAfterCancel.cancellation.canceledOn)}
                                .
                              </span>
                              <Link
                                to={`/app/subscriptions/${item.chargedAfterCancel.id}`}
                                className="font-semibold underline"
                              >
                                Request a refund
                              </Link>
                            </p>
                          )}
                          {d.priceChange && (
                            <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-amber-800 dark:text-amber-300">
                              <TrendingUp aria-hidden="true" className="size-4" />
                              Price rose from{' '}
                              {formatMoney(d.priceChange.fromMinor, settings.currency)} to{' '}
                              {formatMoney(d.priceChange.toMinor, settings.currency)}
                            </p>
                          )}
                          {item.selected && (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <Field label="Name">
                                <input
                                  className="input"
                                  value={item.name}
                                  maxLength={80}
                                  onChange={(e) => update({ name: e.target.value })}
                                />
                              </Field>
                              <Field label="Category">
                                <select
                                  className="input"
                                  value={item.category}
                                  onChange={(e) => update({ category: e.target.value as Category })}
                                >
                                  {CATEGORIES.map((c) => (
                                    <option key={c}>{c}</option>
                                  ))}
                                </select>
                              </Field>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="card sticky bottom-20 flex flex-wrap items-center justify-between gap-3 p-4 md:bottom-4">
                <p className="text-sm">
                  <strong>{selectedItems.length}</strong> selected · about{' '}
                  <strong>
                    <Money minor={selectedMonthly} currency={settings.currency} />
                  </strong>{' '}
                  per month
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setStep('map')}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={save}
                    disabled={saving || selectedItems.length === 0}
                  >
                    {saving
                      ? 'Adding…'
                      : `Add ${selectedItems.length} subscription${selectedItems.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
