import { CalendarDays, Download } from 'lucide-react';
import { Link } from 'react-router';
import { useToast } from '@/hooks/useToast';
import { EmptyState, Field, Money, PageHeader } from '@/components/ui';
import { useAppData } from '@/hooks/useAppData';
import { addCycle, formatDisplayDate, fromISO, relativeDays, shiftDays } from '@/lib/dates';
import { repository } from '@/lib/db/repository';
import { downloadFile } from '@/lib/exporters';
import { buildIcs } from '@/lib/ics';
import type { ISODate, Subscription } from '@/lib/types';

const HORIZON_DAYS = 90;

interface CalendarEvent {
  date: ISODate;
  subscription: Subscription;
  kind: 'renewal' | 'trial-end';
}

function expandEvents(subs: Subscription[], today: ISODate, until: ISODate): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const s of subs) {
    if (s.status === 'trial' && s.trialEndsOn) {
      if (s.trialEndsOn >= today && s.trialEndsOn <= until)
        events.push({ date: s.trialEndsOn, subscription: s, kind: 'trial-end' });
      continue;
    }
    if (s.status !== 'active') continue;
    for (let i = 0; i < 200; i++) {
      const date = addCycle(s.nextRenewal, s.cycle, s.customDays, i);
      if (date > until) break;
      if (date >= today) events.push({ date, subscription: s, kind: 'renewal' });
    }
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.subscription.name.localeCompare(b.subscription.name),
  );
}

export function CalendarPage() {
  const { subscriptions, settings, today } = useAppData();
  const toast = useToast();
  const until = shiftDays(today, HORIZON_DAYS);
  const events = expandEvents(subscriptions, today, until);
  const reminderCount = subscriptions.filter(
    (s) => s.status === 'active' || (s.status === 'trial' && s.trialEndsOn),
  ).length;

  const byMonth = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
      fromISO(e.date),
    );
    byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
  }

  const exportIcs = () => {
    const ics = buildIcs(subscriptions, {
      currency: settings.currency,
      leadDays: settings.reminderLeadDays,
    });
    downloadFile('keepcut-renewals.ics', ics, 'text/calendar;charset=utf-8');
    toast.show('Calendar file downloaded. Open it to add the reminders to your calendar app.');
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`Renewals and trial deadlines for the next ${HORIZON_DAYS} days`}
      />

      <section
        aria-labelledby="reminders-heading"
        className="card mb-6 grid gap-4 p-5 md:grid-cols-3 md:items-end"
      >
        <div className="md:col-span-2">
          <h2 id="reminders-heading" className="text-lg font-semibold">
            Get reminders in your own calendar
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Download a calendar file and open it with Google Calendar, Apple Calendar or Outlook.
            Each renewal repeats automatically and alerts you before it charges — no account or
            notifications permission needed. Re-download after big changes.
          </p>
          <Field label="Remind me" className="mt-4 max-w-xs">
            <select
              className="input"
              value={settings.reminderLeadDays}
              onChange={(e) =>
                void repository.updateSettings({ reminderLeadDays: Number(e.target.value) })
              }
            >
              {[0, 1, 2, 3, 5, 7, 14].map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? 'On the day' : `${d} day${d === 1 ? '' : 's'} before`}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={exportIcs}
          disabled={reminderCount === 0}
        >
          <Download aria-hidden="true" className="size-4" /> Download .ics ({reminderCount})
        </button>
      </section>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled"
          actions={
            <Link to="/app/subscriptions" className="btn-secondary">
              View subscriptions
            </Link>
          }
        >
          No active subscription renews in the next {HORIZON_DAYS} days.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...byMonth.entries()].map(([month, list]) => {
            const total = list.reduce(
              (sum, e) => sum + (e.kind === 'renewal' ? e.subscription.amountMinor : 0),
              0,
            );
            return (
              <section key={month} aria-label={month} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                  <h2 className="font-semibold">{month}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <Money
                      minor={total}
                      currency={settings.currency}
                      className="font-semibold text-slate-900 dark:text-slate-100"
                    />{' '}
                    due
                  </p>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map((e) => (
                    <li key={`${e.subscription.id}-${e.date}-${e.kind}`}>
                      <Link
                        to={`/app/subscriptions/${e.subscription.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <span className="flex items-center gap-4">
                          <span className="w-12 text-center">
                            <span className="block text-xs uppercase text-slate-500 dark:text-slate-400">
                              {new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
                                fromISO(e.date),
                              )}
                            </span>
                            <span className="block text-xl font-bold">
                              {fromISO(e.date).getDate()}
                            </span>
                          </span>
                          <span>
                            <span className="block font-medium">{e.subscription.name}</span>
                            <span
                              className={`block text-xs ${e.kind === 'trial-end' ? 'font-semibold text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}
                            >
                              {e.kind === 'trial-end'
                                ? 'Free trial ends — cancel before this date'
                                : 'Renews'}{' '}
                              · {relativeDays(e.date, today)}
                            </span>
                          </span>
                        </span>
                        <span className="text-right">
                          <Money
                            minor={e.subscription.amountMinor}
                            currency={settings.currency}
                            className="font-semibold"
                          />
                          <span className="sr-only"> on {formatDisplayDate(e.date)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
