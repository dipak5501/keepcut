import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { encryptJson } from '@/lib/crypto';
import { db } from '@/lib/db/database';
import { repository } from '@/lib/db/repository';
import { renderApp } from './renderApp';

beforeEach(async () => {
  await repository.clearAllData();
});

describe('onboarding', () => {
  it('loads demo data from the landing page and opens the dashboard', async () => {
    const { user } = renderApp('/');
    await user.click(screen.getAllByRole('button', { name: /try it with demo data/i })[0]!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Monthly spend')).toBeInTheDocument();
    expect(screen.getByText(/Peloton App trial ends/)).toBeInTheDocument();
    expect(screen.getByText(/Cancel Disney\+ before it renews/)).toBeInTheDocument();
    expect(screen.getByText(/Protect your data with a backup/)).toBeInTheDocument();
    expect(await db.subscriptions.count()).toBe(14);
  });

  it('marks several subscriptions keep or cut from the list', async () => {
    await repository.loadDemoData();
    const { user } = renderApp('/app/subscriptions');
    await user.click(await screen.findByRole('checkbox', { name: /select disney\+/i }));
    await user.click(screen.getByRole('checkbox', { name: /select max/i }));
    await user.click(screen.getByRole('button', { name: /^Cut$/ }));
    await screen.findByText(/Marked 2 subscriptions as Cut/);
    const rows = await db.subscriptions.toArray();
    expect(
      rows.filter((s) => /disney|max/i.test(s.name) && s.decision === 'cut').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('shows an empty state with next steps when there is no data', async () => {
    renderApp('/app');
    expect(await screen.findByText('Let’s find your subscriptions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /import a statement/i })).toHaveAttribute(
      'href',
      '/app/import',
    );
  });
});

describe('subscription form', () => {
  it('reports every invalid field at once and focuses the first one', async () => {
    const { user } = renderApp('/app/subscriptions/new');
    await user.click(await screen.findByRole('button', { name: 'Add subscription' }));

    const name = screen.getByLabelText('Name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText(/Enter an amount/)).toBeInTheDocument();
    await waitFor(() => expect(name).toHaveFocus());
    expect(await db.subscriptions.count()).toBe(0);
  });

  it('rejects non-http cancellation links', async () => {
    const { user } = renderApp('/app/subscriptions/new');
    await user.type(await screen.findByLabelText('Name'), 'Sneaky');
    await user.type(screen.getByLabelText(/Amount/), '5');
    await user.type(screen.getByLabelText(/Cancellation page/), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Add subscription' }));

    expect(await screen.findByText(/full web address/)).toBeInTheDocument();
    expect(await db.subscriptions.count()).toBe(0);
  });

  it('creates, then edits a subscription and records the price change', async () => {
    const { user } = renderApp('/app/subscriptions/new');
    await user.type(await screen.findByLabelText('Name'), 'Notion');
    await user.type(screen.getByLabelText(/Amount/), '10');
    await user.selectOptions(screen.getByLabelText('Category'), 'Software');
    await user.click(screen.getByRole('button', { name: 'Add subscription' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Notion' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /edit/i }));
    const amount = await screen.findByLabelText(/Amount/);
    await user.clear(amount);
    await user.type(amount, '12.50');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('heading', { level: 1, name: 'Notion' });
    const [saved] = await db.subscriptions.toArray();
    expect(saved?.amountMinor).toBe(1250);
    expect(saved?.priceHistory.map((p) => p.amountMinor)).toEqual([1000, 1250]);
  });
});

describe('statement import', () => {
  it('detects subscriptions in the sample statement and saves the selected ones', async () => {
    const { user } = renderApp('/app/import');
    await user.click(await screen.findByRole('button', { name: /try a sample statement/i }));

    expect(await screen.findByLabelText('Date column')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /find subscriptions/i }));

    expect(await screen.findByText(/possible subscriptions/)).toBeInTheDocument();
    expect(screen.getByLabelText('Netflix')).toBeChecked();

    const addButton = screen.getByRole('button', { name: /^Add \d+ subscriptions?$/ });
    const expected = Number(addButton.textContent?.match(/\d+/)?.[0]);
    expect(expected).toBeGreaterThan(5);
    await user.click(addButton);

    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    const subs = await db.subscriptions.toArray();
    expect(subs).toHaveLength(expected);
    expect(subs.every((s) => s.source === 'import')).toBe(true);
    expect(await db.imports.count()).toBe(1);
  });

  it('flags charges that continued after a recorded cancellation', async () => {
    await repository.loadDemoData();
    const { user } = renderApp('/app/import');
    await user.click(await screen.findByRole('button', { name: /try a sample statement/i }));
    await user.click(await screen.findByRole('button', { name: /find subscriptions/i }));

    expect(await screen.findByText(/Still charged after you cancelled/)).toBeInTheDocument();
    expect(screen.getByLabelText('Adobe')).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'Request a refund' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/app\/subscriptions\//),
    );
  });

  it('explains files it cannot parse', async () => {
    const { user } = renderApp('/app/import');
    await user.click(await screen.findByText('Paste rows instead'));
    await user.type(screen.getByLabelText('CSV text'), 'just one line');
    await user.click(screen.getByRole('button', { name: /use pasted rows/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('calendar and settings', () => {
  it('lists upcoming renewals and trial deadlines', async () => {
    await repository.loadDemoData();
    renderApp('/app/calendar');
    expect(await screen.findByRole('button', { name: /download \.ics/i })).toBeEnabled();
    expect(screen.getByText(/Free trial ends/)).toBeInTheDocument();
  });

  it('deletes all data after confirmation', async () => {
    await repository.loadDemoData();
    const { user } = renderApp('/app/settings');
    await user.click(await screen.findByRole('button', { name: /delete all data/i }));
    const dialog = await screen.findByRole('dialog', { name: /delete all keepcut data/i });
    await user.click(within(dialog).getByRole('button', { name: 'Delete everything' }));

    await waitFor(async () => expect(await db.subscriptions.count()).toBe(0));
    expect(
      await screen.findByRole('heading', { level: 1, name: /find the subscriptions/i }),
    ).toBeInTheDocument();
  });

  it('restores an encrypted backup only with the right passphrase', async () => {
    await repository.loadDemoData();
    const envelope = await encryptJson(
      await repository.exportBackup(),
      'correct horse battery',
      10_000,
    );
    await repository.clearAllData();

    const { user } = renderApp('/app/settings');
    const file = new File([JSON.stringify(envelope)], 'backup.encrypted.json', {
      type: 'application/json',
    });
    await user.upload(await screen.findByLabelText(/restore from backup/i), file);

    const unlock = await screen.findByRole('dialog', { name: /unlock backup/i });
    await user.type(within(unlock).getByLabelText('Passphrase'), 'wrong passphrase');
    await user.click(within(unlock).getByRole('button', { name: 'Unlock' }));
    const input = within(unlock).getByLabelText('Passphrase');
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(await db.subscriptions.count()).toBe(0);

    await user.clear(input);
    await user.type(input, 'correct horse battery');
    await user.click(within(unlock).getByRole('button', { name: 'Unlock' }));

    const confirm = await screen.findByRole('dialog', { name: /replace current data/i });
    await user.click(within(confirm).getByRole('button', { name: /replace and restore/i }));
    await waitFor(async () => expect(await db.subscriptions.count()).toBe(14));
  });

  it('shows a not-found page for unknown routes', async () => {
    renderApp('/app/nope');
    expect(
      await screen.findByRole('heading', { name: /not found|can’t find|doesn’t exist/i }),
    ).toBeInTheDocument();
  });
});
