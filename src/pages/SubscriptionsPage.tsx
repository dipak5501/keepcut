import { Check, ChevronRight, ListChecks, Plus, Search, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useToast } from '@/hooks/useToast';
import {
  DecisionBadge,
  EmptyState,
  Money,
  PageHeader,
  StatusBadge,
  UsageMeter,
} from '@/components/ui';
import { useAppData } from '@/hooks/useAppData';
import { formatDisplayDate, relativeDays } from '@/lib/dates';
import { repository } from '@/lib/db/repository';
import { monthlyOf } from '@/lib/insights';
import { logger } from '@/lib/logger';
import {
  CATEGORIES,
  CYCLE_LABELS,
  DECISIONS,
  DECISION_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Decision,
  type Subscription,
} from '@/lib/types';

const SORTS = {
  renewal: 'Next renewal',
  cost: 'Monthly cost (high to low)',
  name: 'Name (A–Z)',
} as const;
type SortKey = keyof typeof SORTS;

function cycleText(s: Subscription) {
  return s.cycle === 'custom' ? `every ${s.customDays} days` : CYCLE_LABELS[s.cycle].toLowerCase();
}

export function SubscriptionsPage() {
  const { subscriptions, settings, today } = useAppData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const query = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const decision = params.get('decision') ?? '';
  const sort = (params.get('sort') as SortKey | null) ?? 'renewal';

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const needle = query.trim().toLowerCase();
  const filtered = subscriptions
    .filter(
      (s) =>
        !needle || s.name.toLowerCase().includes(needle) || s.notes?.toLowerCase().includes(needle),
    )
    .filter((s) => !status || s.status === status)
    .filter((s) => !category || s.category === category)
    .filter((s) => !decision || (decision === 'none' ? !s.decision : s.decision === decision))
    .sort((a, b) => {
      if (sort === 'cost') return monthlyOf(b) - monthlyOf(a);
      if (sort === 'name') return a.name.localeCompare(b.name);
      const aDate =
        a.status === 'canceled'
          ? '9999'
          : a.status === 'trial' && a.trialEndsOn
            ? a.trialEndsOn
            : a.nextRenewal;
      const bDate =
        b.status === 'canceled'
          ? '9999'
          : b.status === 'trial' && b.trialEndsOn
            ? b.trialEndsOn
            : b.nextRenewal;
      return aDate.localeCompare(bDate);
    });

  const filteredIds = filtered.map((s) => s.id);
  const allVisibleSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const selectedIds = useMemo(() => {
    const alive = new Set(subscriptions.map((s) => s.id));
    return [...selected].filter((id) => alive.has(id));
  }, [selected, subscriptions]);
  const selectedCount = selectedIds.length;

  const hasFilters = Boolean(query || status || category || decision);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const id of filteredIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of filteredIds) next.add(id);
      return next;
    });
  };

  const applyDecision = async (value: Decision | undefined, label: string) => {
    if (selectedCount === 0) return;
    setBusy(true);
    try {
      const count = await repository.setDecisions(selectedIds, value);
      toast.show(
        value
          ? `Marked ${count} subscription${count === 1 ? '' : 's'} as ${label}.`
          : `Cleared the decision on ${count} subscription${count === 1 ? '' : 's'}.`,
      );
      setSelected(new Set());
    } catch (error) {
      logger.error('Bulk decision failed', error);
      toast.show('Could not update those subscriptions.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Everything you pay for on repeat. Select several to keep or cut in one go."
        actions={
          <Link to="/app/subscriptions/new" className="btn-primary">
            <Plus aria-hidden="true" className="size-4" /> Add subscription
          </Link>
        }
      />

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No subscriptions yet"
          actions={
            <>
              <Link to="/app/import" className="btn-primary">
                <Upload aria-hidden="true" className="size-4" /> Import a statement
              </Link>
              <Link to="/app/subscriptions/new" className="btn-secondary">
                Add manually
              </Link>
            </>
          }
        >
          Import a bank CSV to detect them automatically, or add them one by one.
        </EmptyState>
      ) : (
        <>
          <form
            role="search"
            className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="filter-q" className="label">
                Search
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="filter-q"
                  type="search"
                  className="input pl-9"
                  placeholder="Name or note"
                  value={query}
                  onChange={(e) => update('q', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="filter-status" className="label">
                Status
              </label>
              <select
                id="filter-status"
                className="input"
                value={status}
                onChange={(e) => update('status', e.target.value)}
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-category" className="label">
                Category
              </label>
              <select
                id="filter-category"
                className="input"
                value={category}
                onChange={(e) => update('category', e.target.value)}
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-decision" className="label">
                Decision
              </label>
              <select
                id="filter-decision"
                className="input"
                value={decision}
                onChange={(e) => update('decision', e.target.value)}
              >
                <option value="">Any decision</option>
                <option value="none">Undecided</option>
                {DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {DECISION_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-sort" className="label">
                Sort by
              </label>
              <select
                id="filter-sort"
                className="input"
                value={sort}
                onChange={(e) => update('sort', e.target.value)}
              >
                {Object.entries(SORTS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </form>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400">
            <p aria-live="polite">
              Showing {filtered.length} of {subscriptions.length}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {filtered.length > 0 && (
                <button type="button" className="link" onClick={toggleAllVisible}>
                  {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
                </button>
              )}
              {hasFilters && (
                <button
                  type="button"
                  className="link"
                  onClick={() => setParams(new URLSearchParams(), { replace: true })}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              No subscriptions match these filters.
            </div>
          ) : (
            <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
              {filtered.map((s) => {
                const isSelected = selected.has(s.id);
                const checkboxId = `select-${s.id}`;
                return (
                  <li
                    key={s.id}
                    className={isSelected ? 'bg-brand-50/60 dark:bg-brand-950/30' : ''}
                  >
                    <div className="flex items-stretch gap-0">
                      <div className="flex items-center px-3 sm:px-4">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          className="size-5 accent-brand-700"
                          checked={isSelected}
                          onChange={() => toggleOne(s.id)}
                          aria-label={`Select ${s.name}`}
                        />
                      </div>
                      <Link
                        to={`/app/subscriptions/${s.id}`}
                        className="flex min-w-0 flex-1 flex-col gap-3 py-4 pr-4 hover:bg-slate-50 sm:flex-row sm:items-center dark:hover:bg-slate-800/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold">{s.name}</span>
                            <StatusBadge status={s.status} />
                            {s.decision && <DecisionBadge decision={s.decision} />}
                          </div>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {s.category}
                            {' · '}
                            {s.status === 'canceled'
                              ? `Cancelled ${s.cancellation ? formatDisplayDate(s.cancellation.canceledOn) : ''}`
                              : s.status === 'trial' && s.trialEndsOn
                                ? `Trial ends ${relativeDays(s.trialEndsOn, today)}`
                                : s.status === 'paused'
                                  ? 'Paused'
                                  : `Renews ${relativeDays(s.nextRenewal, today)}`}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-6 sm:justify-end">
                          <UsageMeter usage={s.usage} />
                          <div className="text-right">
                            <Money
                              minor={s.amountMinor}
                              currency={settings.currency}
                              className="font-semibold"
                            />
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {cycleText(s)}
                            </p>
                          </div>
                          <ChevronRight
                            aria-hidden="true"
                            className="hidden size-4 text-slate-400 sm:block"
                          />
                        </div>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedCount > 0 && (
            <div
              role="toolbar"
              aria-label="Bulk decisions"
              className="card sticky bottom-20 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 border-brand-200 p-3 shadow-lg md:bottom-4 dark:border-brand-800"
            >
              <p className="text-sm font-medium" aria-live="polite">
                {selectedCount} selected
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => void applyDecision('keep', DECISION_LABELS.keep)}
                >
                  <Check aria-hidden="true" className="size-4" /> Keep
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => void applyDecision('review', DECISION_LABELS.review)}
                >
                  Review
                </button>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  disabled={busy}
                  onClick={() => void applyDecision('cut', DECISION_LABELS.cut)}
                >
                  Cut
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => void applyDecision(undefined, 'undecided')}
                >
                  Clear decision
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
