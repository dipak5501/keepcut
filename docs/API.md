# API and data-format reference

Keepcut has **no HTTP API** — there is no server. This document describes the internal TypeScript APIs other contributors build on, and the file formats Keepcut reads and writes.

## Repository (`src/lib/db/repository.ts`)

The repository is the only code that writes to IndexedDB. Every write is validated with Zod. `createRepository(database, { now })` builds an instance (tests inject a clock and an in-memory database); the app uses the exported singleton `repository`.

Validated writes return `Result<T>`:

```ts
type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };
// errors maps field names (e.g. "name", "amountMinor") or "_form" to a user-facing message.
```

Methods that operate on an existing subscription throw `NotFoundError` if the id doesn't exist.

| Method                                                                | Returns                                        | Notes                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `getSettings()`                                                       | `Settings`                                     | Falls back to defaults if missing or invalid                            |
| `updateSettings(patch)`                                               | `Result<Settings>`                             | Partial update                                                          |
| `listSubscriptions()` / `getSubscription(id)`                         | `Subscription[]` / `Subscription \| undefined` |                                                                         |
| `createSubscription(input, { source?, merchantKey?, priceHistory? })` | `Result<Subscription>`                         | Generates id, timestamps and initial price point                        |
| `updateSubscription(id, input)`                                       | `Result<Subscription>`                         | Appends a price-history point when the amount changes                   |
| `setDecision(id, decision \| undefined)`                              | `Subscription`                                 | `'keep' \| 'review' \| 'cut'`                                           |
| `setUsage(id, 1–5 \| undefined)`                                      | `Subscription`                                 | Throws `RangeError` outside 1–5                                         |
| `markCanceled(id, { canceledOn, method?, confirmation?, notes? })`    | `Result<Subscription>`                         | Sets status `canceled` and stores the record                            |
| `reactivate(id)`                                                      | `Subscription`                                 | Sets status `active`                                                    |
| `deleteSubscription(id)`                                              | `void`                                         |                                                                         |
| `addDetected(items, { fileName, rowCount, detectedCount })`           | `{ added, skipped }`                           | Skips merchants already tracked; records an import summary              |
| `listImports()`                                                       | `ImportRecord[]`                               | Newest first; file name and counts only                                 |
| `loadDemoData()` / `clearDemoData()`                                  | `number`                                       | Demo rows have `source: 'demo'`                                         |
| `exportBackup()`                                                      | `Backup`                                       | See format below                                                        |
| `restoreBackup(raw: unknown)`                                         | `Result<{ count }>`                            | Validates, rejects duplicate ids, then **replaces** all data atomically |
| `clearAllData()`                                                      | `void`                                         | Deletes subscriptions, settings and import history                      |

## Domain modules (`src/lib`)

All are pure functions with unit tests next to them.

| Module         | Key exports                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csv.ts`       | `parseCsvText(text)` → `ParsedTable` (throws `CsvImportError`); `guessMapping(table)`; `detectChargeSign(table, column)`; `normalizeTransactions(table, options)` → `{ transactions, errors, skippedCredits }`; limits `MAX_FILE_BYTES`, `MAX_ROWS` |
| `detect.ts`    | `detectRecurring(transactions, { today, minConfidence })` → `DetectedSubscription[]` (name, merchantKey, amountMinor, cycle, customDays, lastChargedOn, nextRenewal, confidence 0–1, confidenceLabel, reasons, priceChange, likelyInactive)         |
| `insights.ts`  | `computeTotals`, `upcomingCharges(subs, today, days)`, `findOverlaps`, `findPriceIncreases`, `computeSavings`, `categoryBreakdown`, `monthlyOf`, `yearlyOf`                                                                                         |
| `money.ts`     | `parseAmount` (handles `1,234.56`, `1.234,56`, `(12.00)`, `12.00-`), `toMinor`, `toMajor`, `formatMoney`, `monthlyEquivalent`, `yearlyEquivalent`                                                                                                   |
| `dates.ts`     | `parseDate(value, format)`, `detectDateFormat`, `addCycle`, `rollForward`, `nextRenewalAfter`, `relativeDays`, `formatDisplayDate`                                                                                                                  |
| `merchants.ts` | `KNOWN_MERCHANTS`, `matchKnownMerchant`, `cleanMerchantName`, `merchantKeyFor`                                                                                                                                                                      |
| `ics.ts`       | `buildIcs(subs, { currency, leadDays, now })` → iCalendar text                                                                                                                                                                                      |
| `letters.ts`   | `buildCancellationRequest`, `buildRefundRequest`, `cancellationHelpUrl`                                                                                                                                                                             |
| `exporters.ts` | `subscriptionsToCsv`, `csvCell` (formula-injection safe), `buildBackup`, `downloadFile`                                                                                                                                                             |
| `crypto.ts`    | `encryptJson(value, passphrase, iterations?)`, `decryptJson(envelope, passphrase)` (throws `DecryptionError`), `isEncryptedEnvelope`                                                                                                                |
| `schema.ts`    | Zod schemas: `subscriptionInputSchema`, `subscriptionSchema`, `settingsSchema`, `cancellationInputSchema`, `backupSchema`; `fieldErrors(zodError)`                                                                                                  |

### Detection scoring

For each merchant with at least two charges (or one charge from a known service), Keepcut takes the median gap between charges to choose a cycle, then scores:

```
confidence = 0.45 × regularity + 0.30 × amount stability + 0.15 × history length + 0.10 × known merchant
```

Two-charge unknown merchants are penalised ×0.8. Labels: ≥ 0.8 high, ≥ 0.6 medium, otherwise low. The import screen pre-selects medium and high results that don't look inactive.

## Data model

```ts
interface Subscription {
  id: string; // UUID
  name: string; // ≤ 80 chars
  merchantKey: string; // "known:Netflix" or cleaned descriptor; used for de-duplication
  amountMinor: number; // integer minor units (cents; yen has none)
  cycle: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  customDays?: number; // required when cycle is "custom"
  nextRenewal: string; // YYYY-MM-DD
  category: Category; // 13 fixed categories
  status: 'active' | 'trial' | 'paused' | 'canceled';
  trialEndsOn?: string; // required when status is "trial"
  usage?: 1 | 2 | 3 | 4 | 5;
  decision?: 'keep' | 'review' | 'cut';
  cancelUrl?: string; // http(s) only
  notes?: string; // ≤ 1000 chars
  priceHistory: { date: string; amountMinor: number }[];
  cancellation?: { canceledOn: string; method?: string; confirmation?: string; notes?: string };
  source: 'manual' | 'import' | 'demo';
  createdAt: string; // ISO timestamp
  updatedAt: string;
}
```

IndexedDB database `keepcut`, tables: `subscriptions` (indexed by status, category, nextRenewal, merchantKey), `settings` (single row, key `app`), `imports`.

## File formats

### CSV import

Any delimiter (comma, semicolon, tab, pipe). Up to 5 MB and 20,000 rows. Leading bank "preamble" lines before the header are skipped. Required columns: a date, a description, and either one signed amount column or separate debit/credit columns. Example:

```csv
Date,Description,Amount
09/14/2026,NETFLIX.COM 866-579-7172 CA,-17.99
09/15/2026,PAYROLL ACME INC,2450.00
```

### Backup (`keepcut-backup-YYYY-MM-DD.json`)

```json
{
  "format": "keepcut-backup",
  "version": 1,
  "exportedAt": "2026-10-05T12:00:00.000Z",
  "settings": { "currency": "USD", "reminderLeadDays": 3, "theme": "system", "onboarded": true },
  "subscriptions": [/* Subscription objects, max 5000 */]
}
```

### Encrypted backup (`*.encrypted.json`)

```json
{
  "format": "keepcut-encrypted",
  "version": 1,
  "kdf": {
    "name": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 600000,
    "salt": "<base64, 16 bytes>"
  },
  "cipher": { "name": "AES-GCM", "iv": "<base64, 12 bytes>" },
  "data": "<base64 ciphertext of the backup JSON, including the GCM tag>"
}
```

### Spreadsheet export (`keepcut-subscriptions-YYYY-MM-DD.csv`)

One row per subscription with name, category, status, amount, currency, billing cycle, monthly equivalent, next renewal, trial end, usage, decision, cancellation date and confirmation, cancel URL and notes. Cells that a spreadsheet could interpret as formulas are prefixed with `'`.

### Calendar (`keepcut-renewals.ics`)

iCalendar (RFC 5545). One repeating `VEVENT` per active subscription (`RRULE` matching its cycle) and one event per trial end, each with a `VALARM` the configured number of days before.
