import { describe, expect, it } from 'vitest';
import {
  addCycle,
  daysBetween,
  detectDateFormat,
  isISODate,
  nextRenewalAfter,
  parseDate,
  relativeDays,
  rollForward,
} from './dates';

describe('parseDate', () => {
  it('parses ISO dates and ignores time parts', () => {
    expect(parseDate('2026-01-31', 'ymd')).toBe('2026-01-31');
    expect(parseDate('2026-01-31 10:22:00', 'ymd')).toBe('2026-01-31');
    expect(parseDate('2026-01-31T10:22:00Z', 'ymd')).toBe('2026-01-31');
  });

  it('parses US and European numeric dates', () => {
    expect(parseDate('01/31/2026', 'mdy')).toBe('2026-01-31');
    expect(parseDate('1/5/26', 'mdy')).toBe('2026-01-05');
    expect(parseDate('31/01/2026', 'dmy')).toBe('2026-01-31');
    expect(parseDate('31.01.2026', 'dmy')).toBe('2026-01-31');
  });

  it('parses textual dates', () => {
    expect(parseDate('Jan 31, 2026', 'text-mdy')).toBe('2026-01-31');
    expect(parseDate('31 Jan 2026', 'text-dmy')).toBe('2026-01-31');
    expect(parseDate('31-Jan-2026', 'text-dmy')).toBe('2026-01-31');
  });

  it('rejects impossible dates', () => {
    expect(parseDate('02/30/2026', 'mdy')).toBeNull();
    expect(parseDate('13/13/2026', 'mdy')).toBeNull();
    expect(parseDate('2026-1-1x', 'ymd')).toBeNull();
    expect(parseDate('', 'ymd')).toBeNull();
    expect(parseDate('1850-01-01', 'ymd')).toBeNull();
  });
});

describe('detectDateFormat', () => {
  it('prefers mdy when ambiguous and falls back to dmy', () => {
    expect(detectDateFormat(['01/02/2026', '03/04/2026'])).toBe('mdy');
    expect(detectDateFormat(['01/02/2026', '25/04/2026'])).toBe('dmy');
    expect(detectDateFormat(['2026-04-25'])).toBe('ymd');
    expect(detectDateFormat(['Apr 25, 2026'])).toBe('text-mdy');
    expect(detectDateFormat(['hello'])).toBeNull();
    expect(detectDateFormat([])).toBeNull();
  });
});

describe('cycle arithmetic', () => {
  it('adds cycles', () => {
    expect(addCycle('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(addCycle('2026-01-01', 'weekly')).toBe('2026-01-08');
    expect(addCycle('2026-01-01', 'biweekly')).toBe('2026-01-15');
    expect(addCycle('2026-01-01', 'quarterly')).toBe('2026-04-01');
    expect(addCycle('2024-02-29', 'yearly')).toBe('2025-02-28');
    expect(addCycle('2026-01-01', 'custom', 45)).toBe('2026-02-15');
  });

  it('rolls forward without day-of-month drift', () => {
    expect(rollForward('2026-01-31', 'monthly', '2026-04-15')).toBe('2026-04-30');
    expect(rollForward('2026-05-01', 'monthly', '2026-04-15')).toBe('2026-05-01');
  });

  it('computes the next renewal strictly after the last charge', () => {
    expect(nextRenewalAfter('2026-03-10', 'monthly', '2026-03-10')).toBe('2026-04-10');
    expect(nextRenewalAfter('2026-01-10', 'monthly', '2026-03-20')).toBe('2026-04-10');
  });

  it('measures days and relative labels', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(relativeDays('2026-01-02', '2026-01-01')).toBe('tomorrow');
    expect(relativeDays('2026-01-01', '2026-01-01')).toBe('today');
    expect(relativeDays('2026-01-11', '2026-01-01')).toBe('in 10 days');
    expect(relativeDays('2025-12-29', '2026-01-01')).toBe('3 days ago');
  });

  it('validates ISO strings', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('26-02-28')).toBe(false);
  });
});
