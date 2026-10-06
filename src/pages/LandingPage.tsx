import {
  BellRing,
  CalendarDays,
  EyeOff,
  FileUp,
  Layers,
  Lock,
  ScanSearch,
  Scissors,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/useToast';
import { useSettingsQuery } from '@/hooks/useAppData';
import { repository } from '@/lib/db/repository';
import { logger } from '@/lib/logger';

const REPO_URL = import.meta.env.VITE_REPO_URL as string | undefined;

const STATS: Array<{ value: string; label: string; source: string; href: string }> = [
  {
    value: '$111/mo',
    label: 'average US subscription spend — and $21 of it goes to services people don’t use',
    source: 'CNET, 2026',
    href: 'https://www.cnet.com/tech/services-and-software/subscription-survey-2026/',
  },
  {
    value: '69%',
    label: 'of people have been charged after forgetting to cancel a free trial',
    source: 'BestMoney, 2026',
    href: 'https://www.bestmoney.com/credit-cards/learn-more/hidden-subscription-fees-survey',
  },
  {
    value: '4 tools',
    label: 'the average paying AI user subscribes to, at about $66 a month',
    source: 'Bango survey via Subnesio',
    href: 'https://www.subnesio.one/blog/auditing-your-ai-subscriptions-the-new-subscription-creep',
  },
];

const STEPS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: FileUp,
    title: 'Drop in a statement',
    body: 'Export a CSV from your bank or card website. Keepcut maps the columns automatically — no bank login needed.',
  },
  {
    icon: ScanSearch,
    title: 'Review what it found',
    body: 'Recurring charges are detected on your device, with billing cycle, next renewal and a confidence score.',
  },
  {
    icon: Scissors,
    title: 'Keep or cut',
    body: 'Rate how much you use each one, follow the cancellation checklist, and track what you’ve saved.',
  },
];

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Layers,
    title: 'Overlap alerts',
    body: 'Paying for three AI assistants or four streaming services? See duplicates side by side.',
  },
  {
    icon: TrendingUp,
    title: 'Price-hike detection',
    body: 'Spot silent price increases hiding in your statement history.',
  },
  {
    icon: BellRing,
    title: 'Trial countdowns',
    body: 'Free trials get their own countdown so they never quietly convert.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar reminders',
    body: 'Export renewals to Google, Apple or Outlook Calendar with alerts days in advance.',
  },
  {
    icon: ShieldCheck,
    title: 'Proof of cancellation',
    body: 'Log the date and confirmation number. Charged anyway? Draft a refund request in one click.',
  },
  {
    icon: Lock,
    title: 'Encrypted backups',
    body: 'Export your data with a passphrase (AES-256) and restore it on any device.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Does my bank statement get uploaded anywhere?',
    a: 'No. The file is read by JavaScript running in your browser tab and is never sent over the network. Keepcut has no server, no analytics and no tracking. Only the subscriptions you choose to keep are saved, in your browser’s local storage (IndexedDB).',
  },
  {
    q: 'Which banks are supported?',
    a: 'Any bank or card that can export CSV. Keepcut detects common column names, date formats (US, European, ISO) and both signed-amount and debit/credit layouts. You can adjust the mapping if it guesses wrong.',
  },
  {
    q: 'How do I get reminders without an account?',
    a: 'Download the calendar file from the Calendar page and open it with your calendar app. Each renewal and trial end becomes an event with an alert a few days before.',
  },
  {
    q: 'What happens if I clear my browser data?',
    a: 'Your Keepcut data would be deleted too. Use Settings → Backup to download a copy (optionally encrypted) and restore it any time.',
  },
  {
    q: 'Is Keepcut financial or legal advice?',
    a: 'No. It is an organising tool. Letter templates are starting points — check your provider’s terms and local consumer law.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettingsQuery();
  const [busy, setBusy] = useState(false);

  const startDemo = async () => {
    setBusy(true);
    try {
      const count = await repository.loadDemoData();
      await repository.updateSettings({ onboarded: true });
      toast.show(
        `Loaded ${count} demo subscriptions. Explore freely — you can remove them in Settings.`,
      );
      navigate('/app');
    } catch (error) {
      logger.error('Failed to load demo data', error);
      toast.show(
        'Could not open browser storage. Private browsing modes sometimes block it.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const startImport = async () => {
    await repository.updateSettings({ onboarded: true }).catch(() => undefined);
    navigate('/app/import');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="border-b border-slate-100 dark:border-slate-900">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav aria-label="Primary">
            {settings?.onboarded ? (
              <Link to="/app" className="btn-primary">
                Open dashboard
              </Link>
            ) : (
              <Link to="/app/import" className="btn-secondary">
                Open app
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
              <EyeOff aria-hidden="true" className="size-4" /> No bank login · No upload · No
              account
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              Find the subscriptions you forgot you’re paying for.
            </h1>
            <p className="mt-5 text-lg text-slate-700 dark:text-slate-300">
              Drop in a bank or card CSV. Keepcut spots recurring charges, free trials and price
              hikes — right here in your browser — then helps you keep what you use and cut what you
              don’t.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-primary px-6 py-3 text-base"
                onClick={startDemo}
                disabled={busy}
              >
                {busy ? 'Loading demo…' : 'Try it with demo data'}
              </button>
              <button
                type="button"
                className="btn-secondary px-6 py-3 text-base"
                onClick={startImport}
              >
                Import my statement
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Free and open source. Works offline once loaded.
            </p>
          </div>

          <div aria-hidden="true" className="card relative overflow-hidden p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Found in your statement
            </p>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {[
                [
                  'Netflix',
                  'Monthly · price up $2.50',
                  '$17.99',
                  'text-amber-700 dark:text-amber-300',
                ],
                ['ChatGPT', 'Monthly · AI tools', '$20.00', 'text-slate-600 dark:text-slate-400'],
                [
                  'Claude',
                  'Monthly · AI tools — overlap',
                  '$20.00',
                  'text-rose-700 dark:text-rose-300',
                ],
                [
                  'City Gym',
                  'Monthly · used twice this year',
                  '$39.99',
                  'text-rose-700 dark:text-rose-300',
                ],
                ['Greenbox Meal Kits', 'Weekly', '$59.95', 'text-slate-600 dark:text-slate-400'],
              ].map(([name, meta, price, metaClass]) => (
                <li key={name} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold">{name}</p>
                    <p className={`text-xs ${metaClass}`}>{meta}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{price}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-900/40 dark:text-brand-100">
              Cutting 2 of these saves <strong>$719.88 a year</strong>.
            </div>
          </div>
        </section>

        <section
          aria-labelledby="why"
          className="border-y border-slate-100 bg-slate-50 py-14 dark:border-slate-900 dark:bg-slate-900/40"
        >
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="why" className="sr-only">
              Why it matters
            </h2>
            <ul className="grid gap-8 md:grid-cols-3">
              {STATS.map((s) => (
                <li key={s.value}>
                  <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-400">
                    {s.value}
                  </p>
                  <p className="mt-2 text-slate-700 dark:text-slate-300">{s.label}</p>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link mt-2 inline-block text-xs"
                  >
                    Source: {s.source}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="how" className="text-3xl font-bold tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white dark:bg-brand-500 dark:text-slate-950">
                    {i + 1}
                  </span>
                  <step.icon
                    aria-hidden="true"
                    className="size-5 text-brand-700 dark:text-brand-400"
                  />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 pb-16">
          <h2 id="features" className="text-3xl font-bold tracking-tight">
            More than a list
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <f.icon
                  aria-hidden="true"
                  className="mt-1 size-6 shrink-0 text-brand-700 dark:text-brand-400"
                />
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="privacy"
          className="bg-slate-900 py-16 text-slate-100 dark:bg-slate-900/60"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
            <div>
              <h2 id="privacy" className="text-3xl font-bold tracking-tight">
                Private by architecture, not by promise
              </h2>
              <p className="mt-4 text-slate-300">
                Most subscription trackers ask for your bank password or upload your statement to
                their servers. Keepcut can’t see your data even if it wanted to: there is no server.
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                'Statements are parsed in your browser tab and discarded after import',
                'Saved data lives only in this browser (IndexedDB) on this device',
                'A strict Content Security Policy blocks the app from contacting other servers',
                'No accounts, cookies, analytics or third-party scripts',
                'Open source — verify every line yourself',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-brand-400"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 py-16">
          <h2 id="faq" className="text-3xl font-bold tracking-tight">
            Questions
          </h2>
          <div className="mt-6 divide-y divide-slate-200 dark:divide-slate-800">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="text-slate-500 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-slate-700 dark:text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="btn-primary px-6 py-3 text-base"
              onClick={startDemo}
              disabled={busy}
            >
              Try it with demo data
            </button>
            <button
              type="button"
              className="btn-secondary px-6 py-3 text-base"
              onClick={startImport}
            >
              Import my statement
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8 text-sm text-slate-600 dark:border-slate-900 dark:text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:justify-between">
          <p>Keepcut is free, open-source software (MIT). Not financial or legal advice.</p>
          {REPO_URL && (
            <a href={REPO_URL} className="link" target="_blank" rel="noopener noreferrer">
              Source code<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
