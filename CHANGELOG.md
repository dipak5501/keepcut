# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Bulk keep / review / cut (and clear decision) from the subscriptions list.
- Dashboard nudge when no backup has been downloaded, or the last one is older than 14 days.
- Settings records `lastBackupAt` after plain, encrypted, or recovery backups.

## [1.0.0] - 2026-10-05

First public release.

### Added

- On-device CSV import with automatic delimiter, preamble, column, date-format and sign detection, a row-level preview, and file size and row limits.
- Recurring-charge detection (weekly to yearly and custom cycles) with confidence scores, about 55 known services, price-change detection and stopped-subscription hints.
- Warning when a statement shows charges after a recorded cancellation, linked to a refund-request letter.
- Dashboard with monthly and yearly totals, potential savings, money already cut, an attention list, upcoming charges and category breakdown.
- Subscription list with search, filters and sorting; detail page with usage rating, Keep/Cut decision and price history; create and edit forms with full validation.
- Cancellation assistant with checklist, cancellation email template and proof-of-cancellation record; refund-request letter generator.
- Calendar page and `.ics` export with repeating events and configurable reminder alerts.
- JSON, CSV and AES-256-GCM encrypted backups with validated restore; demo data and sample statement; delete-all-data control.
- Light and dark themes, responsive layout with mobile navigation, WCAG 2.1 AA accessibility checks.
- Production Content Security Policy, unit, integration and end-to-end test suites, CI and GitHub Pages deployment workflows.

[1.0.0]: https://github.com/dipak5501/keepcut/releases/tag/v1.0.0
