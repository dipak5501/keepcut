import { formatDisplayDate } from './dates';
import { formatMoney } from './money';
import type { Currency, ISODate, Subscription } from './types';

export interface RefundRequestInput {
  subscription: Subscription;
  currency: Currency;
  chargeDate: ISODate;
  chargeAmountMinor: number;
  yourName?: string;
  accountEmail?: string;
}

/**
 * Drafts a polite refund request for a charge that appeared after cancelling.
 * This is a plain template, not legal advice.
 */
export function buildRefundRequest(input: RefundRequestInput): string {
  const { subscription: s, currency } = input;
  const amount = formatMoney(input.chargeAmountMinor, currency);
  const canceled = s.cancellation;
  const lines = [
    `Subject: Refund request — charge after cancellation (${s.name})`,
    '',
    'Hello,',
    '',
    `I cancelled my ${s.name} subscription${canceled ? ` on ${formatDisplayDate(canceled.canceledOn)}` : ''}` +
      `${canceled?.confirmation ? ` (confirmation number: ${canceled.confirmation})` : ''}.`,
    `However, I was charged ${amount} on ${formatDisplayDate(input.chargeDate)}.`,
    '',
    'Please refund this charge in full to the original payment method and confirm that the',
    'subscription is closed so that no further charges occur.',
    '',
    input.accountEmail ? `The account is registered to: ${input.accountEmail}` : null,
    'I would appreciate a written confirmation of the refund within 10 business days.',
    'If I do not hear back, I will ask my card issuer to dispute the charge.',
    '',
    'Thank you,',
    input.yourName?.trim() || '[Your name]',
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

export interface CancellationRequestInput {
  subscription: Subscription;
  yourName?: string;
  accountEmail?: string;
}

/** Drafts a cancellation request for services that only accept email or chat. */
export function buildCancellationRequest(input: CancellationRequestInput): string {
  const { subscription: s } = input;
  return [
    `Subject: Please cancel my ${s.name} subscription`,
    '',
    'Hello,',
    '',
    `Please cancel my ${s.name} subscription effective immediately and stop all future charges.`,
    input.accountEmail ? `The account is registered to: ${input.accountEmail}` : null,
    '',
    'Please reply with a cancellation confirmation number and the date the cancellation takes effect.',
    'I do not wish to pause, downgrade or accept a retention offer.',
    '',
    'Thank you,',
    input.yourName?.trim() || '[Your name]',
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}

/** A search link that helps users find the provider's current cancellation steps. */
export function cancellationHelpUrl(name: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent(`how to cancel ${name} subscription`)}`;
}
