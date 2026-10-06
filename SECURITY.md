# Security Policy

## Supported versions

Security fixes are released for the latest `1.x` version.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, use GitHub's private vulnerability reporting: go to the repository's **Security** tab and choose **Report a vulnerability**. Include steps to reproduce, the affected version or commit, and the impact you expect.

You can expect an acknowledgement within 7 days. Once a fix is available we will publish an advisory and credit you unless you prefer to remain anonymous.

## Security model

Keepcut is a static, client-only web app. It has no server, accounts, cookies or analytics.

| Concern                       | Mitigation                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data exfiltration             | No network code. Production builds ship a Content Security Policy (`default-src 'self'; connect-src 'self'; form-action 'none'; object-src 'none'`). An e2e test fails if any request leaves the origin.        |
| Statement privacy             | CSV files are parsed in memory and never stored; only subscriptions the user confirms are saved in IndexedDB. Import history stores file name and counts only.                                                  |
| Malicious input               | File size (5 MB) and row (20,000) limits; every write and every restored backup is validated with Zod; URLs must be `http(s)`; text lengths are capped. React escapes all rendered text.                        |
| Spreadsheet formula injection | CSV export prefixes cells beginning with `=`, `+`, `-`, `@`, tab or carriage return.                                                                                                                            |
| Backup confidentiality        | Optional encryption with AES-256-GCM; key derived with PBKDF2-SHA-256, 600,000 iterations, random 16-byte salt and 12-byte IV, via the Web Crypto API. Wrong passphrases or tampered files fail authentication. |
| Calendar file injection       | `.ics` text is escaped and folded per RFC 5545.                                                                                                                                                                 |
| Logging                       | Debug logging is disabled in production builds; logs never include user data.                                                                                                                                   |
| Supply chain                  | Small dependency set, lockfile committed, `npm audit` in CI.                                                                                                                                                    |

### Known limitations

- Data in IndexedDB is not encrypted at rest; anyone with access to your browser profile can read it. Use your OS account security and encrypted backups.
- A `<meta>` CSP cannot set `frame-ancestors`. If you self-host, also send the CSP as an HTTP header with `frame-ancestors 'none'`.
- Browser extensions with page access can read any web app's data, including Keepcut's.
