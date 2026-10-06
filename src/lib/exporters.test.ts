import { describe, expect, it } from 'vitest';
import { makeSubscription } from '@/test/factories';
import { buildBackup, csvCell, subscriptionsToCsv } from './exporters';
import { buildCancellationRequest, buildRefundRequest, cancellationHelpUrl } from './letters';
import { backupSchema } from './schema';
import { DEFAULT_SETTINGS } from './types';

describe('csvCell', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+1', "'+1"],
    ['-cmd', "'-cmd"],
    ['@SUM(A1)', "'@SUM(A1)"],
    [undefined, ''],
    [42, '42'],
  ])('formats %s', (input, expected) => {
    expect(csvCell(input as string)).toBe(expected);
  });
});

describe('subscriptionsToCsv', () => {
  it('exports a header and one row per subscription', () => {
    const csv = subscriptionsToCsv(
      [
        makeSubscription({ name: 'Netflix', amountMinor: 1799, category: 'Streaming' }),
        makeSubscription({
          name: '=evil()',
          amountMinor: 12000,
          cycle: 'yearly',
          status: 'canceled',
          cancellation: { canceledOn: '2026-05-01', confirmation: 'ABC' },
        }),
      ],
      'USD',
    );
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Name,Category,Status,Amount/);
    expect(lines[1]).toContain('Netflix,Streaming,Active,17.99,USD,Monthly,17.99,2026-06-20');
    expect(lines[2]).toContain("'=evil()");
    expect(lines[2]).toContain('2026-05-01,ABC');
  });
});

describe('buildBackup', () => {
  it('produces a schema-valid backup', () => {
    const backup = buildBackup(
      DEFAULT_SETTINGS,
      [makeSubscription()],
      new Date('2026-06-15T00:00:00Z'),
    );
    expect(backupSchema.safeParse(backup).success).toBe(true);
    expect(backup.exportedAt).toBe('2026-06-15T00:00:00.000Z');
  });
});

describe('letters', () => {
  const sub = makeSubscription({
    name: 'Adobe',
    status: 'canceled',
    cancellation: { canceledOn: '2026-05-01', confirmation: 'AD-1' },
  });

  it('drafts a refund request including cancellation proof', () => {
    const text = buildRefundRequest({
      subscription: sub,
      currency: 'USD',
      chargeDate: '2026-06-01',
      chargeAmountMinor: 5999,
      yourName: 'Sam',
      accountEmail: 'sam@example.com',
    });
    expect(text).toContain('Refund request');
    expect(text).toContain('confirmation number: AD-1');
    expect(text).toContain('$59.99');
    expect(text).toContain('sam@example.com');
    expect(text.trim().endsWith('Sam')).toBe(true);
  });

  it('falls back to a placeholder name', () => {
    expect(buildCancellationRequest({ subscription: sub })).toContain('[Your name]');
  });

  it('builds an encoded help search URL', () => {
    expect(cancellationHelpUrl('Disney+')).toBe(
      'https://duckduckgo.com/?q=how%20to%20cancel%20Disney%2B%20subscription',
    );
  });
});
