import { describe, expect, it } from 'vitest';
import { fieldErrors, subscriptionInputSchema, type SubscriptionInput } from './schema';

const valid: SubscriptionInput = {
  name: 'Netflix',
  amountMinor: 1799,
  cycle: 'monthly',
  nextRenewal: '2026-07-01',
  category: 'Streaming',
  status: 'active',
};

function errorsFor(input: Partial<SubscriptionInput> & Record<string, unknown>) {
  const result = subscriptionInputSchema.safeParse({ ...valid, ...input });
  return result.success ? {} : fieldErrors(result.error);
}

describe('subscriptionInputSchema', () => {
  it('accepts a valid subscription and trims text', () => {
    const result = subscriptionInputSchema.parse({
      ...valid,
      name: '  Netflix  ',
      notes: '   ',
      cancelUrl: '',
    });
    expect(result.name).toBe('Netflix');
    expect(result.notes).toBeUndefined();
    expect(result.cancelUrl).toBeUndefined();
  });

  it.each([
    [{ name: '' }, 'name', /required/],
    [{ name: 'x'.repeat(81) }, 'name', /80/],
    [{ amountMinor: -1 }, 'amountMinor', /negative/],
    [{ amountMinor: 1.5 }, 'amountMinor', /.+/],
    [{ amountMinor: 1e12 }, 'amountMinor', /too large/],
    [{ nextRenewal: '2026-02-30' }, 'nextRenewal', /valid date/],
    [{ cycle: 'custom' }, 'customDays', /days/],
    [{ status: 'trial' }, 'trialEndsOn', /trial ends/],
    [{ cancelUrl: 'javascript:alert(1)' }, 'cancelUrl', /https/],
    [{ cancelUrl: 'not a url' }, 'cancelUrl', /https/],
    [{ usage: 6 }, 'usage', /.+/],
    [{ category: 'Bogus' }, 'category', /.+/],
    [{ notes: 'x'.repeat(1001) }, 'notes', /1000/],
  ])('rejects %o', (input, field, message) => {
    const errors = errorsFor(input as Partial<SubscriptionInput>);
    expect(errors[field]).toMatch(message);
  });
});
