import { ChevronRight, ListChecks, Plus, Search, Upload } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
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
import { monthlyOf } from '@/lib/insights';
import {
  CATEGORIES,
  CYCLE_LABELS,
  DECISIONS,
  DECISION_LABELS,
  STATUSES,
  STATUS_LABELS,
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
  const [params, setParams] = useSearchParams();
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

  const hasFilters = Boolean(query || status || category || decision);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Everything you pay for on repeat. Open one to rate it, decide, or cancel."
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

          <div className="mb-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <p aria-live="polite">
              Showing {filtered.length} of {subscriptions.length}
            </p>
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

          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              No subscriptions match these filters.
            </div>
          ) : (
            <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
              {filtered.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/app/subscriptions/${s.id}`}
                    className="flex flex-col gap-3 px-4 py-4 hover:bg-slate-50 sm:flex-row sm:items-center dark:hover:bg-slate-800/50"
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
                        <p className="text-xs text-slate-600 dark:text-slate-400">{cycleText(s)}</p>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="hidden size-4 text-slate-400 sm:block"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
