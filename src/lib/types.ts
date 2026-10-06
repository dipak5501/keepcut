export const CYCLES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'] as const;
export type Cycle = (typeof CYCLES)[number];

export const CYCLE_LABELS: Record<Cycle, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  custom: 'Custom',
};

export const STATUSES = ['active', 'trial', 'paused', 'canceled'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  active: 'Active',
  trial: 'Free trial',
  paused: 'Paused',
  canceled: 'Canceled',
};

export const DECISIONS = ['keep', 'review', 'cut'] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<Decision, string> = {
  keep: 'Keep',
  review: 'Review',
  cut: 'Cut',
};

export const CATEGORIES = [
  'AI tools',
  'Streaming',
  'Music & audio',
  'Software',
  'Cloud storage',
  'News & reading',
  'Fitness & health',
  'Gaming',
  'Shopping & delivery',
  'Utilities & phone',
  'Education',
  'Finance',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Categories where paying for several services usually means paying twice for one job. */
export const OVERLAP_PRONE_CATEGORIES: readonly Category[] = [
  'AI tools',
  'Streaming',
  'Music & audio',
  'Cloud storage',
];

export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'NZD',
  'INR',
  'JPY',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'BRL',
  'MXN',
  'ZAR',
  'SGD',
] as const;
export type Currency = (typeof CURRENCIES)[number];

export type ISODate = string;

export interface PricePoint {
  date: ISODate;
  amountMinor: number;
}

export interface CancellationRecord {
  canceledOn: ISODate;
  confirmation?: string;
  method?: string;
  notes?: string;
}

export type SubscriptionSource = 'manual' | 'import' | 'demo';

export interface Subscription {
  id: string;
  name: string;
  merchantKey: string;
  /** Integer minor units (e.g. cents) to avoid floating-point drift. */
  amountMinor: number;
  cycle: Cycle;
  customDays?: number;
  nextRenewal: ISODate;
  category: Category;
  status: Status;
  trialEndsOn?: ISODate;
  /** 1 = never use it, 5 = use it daily. */
  usage?: number;
  decision?: Decision;
  cancelUrl?: string;
  notes?: string;
  priceHistory: PricePoint[];
  cancellation?: CancellationRecord;
  source: SubscriptionSource;
  createdAt: string;
  updatedAt: string;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  currency: Currency;
  reminderLeadDays: number;
  theme: Theme;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'USD',
  reminderLeadDays: 3,
  theme: 'system',
  onboarded: false,
};

export interface ImportRecord {
  id: string;
  fileName: string;
  importedAt: string;
  rowCount: number;
  detectedCount: number;
  addedCount: number;
}
