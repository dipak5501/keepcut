import { addCycle, shiftDays } from './dates';
import { merchantKeyFor } from './merchants';
import type { Category, Cycle, ISODate, PricePoint, Status, Subscription } from './types';

interface DemoSpec {
  name: string;
  merchantHint: string;
  amount: number;
  cycle: Cycle;
  category: Category;
  status?: Status;
  renewInDays: number;
  usage?: number;
  decision?: Subscription['decision'];
  trialEndsInDays?: number;
  previousAmount?: number;
  canceledDaysAgo?: number;
  confirmation?: string;
  notes?: string;
}

const DEMO_SPECS: DemoSpec[] = [
  {
    name: 'ChatGPT Plus',
    merchantHint: 'OPENAI CHATGPT',
    amount: 20,
    cycle: 'monthly',
    category: 'AI tools',
    renewInDays: 5,
    usage: 4,
  },
  {
    name: 'Claude Pro',
    merchantHint: 'CLAUDE.AI',
    amount: 20,
    cycle: 'monthly',
    category: 'AI tools',
    renewInDays: 12,
    usage: 5,
    decision: 'keep',
  },
  {
    name: 'Cursor Pro',
    merchantHint: 'CURSOR',
    amount: 20,
    cycle: 'monthly',
    category: 'AI tools',
    renewInDays: 19,
    usage: 3,
  },
  {
    name: 'Netflix',
    merchantHint: 'NETFLIX',
    amount: 17.99,
    previousAmount: 15.49,
    cycle: 'monthly',
    category: 'Streaming',
    renewInDays: 8,
    usage: 3,
  },
  {
    name: 'Disney+',
    merchantHint: 'DISNEY PLUS',
    amount: 11.99,
    cycle: 'monthly',
    category: 'Streaming',
    renewInDays: 3,
    usage: 1,
    decision: 'cut',
  },
  {
    name: 'Max',
    merchantHint: 'HBO MAX',
    amount: 16.99,
    cycle: 'monthly',
    category: 'Streaming',
    renewInDays: 22,
    usage: 2,
  },
  {
    name: 'Spotify Premium',
    merchantHint: 'SPOTIFY',
    amount: 11.99,
    cycle: 'monthly',
    category: 'Music & audio',
    renewInDays: 14,
    usage: 5,
    decision: 'keep',
  },
  {
    name: 'iCloud+ 200 GB',
    merchantHint: 'ICLOUD',
    amount: 2.99,
    cycle: 'monthly',
    category: 'Cloud storage',
    renewInDays: 10,
    usage: 4,
  },
  {
    name: 'Google One 100 GB',
    merchantHint: 'GOOGLE ONE',
    amount: 1.99,
    cycle: 'monthly',
    category: 'Cloud storage',
    renewInDays: 26,
    usage: 2,
    decision: 'review',
  },
  {
    name: 'Peloton App',
    merchantHint: 'PELOTON',
    amount: 24,
    cycle: 'monthly',
    category: 'Fitness & health',
    status: 'trial',
    renewInDays: 2,
    trialEndsInDays: 2,
    notes: 'Signed up for the 30-day trial. Decide before it converts.',
  },
  {
    name: 'City Gym membership',
    merchantHint: 'CITY GYM',
    amount: 39.99,
    cycle: 'monthly',
    category: 'Fitness & health',
    renewInDays: 17,
    usage: 1,
    decision: 'review',
    notes: 'Went twice since January.',
  },
  {
    name: 'Duolingo Super',
    merchantHint: 'DUOLINGO',
    amount: 83.99,
    cycle: 'yearly',
    category: 'Education',
    renewInDays: 40,
    usage: 2,
  },
  {
    name: 'Amazon Prime',
    merchantHint: 'AMAZON PRIME',
    amount: 139,
    cycle: 'yearly',
    category: 'Shopping & delivery',
    renewInDays: 75,
    usage: 4,
    decision: 'keep',
  },
  {
    name: 'Adobe Creative Cloud',
    merchantHint: 'ADOBE',
    amount: 59.99,
    cycle: 'monthly',
    category: 'Software',
    status: 'canceled',
    renewInDays: 10,
    canceledDaysAgo: 20,
    confirmation: 'DEMO-48213',
    notes: 'Switched to free alternatives.',
  },
];

/** Builds demo subscriptions with dates relative to `today` so the demo never looks stale. */
export function buildDemoSubscriptions(
  today: ISODate,
  makeId: () => string,
  nowIso: string,
): Subscription[] {
  return DEMO_SPECS.map((spec) => {
    const nextRenewal = shiftDays(today, spec.renewInDays);
    const amountMinor = Math.round(spec.amount * 100);
    const priceHistory: PricePoint[] = [];
    if (spec.previousAmount !== undefined) {
      priceHistory.push({
        date: shiftDays(today, -140),
        amountMinor: Math.round(spec.previousAmount * 100),
      });
      priceHistory.push({ date: shiftDays(today, -22), amountMinor });
    } else {
      priceHistory.push({ date: shiftDays(today, -200), amountMinor });
    }
    const sub: Subscription = {
      id: makeId(),
      name: spec.name,
      merchantKey: merchantKeyFor(spec.merchantHint),
      amountMinor,
      cycle: spec.cycle,
      nextRenewal,
      category: spec.category,
      status: spec.status ?? 'active',
      priceHistory,
      source: 'demo',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    if (spec.usage !== undefined) sub.usage = spec.usage;
    if (spec.decision) sub.decision = spec.decision;
    if (spec.notes) sub.notes = spec.notes;
    if (spec.trialEndsInDays !== undefined)
      sub.trialEndsOn = shiftDays(today, spec.trialEndsInDays);
    if (spec.canceledDaysAgo !== undefined) {
      sub.cancellation = {
        canceledOn: shiftDays(today, -spec.canceledDaysAgo),
        ...(spec.confirmation ? { confirmation: spec.confirmation } : {}),
        method: 'Account settings page',
      };
    }
    return sub;
  });
}

/** Small deterministic PRNG so the sample statement is identical across runs for a given date. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Row {
  date: ISODate;
  description: string;
  amount: number;
}

function usDate(iso: ISODate): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

/**
 * Generates a realistic ~4-month checking-account CSV (charges negative, US date format,
 * bank preamble lines) used by the "Try a sample statement" button and the tests.
 */
export function buildSampleStatementCsv(today: ISODate): string {
  const rand = mulberry32(42);
  const start = shiftDays(today, -125);
  const rows: Row[] = [];

  const recurring = (
    description: string,
    firstOffset: number,
    cycle: Cycle,
    amount: number | ((i: number) => number),
    stopAfter?: number,
  ) => {
    for (let i = 0; ; i++) {
      const date = addCycle(shiftDays(start, firstOffset), cycle, 30, i);
      if (date > today || (stopAfter !== undefined && i >= stopAfter)) break;
      rows.push({
        date,
        description,
        amount: -(typeof amount === 'function' ? amount(i) : amount),
      });
    }
  };

  recurring('NETFLIX.COM 866-579-7172 CA', 3, 'monthly', (i) => (i < 2 ? 15.49 : 17.99));
  recurring('OPENAI *CHATGPT SUBSCR OPENAI.COM CA', 6, 'monthly', 20);
  recurring('CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM', 14, 'monthly', 20);
  recurring('SPOTIFY USA 877-778-1161 NY', 9, 'monthly', 11.99);
  recurring('APPLE.COM/BILL 866-712-7753 CA ICLOUD', 11, 'monthly', 2.99);
  recurring('GOOGLE *Google One g.co/helppay# CA', 20, 'monthly', 1.99);
  recurring('DISNEY PLUS 888-905-7888 CA', 1, 'monthly', 11.99);
  recurring('HULU 877-8244858 CA', 5, 'monthly', 9.99, 2);
  recurring('CITY GYM MEMBERSHIP DUES', 2, 'monthly', 39.99);
  recurring('GREENBOX MEAL KITS WWW.GREENBOX.EX', 4, 'weekly', 59.95);
  recurring('ADOBE *CREATIVE CLOUD SAN JOSE CA', 15, 'monthly', 59.99);

  const noise: Array<[string, number, number, number]> = [
    // description, visits, min, max
    ["TRADER JOE'S #552 OAKLAND CA", 14, 38, 140],
    ['SHELL OIL 57442018 OAKLAND CA', 7, 35, 68],
    ['SQ *BLUE KETTLE COFFEE OAKLAND CA', 18, 4.25, 13.5],
    ['AMAZON MKTPLACE PMTS AMZN.COM/BILL WA', 9, 9.99, 89],
    ['UBER *TRIP HELP.UBER.COM CA', 6, 12, 41],
    ['CVS/PHARMACY #09812', 4, 6, 44],
    ['PG&E WEB ONLINE PAYMENT', 4, 92, 141],
  ];
  for (const [description, visits, min, max] of noise) {
    for (let i = 0; i < visits; i++) {
      const date = shiftDays(start, Math.floor(rand() * 124));
      if (date > today) continue;
      rows.push({
        date,
        description,
        amount: -Math.round((min + rand() * (max - min)) * 100) / 100,
      });
    }
  }
  for (let i = 0; i < 9; i++) {
    const date = shiftDays(start, i * 14 + 1);
    if (date <= today)
      rows.push({ date, description: 'ACME CORP PAYROLL DIRECT DEP', amount: 2450 });
  }
  rows.push({ date: shiftDays(start, 60), description: 'AMAZON MKTPLACE REFUND', amount: 24.99 });

  rows.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.description.localeCompare(b.description),
  );
  let balance = 6200;
  const lines = rows
    .slice()
    .reverse()
    .map((r) => {
      balance += r.amount;
      return { ...r, balance };
    })
    .reverse()
    .map(
      (r) =>
        `${usDate(r.date)},"${r.description.replace(/"/g, '""')}",${r.amount.toFixed(2)},${r.balance.toFixed(2)}`,
    );

  return [
    'Everyday Checking - Account ending 0000 (sample data)',
    `Statement period: ${usDate(start)} to ${usDate(today)}`,
    '',
    'Date,Description,Amount,Running Balance',
    ...lines,
  ].join('\n');
}
