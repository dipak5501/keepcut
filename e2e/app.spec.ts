import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function startDemo(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try it with demo data' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

test('landing page explains the product and has no accessibility violations', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('subscriptions you forgot');
  await expectNoA11yViolations(page);
});

test('production build ships a strict content security policy', async ({ page }) => {
  await page.goto('./');
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self'");
});

test('demo walkthrough: dashboard, list, detail and cancellation', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) requests.push(r.url());
  });

  await startDemo(page);
  await expect(page.getByText('Peloton App trial ends')).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto('./#/app/subscriptions');
  await page.getByRole('searchbox').fill('city gym');
  await page
    .getByRole('link', { name: /City Gym/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /City Gym/ })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Cancel it' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Confirmation number (optional)').fill('GYM-123');
  await dialog.getByRole('button', { name: 'Mark as cancelled' }).click();
  await expect(page.getByText('GYM-123')).toBeVisible();

  expect(requests, 'the app must not contact any third-party server').toEqual([]);
});

test('import the sample statement end to end', async ({ page }) => {
  await page.goto('./#/app/import');
  await page.getByRole('button', { name: /try a sample statement/i }).click();
  await expect(page.getByLabel('Date column')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: /find subscriptions/i }).click();
  await expect(page.getByText(/possible subscriptions/)).toBeVisible();
  await expect(page.getByLabel('Netflix', { exact: true })).toBeChecked();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: /^Add \d+ subscriptions?$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText(/Netflix went up/)).toBeVisible();
});

test('add a subscription manually with validation', async ({ page }) => {
  await page.goto('./#/app/subscriptions/new');
  await page.getByRole('button', { name: 'Add subscription' }).click();
  await expect(page.getByText('Name is required')).toBeVisible();
  await expect(page.getByLabel('Name')).toBeFocused();

  await page.getByLabel('Name').fill('Notion');
  await page.getByLabel(/Amount/).fill('10');
  await page.getByRole('button', { name: 'Add subscription' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Notion' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Notion' })).toBeVisible();
});

test('exports a calendar file and an encrypted backup', async ({ page }) => {
  await startDemo(page);
  await page.goto('./#/app/calendar');
  const [ics] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download \.ics/i }).click(),
  ]);
  expect(ics.suggestedFilename()).toBe('keepcut-renewals.ics');
  await expectNoA11yViolations(page);

  await page.goto('./#/app/settings');
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Encrypted backup' }).click();
  const dialog = page.getByRole('dialog', { name: 'Encrypted backup' });
  await dialog.getByLabel('Passphrase', { exact: true }).fill('correct horse battery');
  await dialog.getByLabel('Confirm passphrase').fill('correct horse battery');
  const [backup] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: /encrypt/i }).click(),
  ]);
  expect(backup.suggestedFilename()).toMatch(/^keepcut-backup-.*\.encrypted\.json$/);
});

test('dark theme passes contrast checks', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await startDemo(page);
  await expectNoA11yViolations(page);
});

test('layout does not overflow horizontally', async ({ page }) => {
  await startDemo(page);
  for (const path of [
    './#/app',
    './#/app/subscriptions',
    './#/app/import',
    './#/app/calendar',
    './#/app/settings',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});
