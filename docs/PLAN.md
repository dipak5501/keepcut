# Product & Engineering Plan

## User journeys

1. **First visit → value in 60 seconds.** Landing page → "Try with demo data" → dashboard
   shows totals, overlap alerts and an expiring trial. No signup.
2. **Import a statement.** Import → drop CSV → columns auto-mapped (editable) → preview →
   detected recurring charges listed with confidence → select → added to tracker.
3. **Decide.** Subscriptions → rate usage, mark keep / review / cut → dashboard shows
   potential savings.
4. **Cancel and prove it.** Subscription → "Cancel" → checklist → record date and
   confirmation number → status becomes canceled, savings counted.
5. **Charged after cancelling.** Subscription → "Draft refund request" → copy letter.
6. **Never miss a renewal.** Calendar → "Download reminders (.ics)" → import into any
   calendar app with alarms N days before each renewal or trial end.
7. **Protect data.** Settings → encrypted backup / restore / delete everything.

## Core features (v1) vs postponed

| v1                                                         | Postponed                                |
| ---------------------------------------------------------- | ---------------------------------------- |
| CSV/paste import, auto mapping, on-device detection        | PDF / OCR statement import               |
| Subscription CRUD, statuses, trials, usage, decisions      | Multi-currency conversion                |
| Dashboard insights (totals, overlap, price hikes, savings) | Sync across devices, household sharing   |
| Cancellation checklist, proof log, refund letter           | Browser extension, email receipt parsing |
| Calendar view + `.ics` export                              | Push notifications                       |
| JSON/CSV export, encrypted backup, restore, wipe           | Accounts, payments, cloud backend        |
| Light/dark theme, responsive, accessible                   | Localization (i18n)                      |

## Technical architecture

Static single-page app; no backend.

```
UI (React 19 + React Router, Tailwind CSS v4)
   │  pages/ components/
   ▼
Domain (pure TypeScript, fully unit-tested)
   │  lib/csv  lib/detect  lib/money  lib/dates  lib/insights  lib/ics  lib/letters
   ▼
Data access layer (lib/db/repository.ts) — Zod-validated "API"
   ▼
IndexedDB via Dexie (browser-local)       lib/crypto (WebCrypto AES-GCM backups)
```

- Pure domain functions have no React or DB imports, which keeps them testable.
- `HashRouter` + relative asset base lets the build run from any static host or sub-path.

## Database design (IndexedDB, Dexie)

| Table           | Key         | Indexed fields                                     | Notes                                                          |
| --------------- | ----------- | -------------------------------------------------- | -------------------------------------------------------------- |
| `subscriptions` | `id` (UUID) | `status`, `category`, `nextRenewal`, `merchantKey` | Money stored as integer minor units (`amountMinor`)            |
| `settings`      | `key`       | —                                                  | Single row `app`: currency, reminderLeadDays, theme, onboarded |
| `imports`       | `id` (UUID) | `importedAt`                                       | Audit log of imports (file name, rows, detections)             |

Subscription fields: `name, merchantKey, amountMinor, cycle, customDays?, nextRenewal,
category, status, trialEndsOn?, usage?, decision?, cancelUrl?, notes, priceHistory[],
cancellation?, source, createdAt, updatedAt`.

Schema versioning uses Dexie `version(n)` migrations.

## API design (in-app data layer)

All writes go through `lib/db/repository.ts`, which validates with Zod and returns typed
results. See [API.md](API.md) for signatures. Validation errors surface as field-level
messages in forms.

## Authentication & authorization

None in v1, by design: there is no server and no shared data. Data lives in the user's
browser profile; OS/browser account protections apply. Optional encrypted backups protect
exported files. If sync is added, it will use end-to-end encryption with user-held keys.

## Error handling

- Zod validation on every write and on backup import (untrusted input).
- CSV import errors are collected per row and shown as a summary; bad rows are skipped,
  never silently coerced.
- A top-level React error boundary shows a recovery screen with a "download backup" action.
- Storage failures (quota, private mode) show a toast with guidance.

## Logging

A tiny `logger` that writes to the console in development only and never logs
transaction data. There is no telemetry or analytics.

## Security & privacy

- No network requests at runtime; strict Content-Security-Policy in production builds
  (`default-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`
  where supported).
- CSV export neutralizes formula injection (`=`, `+`, `-`, `@` prefixes).
- File size (5 MB) and row (20,000) limits on import.
- Encrypted backups: PBKDF2-SHA256 (600k iterations) → AES-GCM-256, random salt and IV.
- No `dangerouslySetInnerHTML`; React escaping throughout.
- `npm audit` in CI.

## Accessibility & responsive design

WCAG 2.2 AA targets: semantic landmarks, skip link, labelled inputs, visible focus,
native `<dialog>` for modals, `aria-live` toasts, color-independent status (icons + text),
reduced-motion support, contrast checked with axe in Playwright. Mobile-first layout with
bottom navigation on small screens and sidebar on desktop.

## Testing strategy

| Layer        | Tool                                              | Scope                                                                              |
| ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Unit         | Vitest                                            | CSV parsing, date/amount parsing, detection, insights, money, ICS, letters, crypto |
| Integration  | Vitest + Testing Library + fake-indexeddb         | Repository + React pages (forms, import flow)                                      |
| End-to-end   | Playwright (Chromium, desktop + mobile viewports) | Onboarding, import, edit, cancel, export, axe a11y scan                            |
| Static       | `tsc --noEmit`, ESLint (incl. jsx-a11y), Prettier | Every commit / CI                                                                  |
| Supply chain | `npm audit --omit=dev`                            | CI                                                                                 |

## Deployment

`npm run build` emits a static `dist/`. GitHub Actions: CI workflow (lint, typecheck,
unit, build, e2e) and an optional GitHub Pages deploy workflow. Any static host works.

## Milestones

1. Project setup, tooling, CI — day 1
2. Domain logic (CSV, detection, insights) with unit tests — day 1–2
3. Data layer + core pages — day 2–3
4. UX polish, accessibility, responsive — day 3
5. E2E tests, security review, docs, release — day 4
