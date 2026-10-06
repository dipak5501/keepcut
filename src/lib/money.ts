import type { Currency, Cycle } from './types';

const ZERO_DECIMAL_CURRENCIES = new Set<string>(['JPY']);

export function minorUnitFactor(currency: Currency | string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
}

/**
 * Parses amounts as they appear in bank exports: "$1,234.56", "(12.00)", "12.00-",
 * "1.234,56", "-9,99 €". Returns a signed number in major units, or null if unparseable.
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  let s = raw.trim();
  if (s === '') return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/-\s*$/.test(s)) {
    negative = true;
    s = s.replace(/-\s*$/, '');
  }
  if (/^[^\d]*[-−–]/.test(s)) {
    negative = true;
  }

  // Keep digits and separators only.
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    s = /,\d{1,2}$/.test(s)
      ? s.replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')
      : s.replace(/,/g, '');
  } else if ((s.match(/\./g) ?? []).length > 1) {
    // "1.234.567" — dots are thousands separators.
    s = s.replace(/\./g, '');
  }

  const value = Number.parseFloat(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

export function toMinor(major: number, currency: Currency | string = 'USD'): number {
  return Math.round(major * minorUnitFactor(currency));
}

export function toMajor(minor: number, currency: Currency | string = 'USD'): number {
  return minor / minorUnitFactor(currency);
}

export function formatMoney(
  minor: number,
  currency: Currency | string = 'USD',
  options: { compact?: boolean; locale?: string } = {},
): string {
  const factor = minorUnitFactor(currency);
  const major = minor / factor;
  const fractionDigits = options.compact && Number.isInteger(major) ? 0 : factor === 1 ? 0 : 2;
  return new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(major);
}

const DAYS_PER_YEAR = 365.25;

/** Converts a per-cycle price into its average monthly cost (in minor units, rounded). */
export function monthlyEquivalent(amountMinor: number, cycle: Cycle, customDays?: number): number {
  switch (cycle) {
    case 'weekly':
      return Math.round((amountMinor * 52) / 12);
    case 'biweekly':
      return Math.round((amountMinor * 26) / 12);
    case 'monthly':
      return amountMinor;
    case 'quarterly':
      return Math.round(amountMinor / 3);
    case 'yearly':
      return Math.round(amountMinor / 12);
    case 'custom': {
      const days = customDays && customDays > 0 ? customDays : 30;
      return Math.round((amountMinor * DAYS_PER_YEAR) / 12 / days);
    }
  }
}

export function yearlyEquivalent(amountMinor: number, cycle: Cycle, customDays?: number): number {
  switch (cycle) {
    case 'weekly':
      return amountMinor * 52;
    case 'biweekly':
      return amountMinor * 26;
    case 'monthly':
      return amountMinor * 12;
    case 'quarterly':
      return amountMinor * 4;
    case 'yearly':
      return amountMinor;
    case 'custom': {
      const days = customDays && customDays > 0 ? customDays : 30;
      return Math.round((amountMinor * DAYS_PER_YEAR) / days);
    }
  }
}
