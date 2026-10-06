import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  isValid,
  parse,
} from 'date-fns';
import type { Cycle, ISODate } from './types';

export const DATE_FORMATS = [
  { id: 'ymd', label: 'YYYY-MM-DD (2026-01-31)' },
  { id: 'mdy', label: 'MM/DD/YYYY (01/31/2026)' },
  { id: 'dmy', label: 'DD/MM/YYYY (31/01/2026)' },
  { id: 'text-mdy', label: 'Mon D, YYYY (Jan 31, 2026)' },
  { id: 'text-dmy', label: 'D Mon YYYY (31 Jan 2026)' },
] as const;
export type DateFormatId = (typeof DATE_FORMATS)[number]['id'];

const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

function buildISO(year: number, month: number, day: number): ISODate | null {
  if (year < 100) year += 2000;
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return format(d, 'yyyy-MM-dd');
}

/** Parses a date string from a bank export into an ISO date (YYYY-MM-DD), or null. */
export function parseDate(raw: string, formatId: DateFormatId): ISODate | null {
  const s = raw.trim();
  if (!s) return null;

  if (formatId === 'text-mdy' || formatId === 'text-dmy') {
    const cleaned = s.replace(/\./g, '').replace(/\s+/g, ' ');
    const patterns =
      formatId === 'text-mdy'
        ? ['MMM d, yyyy', 'MMM d yyyy', 'MMMM d, yyyy', 'MMMM d yyyy']
        : ['d MMM yyyy', 'd MMMM yyyy', 'd-MMM-yyyy', 'd-MMM-yy'];
    for (const pattern of patterns) {
      const d = parse(cleaned, pattern, new Date(2000, 0, 1));
      if (isValid(d)) return buildISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    return null;
  }

  // Drop any time component ("2026-01-31 10:22:00", "2026-01-31T10:22Z").
  const datePart = s.split(/[T\s]/)[0] ?? '';
  const parts = datePart.split(/[/.-]/).map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return null;
  const [a, b, c] = parts.map(Number) as [number, number, number];

  switch (formatId) {
    case 'ymd':
      return parts[0]!.length === 4 ? buildISO(a, b, c) : null;
    case 'mdy':
      return parts[2]!.length >= 2 ? buildISO(c, a, b) : null;
    case 'dmy':
      return parts[2]!.length >= 2 ? buildISO(c, b, a) : null;
  }
}

/** Picks the first format that parses every non-empty sample; prefers ymd, then mdy over dmy. */
export function detectDateFormat(samples: string[]): DateFormatId | null {
  const values = samples
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (values.length === 0) return null;
  const order: DateFormatId[] = ['ymd', 'mdy', 'dmy', 'text-mdy', 'text-dmy'];
  for (const id of order) {
    if (values.every((v) => parseDate(v, id) !== null)) return id;
  }
  return null;
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now);
}

export function isISODate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    buildISO(...(value.split('-').map(Number) as [number, number, number])) === value
  );
}

export function addCycle(iso: ISODate, cycle: Cycle, customDays = 30, times = 1): ISODate {
  const d = fromISO(iso);
  switch (cycle) {
    case 'weekly':
      return toISO(addWeeks(d, times));
    case 'biweekly':
      return toISO(addWeeks(d, 2 * times));
    case 'monthly':
      return toISO(addMonths(d, times));
    case 'quarterly':
      return toISO(addMonths(d, 3 * times));
    case 'yearly':
      return toISO(addYears(d, times));
    case 'custom':
      return toISO(addDays(d, Math.max(1, customDays) * times));
  }
}

/**
 * Rolls a renewal date forward until it is on or after `today`. Uses multiples from the
 * anchor date so monthly renewals on the 31st don't drift to the 28th.
 */
export function rollForward(
  anchor: ISODate,
  cycle: Cycle,
  today: ISODate,
  customDays = 30,
): ISODate {
  if (anchor >= today) return anchor;
  let next = anchor;
  for (let i = 1; i <= 5000 && next < today; i++) {
    next = addCycle(anchor, cycle, customDays, i);
  }
  return next;
}

/** First cycle date strictly after `lastCharge` that is also on or after `today`. */
export function nextRenewalAfter(
  lastCharge: ISODate,
  cycle: Cycle,
  today: ISODate,
  customDays = 30,
): ISODate {
  let next = addCycle(lastCharge, cycle, customDays, 1);
  for (let i = 2; i <= 5000 && next < today; i++) {
    next = addCycle(lastCharge, cycle, customDays, i);
  }
  return next;
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(fromISO(to), fromISO(from));
}

export function shiftDays(iso: ISODate, days: number): ISODate {
  return toISO(addDays(fromISO(iso), days));
}

export function formatDisplayDate(iso: ISODate, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(fromISO(iso));
}

export function relativeDays(iso: ISODate, today: ISODate): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}
