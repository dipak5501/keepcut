# Contributing to Keepcut

Thanks for your interest in improving Keepcut. Bug reports, merchant-pattern additions, accessibility fixes and documentation improvements are all welcome.

## Ground rules

- **Privacy is the product.** Changes must not send user data anywhere, add analytics, third-party scripts, remote fonts or network calls. The Content Security Policy (`vite.config.ts`) and the e2e test asserting "no request leaves localhost" enforce this — don't loosen them.
- **Never log user data.** Use `logger` from `src/lib/logger.ts`; log messages and error objects only, never transactions, names or amounts.
- **All writes go through the repository** (`src/lib/db/repository.ts`) so they are validated with Zod.
- **Accessibility is not optional.** Every control needs a label, keyboard support and visible focus. The lint rules and axe checks must pass.

## Getting started

```bash
npm ci
npm run dev                       # http://localhost:5173
npx playwright install chromium   # once, for e2e tests
```

## Before opening a pull request

```bash
npm run check      # lint + typecheck + unit/integration tests + build
npm run test:e2e   # Playwright on desktop and mobile Chromium
npm run format     # Prettier
```

- Add or update tests with every behaviour change. Domain logic in `src/lib` should have unit tests; user flows should have integration tests (`src/test/app.test.tsx`) and, where it matters, an e2e test.
- Keep pull requests focused. Describe the problem, the change, and how you verified it.
- If you change the UI, include before/after screenshots. To refresh the README images: `SCREENSHOTS=1 npx playwright test screenshots --project=desktop`.

## Adding a known merchant

Add an entry to `KNOWN_MERCHANTS` in `src/lib/merchants.ts` with a display name, category and a case-insensitive regular expression that matches typical statement descriptors. Order matters: put specific patterns (for example iCloud+) before generic ones (Apple). Add a test case to `src/lib/merchants.test.ts`.

## Commit messages

Use short, imperative subject lines (`Add OFX parser`, `Fix trial reminder date`). Conventional Commit prefixes (`feat:`, `fix:`, `docs:`) are welcome but not required.

## Code of conduct

Be respectful and constructive. Harassment or discrimination of any kind is not tolerated. Maintainers may remove comments or contributors that violate this.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
