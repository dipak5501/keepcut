import {
  CalendarDays,
  ChevronRight,
  Clock,
  Layers,
  ListChecks,
  PiggyBank,
  Plus,
  Scissors,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Upload,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useToast } from '@/hooks/useToast';
import { EmptyState, Money, PageHeader } from '@/components/ui';
import { useAppData } from '@/hooks/useAppData';
import { formatDisplayDate, relativeDays } from '@/lib/dates';
import { repository } from '@/lib/db/repository';
import {
  categoryBreakdown,
  computeSavings,
  computeTotals,
  findOverlaps,
  findPriceIncreases,
  monthlyOf,
  upcomingCharges,
} from '@/lib/insights';
import { logger } from '@/lib/logger';
import { formatMoney } from '@/lib/money';
import type { Currency } from '@/lib/types';

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{detail}</p>}
    </div>
  );
}

interface Attention {
  key: string;
  icon: LucideIcon;
  tone: 'rose' | 'amber' | 'slate';
  title: string;
  body: string;
  to: string;
}

const TONE_CLASSES: Record<Attention['tone'], string> = {
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function DashboardPage() {
  const { subscriptions, settings, today } = useAppData();
  const toast = useToast();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const currency: Currency = settings.currency;
  const fmt = (minor: number) => formatMoney(minor, currency);

  if (subscriptions.length === 0) {
    const loadDemo = async () => {
      setLoadingDemo(true);
      try {
        const count = await repository.loadDemoData();
        toast.show(`Loaded ${count} demo subscriptions.`);
      } catch (error) {
        logger.error('Demo load failed', error);
        toast.show('Could not load demo data.', 'error');
      } finally {
        setLoadingDemo(false);
      }
    };
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={Sparkles}
          title="Let’s find your subscriptions"
          actions={
            <>
              <Link to="/app/import" className="btn-primary">
                <Upload aria-hidden="true" className="size-4" /> Import a statement
              </Link>
              <Link to="/app/subscriptions/new" className="btn-secondary">
                <Plus aria-hidden="true" className="size-4" /> Add one manually
              </Link>
              <button type="button" className="btn-ghost" onClick={loadDemo} disabled={loadingDemo}>
                {loadingDemo ? 'Loading…' : 'Explore with demo data'}
              </button>
            </>
          }
        >
          Import a CSV export from your bank or card and Keepcut will detect recurring charges on
          this device. Nothing is uploaded.
        </EmptyState>
      </>
    );
  }

  const totals = computeTotals(subscriptions);
  const savings = computeSavings(subscriptions);
  const overlaps = findOverlaps(subscriptions);
  const increases = findPriceIncreases(subscriptions);
  const upcoming = upcomingCharges(subscriptions, today, 30);
  const breakdown = categoryBreakdown(subscriptions);
  const endingTrials = upcoming.filter((u) => u.kind === 'trial-end' && u.daysAway <= 7);

  const attention: Attention[] = [
    ...endingTrials.map((t) => ({
      key: `trial-${t.subscription.id}`,
      icon: Clock,
      tone: 'rose' as const,
      title: `${t.subscription.name} trial ends ${relativeDays(t.date, today)}`,
      body: `It becomes ${fmt(t.subscription.amountMinor)} after that. Cancel now if you won’t keep it.`,
      to: `/app/subscriptions/${t.subscription.id}`,
    })),
    ...subscriptions
      .filter((s) => s.status === 'active' && s.decision === 'cut')
      .map((s) => ({
        key: `cut-${s.id}`,
        icon: Scissors,
        tone: 'rose' as const,
        title: `Cancel ${s.name} before it renews ${relativeDays(s.nextRenewal, today)}`,
        body: `You marked it to cut. The cancel assistant walks you through it.`,
        to: `/app/subscriptions/${s.id}`,
      })),
    ...overlaps.map((o) => ({
      key: `overlap-${o.category}`,
      icon: Layers,
      tone: 'amber' as const,
      title: `${o.subscriptions.length} ${o.category} subscriptions (${fmt(o.monthlyMinor)}/mo)`,
      body: `${o.subscriptions.map((s) => s.name).join(', ')} — do they really do different jobs?`,
      to: `/app/subscriptions?category=${encodeURIComponent(o.category)}`,
    })),
    ...increases.map((p) => ({
      key: `price-${p.subscription.id}`,
      icon: TrendingUp,
      tone: 'amber' as const,
      title: `${p.subscription.name} went up ${fmt(p.toMinor - p.fromMinor)}`,
      body: `From ${fmt(p.fromMinor)} to ${fmt(p.toMinor)} on ${formatDisplayDate(p.changedOn)}.`,
      to: `/app/subscriptions/${p.subscription.id}`,
    })),
    ...subscriptions
      .filter(
        (s) =>
          (s.status === 'active' || s.status === 'trial') &&
          s.usage !== undefined &&
          s.usage <= 2 &&
          !s.decision,
      )
      .map((s) => ({
        key: `usage-${s.id}`,
        icon: TriangleAlert,
        tone: 'slate' as const,
        title: `You rarely use ${s.name}`,
        body: `It costs ${fmt(monthlyOf(s))}/mo. Decide whether to keep or cut it.`,
        to: `/app/subscriptions/${s.id}`,
      })),
  ];

  const potentialMonthly = savings.markedCutMonthlyMinor + savings.lowUsageMonthlyMinor;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${totals.activeCount} active subscription${totals.activeCount === 1 ? '' : 's'} tracked on this device`}
        actions={
          <>
            <Link to="/app/import" className="btn-secondary">
              <Upload aria-hidden="true" className="size-4" /> Import
            </Link>
            <Link to="/app/subscriptions/new" className="btn-primary">
              <Plus aria-hidden="true" className="size-4" /> Add subscription
            </Link>
          </>
        }
      />

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Monthly spend"
          value={<Money minor={totals.monthlyMinor} currency={currency} />}
          detail={<>{fmt(totals.yearlyMinor)} per year</>}
        />
        <StatCard
          icon={ListChecks}
          label="Active subscriptions"
          value={totals.activeCount}
          detail={
            totals.trialCount
              ? `${totals.trialCount} free trial${totals.trialCount === 1 ? '' : 's'} running`
              : 'No trials running'
          }
        />
        <StatCard
          icon={Sparkles}
          label="Potential savings"
          value={<Money minor={potentialMonthly * 12} currency={currency} />}
          detail={`per year from ${savings.markedCutCount + savings.lowUsageCount} marked or rarely used`}
        />
        <StatCard
          icon={PiggyBank}
          label="Already cut"
          value={<Money minor={savings.savedMonthlyMinor} currency={currency} />}
          detail={`per month across ${savings.savedCount} cancelled`}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="attention-heading" className="card p-5 lg:col-span-2">
          <h2 id="attention-heading" className="text-lg font-semibold">
            Needs your attention
          </h2>
          {attention.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              Nothing urgent. Rate how much you use each subscription to surface savings.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link
                    to={a.to}
                    className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className={`rounded-lg p-2 ${TONE_CLASSES[a.tone]}`}>
                      <a.icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{a.title}</span>
                      <span className="block text-sm text-slate-600 dark:text-slate-400">
                        {a.body}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="mt-2 size-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="upcoming-heading" className="card p-5">
          <div className="flex items-center justify-between">
            <h2 id="upcoming-heading" className="text-lg font-semibold">
              Next 30 days
            </h2>
            <Link to="/app/calendar" className="link text-sm">
              Calendar
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              No renewals in the next 30 days.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {upcoming.slice(0, 8).map((u) => (
                <li
                  key={`${u.kind}-${u.subscription.id}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <Link
                        to={`/app/subscriptions/${u.subscription.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {u.subscription.name}
                      </Link>
                      <span className="block text-xs text-slate-600 dark:text-slate-400">
                        {u.kind === 'trial-end' ? 'Trial ends' : 'Renews'}{' '}
                        {relativeDays(u.date, today)}
                      </span>
                    </span>
                  </span>
                  <Money
                    minor={u.subscription.amountMinor}
                    currency={currency}
                    className="font-semibold"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {breakdown.length > 0 && (
        <section aria-labelledby="breakdown-heading" className="card mt-6 p-5">
          <h2 id="breakdown-heading" className="text-lg font-semibold">
            Monthly spend by category
          </h2>
          <ul className="mt-4 space-y-3">
            {breakdown.map((c) => (
              <li key={c.category}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {c.category}{' '}
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      · {c.count}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {fmt(c.monthlyMinor)}{' '}
                    <span className="text-slate-500 dark:text-slate-400">
                      ({Math.round(c.share * 100)}%)
                    </span>
                  </span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-brand-600 dark:bg-brand-400"
                    style={{ width: `${Math.max(2, c.share * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
