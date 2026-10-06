import { describe, expect, it } from 'vitest';
import { makeSubscription } from '@/test/factories';
import { buildIcs, escapeIcsText, foldLine } from './ics';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('buildIcs', () => {
  it('creates recurring renewals and one-off trial reminders with alarms', () => {
    const ics = buildIcs(
      [
        makeSubscription({
          id: 'a',
          name: 'Netflix',
          amountMinor: 1799,
          nextRenewal: '2026-06-20',
        }),
        makeSubscription({
          id: 'b',
          name: 'Peloton',
          status: 'trial',
          trialEndsOn: '2026-06-17',
          amountMinor: 2400,
        }),
        makeSubscription({ id: 'c', name: 'Gym', cycle: 'custom', customDays: 28 }),
        makeSubscription({ id: 'd', name: 'Gone', status: 'canceled' }),
      ],
      { currency: 'USD', leadDays: 3, now: NOW },
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:a-renewal@keepcut.local');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260620');
    expect(ics).toContain('RRULE:FREQ=MONTHLY');
    expect(ics).toContain('UID:b-trial@keepcut.local');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260617');
    expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=28');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).toContain('DTSTAMP:20260615T120000Z');
    expect(ics).not.toContain('Gone');
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(3);
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe(3);
  });

  it('clamps the reminder lead time', () => {
    const ics = buildIcs([makeSubscription()], { currency: 'USD', leadDays: 99, now: NOW });
    expect(ics).toContain('TRIGGER:-P30D');
  });
});

describe('escapeIcsText / foldLine', () => {
  it('escapes special characters', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long lines at 75 octets', () => {
    const folded = foldLine('SUMMARY:' + 'x'.repeat(200));
    const lines = folded.split('\r\n');
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'x'.repeat(200));
  });

  it('never splits multi-byte characters', () => {
    const folded = foldLine('SUMMARY:' + '€'.repeat(60));
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + '€'.repeat(60));
  });
});
