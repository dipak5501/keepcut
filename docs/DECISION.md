# Decision: Build Keepcut

> **Keepcut** — _Keep what you use. Cut what you don't._
> A privacy-first subscription and free-trial auditor that finds recurring charges in a
> bank or card CSV export **entirely inside your browser**.

See [RESEARCH.md](RESEARCH.md) for the full comparison of 12 candidate ideas and sources.

## 1. The selected application

A local-first web app (installable, works offline after first load) that:

1. Imports a bank/credit-card CSV export (or pasted rows) and detects recurring charges
   with an on-device algorithm — no bank login, no upload, no AI service.
2. Turns detections into a tracked list with renewal dates, trial end dates, usage
   ratings and a _keep / review / cut_ decision.
3. Surfaces waste: duplicate tools in the same category (e.g. two AI assistants),
   price increases, low-usage subscriptions, and trials about to convert.
4. Guides cancellation with a checklist, records proof (date + confirmation number),
   and drafts a refund/dispute request if a charge appears after cancelling.
5. Exports reminders to any calendar (`.ics` with alarms), so users get real
   notifications without the app needing a server, account, email or push service.

## 2. Target users

- Privacy-conscious consumers who refuse to hand bank credentials to a startup.
- People with "subscription creep" — especially millennials/Gen Z, who waste the most
  ($27–29/mo per CNET 2026).
- Knowledge workers stacking several AI tools (avg. four tools, $66/mo).
- People who frequently start free trials (69–79% have been charged after forgetting).

## 3. The specific problem

Users cannot see the full set of recurring charges spread across cards and statements,
and existing tools force a bad trade-off: **give up privacy** (bank linking) or **do
tedious manual entry**. Then, even when a charge is found, cancelling is confusing and
there is no record if the merchant keeps charging.

## 4. Why the timing is favorable

- Subscription spend rose 23% YoY in 2026 and waste is increasing (CNET).
- AI subscriptions are a brand-new, fast-growing, overlapping category.
- The federal click-to-cancel rule was vacated, so consumers carry the burden of
  tracking and cancelling; the FTC re-opened rulemaking in 2026, keeping the topic
  in the news.
- Hacker News and Reddit show strong appetite for local-first, no-signup tools.

## 5. Existing competitors

Rocket Money and similar bank-linked apps; manual tracker apps; open-source tools such as
SubZero (server-side scan), Subscription Leak Radar (one-off audit) and nobill
(self-hosted server). Details in [RESEARCH.md](RESEARCH.md#competitor-landscape-for-the-selected-idea).

## 6. Our unique differentiation

| Keepcut does                                                      | Why it matters                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Detection runs 100% in the browser; data stored only in IndexedDB | No trust barrier; nothing to breach on a server            |
| Zero install: a static site, no Docker/Node server needed         | Lower friction than self-hosted alternatives               |
| Full lifecycle: detect → decide → cancel → prove → dispute        | Competitors stop at "here is a list"                       |
| Calendar (`.ics`) reminders with alarms                           | Real notifications without accounts, email or push servers |
| Overlap & price-hike insights, including AI tools                 | Targets the fastest-growing waste category                 |
| Encrypted backup (AES-GCM, passphrase)                            | Users own and can move their data safely                   |
| Free and open source (MIT)                                        | Not "a subscription to track subscriptions"                |

## 7. MVP scope

- Landing page and onboarding (demo data or empty start).
- CSV import with automatic column mapping, manual override, preview and detection review.
- Subscription CRUD with validation; statuses (active, trial, paused, canceled).
- Dashboard: monthly/annual totals, upcoming renewals, trials ending, potential savings,
  overlap and price-hike alerts, category breakdown.
- Cancellation assistant with proof log and refund-request letter generator.
- Renewal calendar view and `.ics` export.
- Settings: currency, reminder lead time, theme, JSON/CSV export, encrypted backup,
  restore, delete all data.

## 8. Future expansion

PDF statement parsing (on-device), multi-currency with offline rates, household sharing
via end-to-end-encrypted sync, browser extension to capture trial sign-ups, merchant
cancellation guides contributed by the community, optional paid encrypted sync
(monetization), mobile wrappers.

## 9. Risks and limitations

- **Detection accuracy** varies with bank description formats → mitigated by a review
  step, confidence scores and manual editing.
- **No server = no push/email reminders** → mitigated by calendar export.
- **Browser storage can be cleared** → mitigated by prominent backup/export.
- **Legal**: the dispute letter is a template, not legal advice; clearly labelled.
- **Monetization** is unproven for a free local-first tool; sync/household features are
  the likely paid tier.
