# Architecture

Keepcut is a **static, local-first single-page app**. Everything — parsing, detection, storage, encryption — happens in the user's browser. There is deliberately no backend: it removes the biggest privacy risk (a server holding bank data), the biggest cost, and most of the attack surface.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│ Pages (src/pages)                                            │
│  Landing · Dashboard · Subscriptions · Detail · Form ·       │
│  Import · Calendar · Settings · NotFound                     │
├──────────────────────────────────────────────────────────────┤
│ Shared UI (src/components)                                   │
│  AppLayout · AppDataProvider · Modal/ConfirmDialog · Toast · │
│  Field · Money · badges · ErrorBoundary · ThemeSync          │
├──────────────────────────────────────────────────────────────┤
│ Hooks (src/hooks)                                            │
│  useAppData (live subscriptions + settings + today)          │
│  useToast                                                    │
├──────────────────────────────────────────────────────────────┤
│ Domain logic (src/lib) — pure TypeScript, unit-tested        │
│  csv → detect → insights · money · dates · merchants ·       │
│  ics · letters · exporters · crypto · schema · demo          │
├──────────────────────────────────────────────────────────────┤
│ Repository (src/lib/db/repository.ts) — single write path    │
│  Zod validation · price history · import summaries · backup  │
├──────────────────────────────────────────────────────────────┤
│ Dexie 4 → IndexedDB "keepcut"                                │
│  subscriptions · settings · imports                          │
└──────────────────────────────────────────────────────────────┘
```

## Key flows

### Import

1. **Upload** — the file is size-checked (5 MB) and read with `File.text()`; paste and a generated sample statement are alternatives.
2. **Parse** — `parseCsvText` skips bank preamble lines, auto-detects the delimiter and enforces the 20,000-row limit.
3. **Map** — `guessMapping`, `detectDateFormat` and `detectChargeSign` pre-fill the mapping; the user can adjust it while a live preview (`normalizeTransactions`) shows per-row errors.
4. **Detect** — `detectRecurring` groups charges by `merchantKeyFor(description)`, infers the cycle from the median gap, and scores confidence. Results are compared with tracked subscriptions (already tracked, or charged after a recorded cancellation).
5. **Review and save** — the user picks results and edits names and categories; `repository.addDetected` writes them in one transaction and stores an import summary (file name and counts only). The raw statement is then garbage-collected.

### Reading data

`AppDataProvider` (wrapping the in-app routes) subscribes to IndexedDB with `useLiveQuery`. Any write — from any page or tab — re-renders the consumers. Derived values (totals, overlaps, upcoming charges) are computed on render from pure functions; at realistic sizes (tens to hundreds of subscriptions) this costs well under a millisecond, so there is no cache to invalidate.

### Writes

Pages call repository methods, which validate with Zod and return `Result<T>` so forms can show field-level errors. Forms also validate locally first so every error appears at once, and focus moves to the first invalid field.

## Decisions

| Decision                                    | Why                                                               |
| ------------------------------------------- | ----------------------------------------------------------------- |
| No backend or accounts                      | Privacy by construction; zero hosting cost; nothing to breach     |
| CSV instead of bank aggregation             | Universal and free; no credentials; works in every country        |
| IndexedDB via Dexie                         | Durable, async, large quota; live queries keep the UI in sync     |
| Integer minor units for money               | Avoids floating-point drift in totals                             |
| ISO date strings                            | Timezone-safe calendar dates; sortable; human-readable in backups |
| Hash routing, relative base                 | Deploys to any static host or sub-path with no rewrites           |
| `.ics` export instead of push notifications | Works everywhere without a server or permission prompts           |
| Web Crypto for backups                      | Audited platform primitives; no third-party crypto                |
| Lazy-loaded secondary pages, vendor chunks  | Fast first load; long-term caching of framework code              |

## Security boundaries

See [SECURITY.md](../SECURITY.md). In short: a production-only CSP blocks all off-origin requests, inputs are size-limited and schema-validated, exports are injection-safe, and the logger never records user data.

## Testing strategy

| Level       | Tooling                          | Scope                                                                                                                                                               |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                           | Every module in `src/lib`, including parsing edge cases, detection on a generated statement, crypto round-trips and repository behaviour on fake IndexedDB          |
| Integration | Vitest + Testing Library + jsdom | Full app router: onboarding, form validation, create/edit, import, encrypted restore, delete-all, 404                                                               |
| End-to-end  | Playwright + axe-core            | Production build on desktop and mobile Chromium: user journeys, downloads, CSP, no third-party requests, WCAG 2.1 AA in light and dark mode, no horizontal overflow |

## Directory layout

```
src/
  components/   shared UI building blocks
  hooks/        React hooks and contexts
  lib/          domain logic (+ *.test.ts)
    db/         Dexie database and repository
  pages/        route components
  test/         test setup, factories, integration tests
e2e/            Playwright specs
docs/           research, decision, plan, API, architecture, screenshots
```
