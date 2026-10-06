import { describe, expect, it } from 'vitest';
import { guessMapping, normalizeTransactions, parseCsvText, type Transaction } from './csv';
import { addCycle } from './dates';
import { buildSampleStatementCsv } from './demo';
import { detectRecurring } from './detect';

const TODAY = '2026-06-15';

function series(
  description: string,
  start: string,
  cycle: 'weekly' | 'monthly' | 'yearly',
  count: number,
  amount: number | number[],
): Transaction[] {
  return Array.from({ length: count }, (_, i) => ({
    date: addCycle(start, cycle, 30, i),
    description,
    amountMinor: Array.isArray(amount) ? amount[i]! : amount,
  }));
}

describe('detectRecurring', () => {
  it('finds a monthly subscription with high confidence', () => {
    const result = detectRecurring(
      series('NETFLIX.COM 866-579-7172', '2026-02-03', 'monthly', 4, 1799),
      { today: TODAY },
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Netflix',
      category: 'Streaming',
      cycle: 'monthly',
      amountMinor: 1799,
      lastChargedOn: '2026-05-03',
      nextRenewal: '2026-07-03',
      confidenceLabel: 'high',
      likelyInactive: false,
    });
  });

  it('detects weekly charges from unknown merchants', () => {
    const result = detectRecurring(series('GREENBOX MEAL KITS', '2026-04-01', 'weekly', 8, 5995), {
      today: TODAY,
    });
    expect(result[0]).toMatchObject({
      name: 'Greenbox Meal Kits',
      cycle: 'weekly',
      category: 'Other',
    });
    expect(result[0]!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('flags price increases', () => {
    const result = detectRecurring(
      series('NETFLIX', '2026-01-03', 'monthly', 5, [1549, 1549, 1799, 1799, 1799]),
      { today: TODAY },
    );
    expect(result[0]!.priceChange).toEqual({
      fromMinor: 1549,
      toMinor: 1799,
      changedOn: '2026-03-03',
    });
    expect(result[0]!.confidenceLabel).toBe('high');
  });

  it('marks merchants that stopped charging as likely inactive', () => {
    const txs = [
      ...series('HULU 877-8244858', '2026-01-05', 'monthly', 2, 999),
      { date: '2026-06-01', description: 'OTHER SHOP', amountMinor: 100 },
    ];
    const hulu = detectRecurring(txs, { today: TODAY }).find((d) => d.name === 'Hulu');
    expect(hulu?.likelyInactive).toBe(true);
  });

  it('ignores irregular spending such as groceries', () => {
    const txs: Transaction[] = [
      { date: '2026-01-02', description: "TRADER JOE'S #552", amountMinor: 4512 },
      { date: '2026-01-09', description: "TRADER JOE'S #552", amountMinor: 9120 },
      { date: '2026-01-11', description: "TRADER JOE'S #552", amountMinor: 2380 },
      { date: '2026-01-30', description: "TRADER JOE'S #552", amountMinor: 13999 },
      { date: '2026-02-03', description: "TRADER JOE'S #552", amountMinor: 6050 },
    ];
    expect(detectRecurring(txs, { today: TODAY })).toEqual([]);
  });

  it('surfaces a single charge only for known subscription services', () => {
    const txs: Transaction[] = [
      { date: '2026-03-01', description: 'DUOLINGO SUPER', amountMinor: 8399 },
      { date: '2026-03-01', description: 'RANDOM HARDWARE STORE', amountMinor: 8399 },
    ];
    const result = detectRecurring(txs, { today: TODAY, minConfidence: 0.4 });
    expect(result.map((r) => r.name)).toEqual(['Duolingo']);
    expect(result[0]!.confidenceLabel).toBe('low');
  });

  it('collapses duplicate pending/posted rows', () => {
    const txs = [
      ...series('SPOTIFY USA', '2026-03-09', 'monthly', 3, 1199),
      { date: '2026-03-09', description: 'SPOTIFY USA', amountMinor: 1199 },
    ];
    expect(detectRecurring(txs, { today: TODAY })[0]!.charges).toHaveLength(3);
  });

  it('returns an empty list for no transactions', () => {
    expect(detectRecurring([], { today: TODAY })).toEqual([]);
  });
});

describe('sample statement end-to-end', () => {
  it('detects the expected subscriptions and ignores everyday spending', () => {
    const table = parseCsvText(buildSampleStatementCsv(TODAY));
    const { transactions, errors } = normalizeTransactions(table, {
      mapping: guessMapping(table),
      dateFormat: 'mdy',
      chargeSign: 'negative',
      currency: 'USD',
    });
    expect(errors).toEqual([]);

    const detected = detectRecurring(transactions, { today: TODAY });
    const names = detected.map((d) => d.name);
    for (const expected of [
      'Netflix',
      'ChatGPT',
      'Claude',
      'Spotify',
      'iCloud+',
      'Google One',
      'Disney+',
      'Hulu',
      'Adobe',
      'City Gym Membership',
      'Greenbox Meal Kits',
    ]) {
      expect(names).toContain(expected);
    }
    for (const noise of ["Trader Joe's", 'Shell Oil Oakland', 'Blue Kettle Coffee', 'Uber Trip']) {
      expect(names).not.toContain(noise);
    }
    expect(detected.find((d) => d.name === 'Netflix')?.priceChange).toBeDefined();
    expect(detected.find((d) => d.name === 'Hulu')?.likelyInactive).toBe(true);
    expect(detected.find((d) => d.name === 'Greenbox Meal Kits')?.cycle).toBe('weekly');
  });
});
