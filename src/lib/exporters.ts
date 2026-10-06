import { minorUnitFactor, monthlyEquivalent, toMajor } from './money';
import type { Backup } from './schema';
import {
  CYCLE_LABELS,
  STATUS_LABELS,
  type Currency,
  type Settings,
  type Subscription,
} from './types';

/**
 * Quotes a CSV cell and neutralises spreadsheet formula injection (OWASP): cells starting
 * with = + - @ tab or CR are prefixed with a single quote.
 */
export function csvCell(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function subscriptionsToCsv(subs: Subscription[], currency: Currency): string {
  const header = [
    'Name',
    'Category',
    'Status',
    'Amount',
    'Currency',
    'Billing cycle',
    'Monthly equivalent',
    'Next renewal',
    'Trial ends',
    'Usage (1-5)',
    'Decision',
    'Canceled on',
    'Confirmation',
    'Cancel URL',
    'Notes',
  ];
  const rows = subs.map((s) => [
    s.name,
    s.category,
    STATUS_LABELS[s.status],
    toMajor(s.amountMinor, currency).toFixed(minorUnitFactor(currency) === 1 ? 0 : 2),
    currency,
    s.cycle === 'custom' ? `Every ${s.customDays} days` : CYCLE_LABELS[s.cycle],
    toMajor(monthlyEquivalent(s.amountMinor, s.cycle, s.customDays), currency).toFixed(
      minorUnitFactor(currency) === 1 ? 0 : 2,
    ),
    s.status === 'canceled' ? '' : s.nextRenewal,
    s.trialEndsOn ?? '',
    s.usage ?? '',
    s.decision ?? '',
    s.cancellation?.canceledOn ?? '',
    s.cancellation?.confirmation ?? '',
    s.cancelUrl ?? '',
    s.notes ?? '',
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function buildBackup(
  settings: Settings,
  subscriptions: Subscription[],
  now = new Date(),
): Backup {
  return {
    format: 'keepcut-backup',
    version: 1,
    exportedAt: now.toISOString(),
    settings,
    subscriptions,
  };
}

/** Triggers a browser download for in-memory content. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
