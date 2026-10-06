import { describe, expect, it } from 'vitest';
import { formatMoney, monthlyEquivalent, parseAmount, toMinor, yearlyEquivalent } from './money';

describe('parseAmount', () => {
  it.each([
    ['12.34', 12.34],
    ['-12.34', -12.34],
    ['$1,234.56', 1234.56],
    ['-$15.49', -15.49],
    ['(20.00)', -20],
    ['20.00-', -20],
    ['1.234,56', 1234.56],
    ['-9,99 €', -9.99],
    ['USD 7', 7],
    ['1,234', 1234],
    ['1.234.567', 1234567],
    ['−5.00', -5],
  ])('parses %s', (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected, 5);
  });

  it.each(['', '   ', 'abc', 'N/A', null, undefined])('returns null for %s', (input) => {
    expect(parseAmount(input as string)).toBeNull();
  });

  it('accepts finite numbers', () => {
    expect(parseAmount(3.5)).toBe(3.5);
    expect(parseAmount(Number.NaN)).toBeNull();
  });
});

describe('minor units', () => {
  it('rounds to cents without float drift', () => {
    expect(toMinor(17.99)).toBe(1799);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it('treats JPY as zero-decimal', () => {
    expect(toMinor(1500, 'JPY')).toBe(1500);
    expect(formatMoney(1500, 'JPY', { locale: 'en-US' })).toBe('¥1,500');
  });

  it('formats currency', () => {
    expect(formatMoney(1799, 'USD', { locale: 'en-US' })).toBe('$17.99');
    expect(formatMoney(2000, 'USD', { locale: 'en-US', compact: true })).toBe('$20');
  });
});

describe('cycle equivalents', () => {
  it('converts to monthly', () => {
    expect(monthlyEquivalent(1200, 'yearly')).toBe(100);
    expect(monthlyEquivalent(300, 'quarterly')).toBe(100);
    expect(monthlyEquivalent(1000, 'weekly')).toBe(4333);
    expect(monthlyEquivalent(1000, 'biweekly')).toBe(2167);
    expect(monthlyEquivalent(999, 'monthly')).toBe(999);
    expect(monthlyEquivalent(1000, 'custom', 60)).toBe(507);
  });

  it('converts to yearly', () => {
    expect(yearlyEquivalent(999, 'monthly')).toBe(11988);
    expect(yearlyEquivalent(500, 'weekly')).toBe(26000);
    expect(yearlyEquivalent(8399, 'yearly')).toBe(8399);
  });
});
