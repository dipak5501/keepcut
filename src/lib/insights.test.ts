import { describe, expect, it } from 'vitest';
import { makeSubscription } from '@/test/factories';
import {
  categoryBreakdown,
  computeSavings,
  computeTotals,
  findOverlaps,
  findPriceIncreases,
  upcomingCharges,
} from './insights';

const TODAY = '2026-06-15';

describe('computeTotals', () => {
  it('sums active subscriptions and reports trials separately', () => {
    const totals = computeTotals([
      makeSubscription({ amountMinor: 1000 }),
      makeSubscription({ amountMinor: 12000, cycle: 'yearly' }),
      makeSubscription({ amountMinor: 2400, status: 'trial', trialEndsOn: '2026-06-17' }),
      makeSubscription({ amountMinor: 5999, status: 'canceled' }),
      makeSubscription({ amountMinor: 999, status: 'paused' }),
    ]);
    expect(totals).toEqual({
      monthlyMinor: 2000,
      yearlyMinor: 24000,
      activeCount: 2,
      trialCount: 1,
      trialMonthlyMinor: 2400,
    });
  });
});

describe('upcomingCharges', () => {
  it('lists renewals and trial ends inside the window, soonest first', () => {
    const list = upcomingCharges(
      [
        makeSubscription({ name: 'Later', nextRenewal: '2026-07-10' }),
        makeSubscription({ name: 'Soon', nextRenewal: '2026-06-16' }),
        makeSubscription({
          name: 'Trial',
          status: 'trial',
          trialEndsOn: '2026-06-15',
          nextRenewal: '2026-06-15',
        }),
        makeSubscription({ name: 'Too far', nextRenewal: '2026-08-30' }),
        makeSubscription({ name: 'Past', nextRenewal: '2026-06-01' }),
        makeSubscription({ name: 'Canceled', status: 'canceled', nextRenewal: '2026-06-16' }),
      ],
      TODAY,
      30,
    );
    expect(list.map((u) => [u.subscription.name, u.kind, u.daysAway])).toEqual([
      ['Trial', 'trial-end', 0],
      ['Soon', 'renewal', 1],
      ['Later', 'renewal', 25],
    ]);
  });
});

describe('findOverlaps', () => {
  it('flags two or more billing services in an overlap-prone category', () => {
    const alerts = findOverlaps([
      makeSubscription({ name: 'ChatGPT', category: 'AI tools', amountMinor: 2000 }),
      makeSubscription({ name: 'Claude', category: 'AI tools', amountMinor: 2000 }),
      makeSubscription({ name: 'Gemini', category: 'AI tools', status: 'canceled' }),
      makeSubscription({ name: 'Netflix', category: 'Streaming' }),
      makeSubscription({ name: 'Adobe', category: 'Software' }),
      makeSubscription({ name: 'Notion', category: 'Software' }),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.category).toBe('AI tools');
    expect(alerts[0]!.monthlyMinor).toBe(4000);
    expect(alerts[0]!.subscriptions.map((s) => s.name)).toEqual(['ChatGPT', 'Claude']);
  });
});

describe('findPriceIncreases', () => {
  it('reports the most recent increase only', () => {
    const result = findPriceIncreases([
      makeSubscription({
        name: 'Netflix',
        amountMinor: 1799,
        priceHistory: [
          { date: '2026-01-01', amountMinor: 1549 },
          { date: '2026-04-01', amountMinor: 1799 },
        ],
      }),
      makeSubscription({
        name: 'Cheaper',
        priceHistory: [
          { date: '2026-01-01', amountMinor: 2000 },
          { date: '2026-04-01', amountMinor: 1000 },
        ],
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fromMinor: 1549, toMinor: 1799, changedOn: '2026-04-01' });
  });
});

describe('computeSavings', () => {
  it('separates marked-to-cut, low-usage and already-cancelled spend', () => {
    const savings = computeSavings([
      makeSubscription({ amountMinor: 1199, decision: 'cut' }),
      makeSubscription({ amountMinor: 3999, usage: 1 }),
      makeSubscription({ amountMinor: 500, usage: 2, decision: 'keep' }),
      makeSubscription({ amountMinor: 5999, status: 'canceled' }),
    ]);
    expect(savings).toEqual({
      markedCutMonthlyMinor: 1199,
      markedCutCount: 1,
      lowUsageMonthlyMinor: 3999,
      lowUsageCount: 1,
      savedMonthlyMinor: 5999,
      savedCount: 1,
    });
  });
});

describe('categoryBreakdown', () => {
  it('groups active monthly spend by category with shares', () => {
    const result = categoryBreakdown([
      makeSubscription({ category: 'AI tools', amountMinor: 3000 }),
      makeSubscription({ category: 'Streaming', amountMinor: 1000 }),
      makeSubscription({ category: 'Streaming', status: 'canceled', amountMinor: 9999 }),
    ]);
    expect(result).toEqual([
      { category: 'AI tools', monthlyMinor: 3000, count: 1, share: 0.75 },
      { category: 'Streaming', monthlyMinor: 1000, count: 1, share: 0.25 },
    ]);
  });

  it('handles an empty list', () => {
    expect(categoryBreakdown([])).toEqual([]);
  });
});
