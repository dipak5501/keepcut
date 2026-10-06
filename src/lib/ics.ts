import { formatMoney } from './money';
import type { Currency, Cycle, Subscription } from './types';

/** Escapes TEXT values per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds content lines longer than 75 octets per RFC 5545 §3.1. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function rrule(cycle: Cycle, customDays?: number): string {
  switch (cycle) {
    case 'weekly':
      return 'RRULE:FREQ=WEEKLY';
    case 'biweekly':
      return 'RRULE:FREQ=WEEKLY;INTERVAL=2';
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY';
    case 'quarterly':
      return 'RRULE:FREQ=MONTHLY;INTERVAL=3';
    case 'yearly':
      return 'RRULE:FREQ=YEARLY';
    case 'custom':
      return `RRULE:FREQ=DAILY;INTERVAL=${Math.max(1, customDays ?? 30)}`;
  }
}

const compactDate = (iso: string) => iso.replace(/-/g, '');

function stamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export interface IcsOptions {
  currency: Currency;
  leadDays: number;
  now?: Date;
}

/**
 * Builds an iCalendar file with one recurring all-day event per active subscription and a
 * one-off event per trial end. Each event carries an alarm `leadDays` before the date.
 */
export function buildIcs(subs: Subscription[], options: IcsOptions): string {
  const now = options.now ?? new Date();
  const lead = Math.max(0, Math.min(30, Math.round(options.leadDays)));
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Keepcut//Subscription reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Keepcut renewals',
  ];

  const alarm = (description: string) => [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(description)}`,
    `TRIGGER:-P${lead}D`,
    'END:VALARM',
  ];

  for (const s of subs) {
    const price = formatMoney(s.amountMinor, options.currency);
    if (s.status === 'trial' && s.trialEndsOn) {
      const summary = `Trial ends: ${s.name} — cancel before it becomes ${price}`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.id}-trial@keepcut.local`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART;VALUE=DATE:${compactDate(s.trialEndsOn)}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `DESCRIPTION:${escapeIcsText(`Free trial for ${s.name} ends. Cancel beforehand if you don't want to pay ${price}.`)}`,
        'TRANSP:TRANSPARENT',
        ...alarm(summary),
        'END:VEVENT',
      );
    } else if (s.status === 'active') {
      const summary = `${s.name} renews (${price})`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.id}-renewal@keepcut.local`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART;VALUE=DATE:${compactDate(s.nextRenewal)}`,
        rrule(s.cycle, s.customDays),
        `SUMMARY:${escapeIcsText(summary)}`,
        `DESCRIPTION:${escapeIcsText(`${s.name} will charge ${price}. Still using it? Decide in Keepcut.`)}`,
        'TRANSP:TRANSPARENT',
        ...alarm(summary),
        'END:VEVENT',
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
