import type { Subscription } from '@/lib/types';

let counter = 0;

export function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  counter += 1;
  return {
    id: `sub-${counter}`,
    name: `Service ${counter}`,
    merchantKey: `service ${counter}`,
    amountMinor: 1000,
    cycle: 'monthly',
    nextRenewal: '2026-06-20',
    category: 'Other',
    status: 'active',
    priceHistory: [{ date: '2026-01-01', amountMinor: overrides.amountMinor ?? 1000 }],
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
