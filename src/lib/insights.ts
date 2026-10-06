import { daysBetween } from './dates';
import { monthlyEquivalent, yearlyEquivalent } from './money';
import { OVERLAP_PRONE_CATEGORIES, type Category, type ISODate, type Subscription } from './types';

export const isBilling = (s: Subscription) => s.status === 'active' || s.status === 'trial';

export const monthlyOf = (s: Subscription) =>
  monthlyEquivalent(s.amountMinor, s.cycle, s.customDays);
export const yearlyOf = (s: Subscription) => yearlyEquivalent(s.amountMinor, s.cycle, s.customDays);

export interface Totals {
  monthlyMinor: number;
  yearlyMinor: number;
  activeCount: number;
  trialCount: number;
  /** What trials will cost per month if none are cancelled. */
  trialMonthlyMinor: number;
}

export function computeTotals(subs: Subscription[]): Totals {
  const active = subs.filter((s) => s.status === 'active');
  const trials = subs.filter((s) => s.status === 'trial');
  const monthlyMinor = active.reduce((sum, s) => sum + monthlyOf(s), 0);
  return {
    monthlyMinor,
    yearlyMinor: active.reduce((sum, s) => sum + yearlyOf(s), 0),
    activeCount: active.length,
    trialCount: trials.length,
    trialMonthlyMinor: trials.reduce((sum, s) => sum + monthlyOf(s), 0),
  };
}

export interface UpcomingCharge {
  subscription: Subscription;
  date: ISODate;
  kind: 'renewal' | 'trial-end';
  daysAway: number;
}

export function upcomingCharges(
  subs: Subscription[],
  today: ISODate,
  withinDays = 30,
): UpcomingCharge[] {
  const out: UpcomingCharge[] = [];
  for (const s of subs) {
    if (s.status === 'trial' && s.trialEndsOn) {
      const d = daysBetween(today, s.trialEndsOn);
      if (d >= 0 && d <= withinDays)
        out.push({ subscription: s, date: s.trialEndsOn, kind: 'trial-end', daysAway: d });
    } else if (s.status === 'active') {
      const d = daysBetween(today, s.nextRenewal);
      if (d >= 0 && d <= withinDays)
        out.push({ subscription: s, date: s.nextRenewal, kind: 'renewal', daysAway: d });
    }
  }
  return out.sort(
    (a, b) => a.daysAway - b.daysAway || b.subscription.amountMinor - a.subscription.amountMinor,
  );
}

export interface OverlapAlert {
  category: Category;
  subscriptions: Subscription[];
  monthlyMinor: number;
}

export function findOverlaps(subs: Subscription[]): OverlapAlert[] {
  const byCategory = new Map<Category, Subscription[]>();
  for (const s of subs.filter(isBilling)) {
    if (!OVERLAP_PRONE_CATEGORIES.includes(s.category)) continue;
    byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  }
  return [...byCategory.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([category, list]) => ({
      category,
      subscriptions: list,
      monthlyMinor: list.reduce((sum, s) => sum + monthlyOf(s), 0),
    }))
    .sort((a, b) => b.monthlyMinor - a.monthlyMinor);
}

export interface PriceIncrease {
  subscription: Subscription;
  fromMinor: number;
  toMinor: number;
  changedOn: ISODate;
}

export function findPriceIncreases(subs: Subscription[]): PriceIncrease[] {
  const out: PriceIncrease[] = [];
  for (const s of subs.filter(isBilling)) {
    const history = [...s.priceHistory].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (let i = history.length - 1; i > 0; i--) {
      const cur = history[i]!;
      const prev = history[i - 1]!;
      if (cur.amountMinor !== prev.amountMinor) {
        if (cur.amountMinor > prev.amountMinor) {
          out.push({
            subscription: s,
            fromMinor: prev.amountMinor,
            toMinor: cur.amountMinor,
            changedOn: cur.date,
          });
        }
        break;
      }
    }
  }
  return out.sort((a, b) => b.toMinor - b.fromMinor - (a.toMinor - a.fromMinor));
}

export interface Savings {
  /** Billing subscriptions the user marked "cut". */
  markedCutMonthlyMinor: number;
  markedCutCount: number;
  /** Billing subscriptions rated 1–2 for usage and not marked keep. */
  lowUsageMonthlyMinor: number;
  lowUsageCount: number;
  /** Subscriptions already cancelled — money no longer leaving each month. */
  savedMonthlyMinor: number;
  savedCount: number;
}

export function computeSavings(subs: Subscription[]): Savings {
  const billing = subs.filter(isBilling);
  const cut = billing.filter((s) => s.decision === 'cut');
  const lowUsage = billing.filter(
    (s) => s.usage !== undefined && s.usage <= 2 && s.decision !== 'keep' && s.decision !== 'cut',
  );
  const canceled = subs.filter((s) => s.status === 'canceled');
  return {
    markedCutMonthlyMinor: cut.reduce((sum, s) => sum + monthlyOf(s), 0),
    markedCutCount: cut.length,
    lowUsageMonthlyMinor: lowUsage.reduce((sum, s) => sum + monthlyOf(s), 0),
    lowUsageCount: lowUsage.length,
    savedMonthlyMinor: canceled.reduce((sum, s) => sum + monthlyOf(s), 0),
    savedCount: canceled.length,
  };
}

export interface CategorySpend {
  category: Category;
  monthlyMinor: number;
  count: number;
  share: number;
}

export function categoryBreakdown(subs: Subscription[]): CategorySpend[] {
  const active = subs.filter((s) => s.status === 'active');
  const total = active.reduce((sum, s) => sum + monthlyOf(s), 0);
  const map = new Map<Category, { monthlyMinor: number; count: number }>();
  for (const s of active) {
    const cur = map.get(s.category) ?? { monthlyMinor: 0, count: 0 };
    map.set(s.category, { monthlyMinor: cur.monthlyMinor + monthlyOf(s), count: cur.count + 1 });
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v, share: total ? v.monthlyMinor / total : 0 }))
    .sort((a, b) => b.monthlyMinor - a.monthlyMinor);
}
