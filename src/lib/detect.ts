import type { Transaction } from './csv';
import { daysBetween, nextRenewalAfter } from './dates';
import { cleanMerchantName, matchKnownMerchant, merchantKeyFor } from './merchants';
import type { Category, Cycle, ISODate, PricePoint } from './types';

export interface DetectedSubscription {
  merchantKey: string;
  name: string;
  category: Category;
  known: boolean;
  /** Most recent charge amount, in minor units. */
  amountMinor: number;
  cycle: Cycle;
  customDays?: number;
  lastChargedOn: ISODate;
  nextRenewal: ISODate;
  charges: PricePoint[];
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'low';
  priceChange?: { fromMinor: number; toMinor: number; changedOn: ISODate };
  /** No charge for noticeably longer than one cycle before the statement ended. */
  likelyInactive: boolean;
  reasons: string[];
}

interface CadenceRule {
  cycle: Exclude<Cycle, 'custom'>;
  days: number;
  min: number;
  max: number;
  tolerance: number;
}

const CADENCES: CadenceRule[] = [
  { cycle: 'weekly', days: 7, min: 6, max: 8, tolerance: 2 },
  { cycle: 'biweekly', days: 14, min: 12, max: 16, tolerance: 3 },
  { cycle: 'monthly', days: 30.4, min: 26, max: 35, tolerance: 4 },
  { cycle: 'quarterly', days: 91, min: 84, max: 98, tolerance: 10 },
  { cycle: 'yearly', days: 365, min: 340, max: 390, tolerance: 25 },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function classify(intervalDays: number): CadenceRule | undefined {
  return CADENCES.find((c) => intervalDays >= c.min && intervalDays <= c.max);
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(100, Math.round(Math.max(a, b) * 0.05));
}

function labelFor(confidence: number): DetectedSubscription['confidenceLabel'] {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

export interface DetectOptions {
  today: ISODate;
  /** Candidates below this confidence are dropped. */
  minConfidence?: number;
}

/**
 * Finds recurring charges in a list of outgoing transactions. Works entirely on-device:
 * group by normalised merchant, infer cadence from the median gap between charges, then
 * score regularity, amount stability and history length.
 */
export function detectRecurring(
  transactions: Transaction[],
  options: DetectOptions,
): DetectedSubscription[] {
  const minConfidence = options.minConfidence ?? 0.5;
  if (transactions.length === 0) return [];

  const statementEnd = transactions.reduce(
    (max, t) => (t.date > max ? t.date : max),
    transactions[0]!.date,
  );
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = merchantKeyFor(t.description);
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }

  const results: DetectedSubscription[] = [];

  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    // Collapse same-day duplicates (pending + posted copies).
    const charges = sorted.filter(
      (t, i) =>
        i === 0 ||
        !(t.date === sorted[i - 1]!.date && t.amountMinor === sorted[i - 1]!.amountMinor),
    );
    const known = matchKnownMerchant(charges[0]!.description);
    const name = known?.name ?? cleanMerchantName(charges[0]!.description);
    const category: Category = known?.category ?? 'Other';
    const last = charges[charges.length - 1]!;
    const reasons: string[] = [];

    let cycle: Cycle;
    let customDays: number | undefined;
    let regularity: number;
    let expectedGap: number;
    let tolerance: number;

    if (charges.length === 1) {
      if (!known) continue;
      cycle = 'monthly';
      regularity = 0;
      expectedGap = 30.4;
      tolerance = 4;
      reasons.push('Seen once — a known subscription service. Confirm the billing cycle.');
    } else {
      const gaps = charges.slice(1).map((t, i) => daysBetween(charges[i]!.date, t.date));
      const medianGap = median(gaps);
      const rule = classify(medianGap);
      if (rule) {
        cycle = rule.cycle;
        expectedGap = rule.days;
        tolerance = rule.tolerance;
      } else {
        const spread = Math.max(...gaps) - Math.min(...gaps);
        if (charges.length < 3 || medianGap < 20 || medianGap > 400 || spread > 6) {
          if (!known) continue;
        }
        cycle = 'custom';
        customDays = Math.round(medianGap);
        expectedGap = medianGap;
        tolerance = Math.max(3, medianGap * 0.1);
      }
      regularity = gaps.filter((g) => Math.abs(g - expectedGap) <= tolerance).length / gaps.length;
      reasons.push(`${charges.length} charges about every ${Math.round(medianGap)} days`);
    }

    const stableCount = charges.filter((c) => amountsClose(c.amountMinor, last.amountMinor)).length;
    let amountStability = stableCount / charges.length;

    // A single step up (price increase) still counts as stable billing.
    let priceChange: DetectedSubscription['priceChange'];
    const firstAtLatest = charges.findIndex((_, i) =>
      charges.slice(i).every((x) => amountsClose(x.amountMinor, last.amountMinor)),
    );
    if (firstAtLatest > 0) {
      const before = charges.slice(0, firstAtLatest);
      const prev = before[before.length - 1]!;
      const beforeStable = before.every((c) => amountsClose(c.amountMinor, prev.amountMinor));
      if (beforeStable && last.amountMinor > prev.amountMinor) {
        amountStability = 1;
        priceChange = {
          fromMinor: prev.amountMinor,
          toMinor: last.amountMinor,
          changedOn: charges[firstAtLatest]!.date,
        };
        reasons.push('Price went up during this period');
      }
    }

    const history = Math.min(1, (charges.length - 1) / 3);
    let confidence = 0.45 * regularity + 0.3 * amountStability + 0.15 * history + (known ? 0.1 : 0);
    if (charges.length === 1) confidence = 0.45;
    else if (charges.length === 2 && !known) confidence *= 0.8;
    confidence = Math.round(Math.min(1, confidence) * 100) / 100;

    if (confidence < minConfidence) continue;

    const sinceLast = daysBetween(last.date, statementEnd);
    const likelyInactive = charges.length > 1 && sinceLast > expectedGap * 1.5 + tolerance;
    if (likelyInactive)
      reasons.push(
        `No charge in the last ${sinceLast} days of the statement — may already be canceled`,
      );

    results.push({
      merchantKey: key,
      name,
      category,
      known: Boolean(known),
      amountMinor: last.amountMinor,
      cycle,
      ...(customDays ? { customDays } : {}),
      lastChargedOn: last.date,
      nextRenewal: nextRenewalAfter(last.date, cycle, options.today, customDays),
      charges: charges.map((c) => ({ date: c.date, amountMinor: c.amountMinor })),
      confidence,
      confidenceLabel: labelFor(confidence),
      ...(priceChange ? { priceChange } : {}),
      likelyInactive,
      reasons,
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence || b.amountMinor - a.amountMinor);
}
