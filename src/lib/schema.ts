import { z } from 'zod';
import { isISODate } from './dates';
import { CATEGORIES, CURRENCIES, CYCLES, DECISIONS, STATUSES } from './types';

const isoDate = z.string().refine(isISODate, { message: 'Enter a valid date' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Keep this under ${max} characters` })
    .optional()
    .transform((v) => (v ? v : undefined));

export const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'https:' || u.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'Enter a full web address starting with https://' },
  );

export const MAX_AMOUNT_MINOR = 100_000_000;

const pricePointSchema = z.object({
  date: isoDate,
  amountMinor: z.number().int().min(0).max(MAX_AMOUNT_MINOR),
});

const cancellationSchema = z.object({
  canceledOn: isoDate,
  confirmation: optionalText(120),
  method: optionalText(120),
  notes: optionalText(1000),
});

/** Fields a user can edit. Shared by the create and update paths. */
export const subscriptionInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'Name is required' })
      .max(80, { message: 'Keep the name under 80 characters' }),
    amountMinor: z
      .number({ message: 'Enter an amount' })
      .int()
      .min(0, { message: 'Amount cannot be negative' })
      .max(MAX_AMOUNT_MINOR, { message: 'That amount looks too large' }),
    cycle: z.enum(CYCLES),
    customDays: z.number().int().min(1).max(1000).optional(),
    nextRenewal: isoDate,
    category: z.enum(CATEGORIES),
    status: z.enum(STATUSES),
    trialEndsOn: isoDate.optional(),
    usage: z.number().int().min(1).max(5).optional(),
    decision: z.enum(DECISIONS).optional(),
    cancelUrl: httpUrl.optional().or(z.literal('').transform(() => undefined)),
    notes: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if (value.cycle === 'custom' && !value.customDays) {
      ctx.addIssue({
        code: 'custom',
        path: ['customDays'],
        message: 'Enter how many days between charges',
      });
    }
    if (value.status === 'trial' && !value.trialEndsOn) {
      ctx.addIssue({
        code: 'custom',
        path: ['trialEndsOn'],
        message: 'Enter when the free trial ends',
      });
    }
  });

export type SubscriptionInput = z.input<typeof subscriptionInputSchema>;
export type ValidSubscriptionInput = z.output<typeof subscriptionInputSchema>;

export const subscriptionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  merchantKey: z.string().max(120),
  amountMinor: z.number().int().min(0).max(MAX_AMOUNT_MINOR),
  cycle: z.enum(CYCLES),
  customDays: z.number().int().min(1).max(1000).optional(),
  nextRenewal: isoDate,
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES),
  trialEndsOn: isoDate.optional(),
  usage: z.number().int().min(1).max(5).optional(),
  decision: z.enum(DECISIONS).optional(),
  cancelUrl: httpUrl.optional(),
  notes: z.string().max(1000).optional(),
  priceHistory: z.array(pricePointSchema).max(500),
  cancellation: cancellationSchema.optional(),
  source: z.enum(['manual', 'import', 'demo']),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
});

export const settingsSchema = z.object({
  currency: z.enum(CURRENCIES),
  reminderLeadDays: z.number().int().min(0).max(30),
  theme: z.enum(['system', 'light', 'dark']),
  onboarded: z.boolean(),
  lastBackupAt: z.string().max(40).optional(),
});

export const cancellationInputSchema = cancellationSchema;
export type CancellationInput = z.input<typeof cancellationInputSchema>;

export const backupSchema = z.object({
  format: z.literal('keepcut-backup'),
  version: z.literal(1),
  exportedAt: z.string().max(40),
  settings: settingsSchema,
  subscriptions: z.array(subscriptionSchema).max(5000),
});
export type Backup = z.input<typeof backupSchema>;

/** Flattens Zod issues into `{ fieldName: firstMessage }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
