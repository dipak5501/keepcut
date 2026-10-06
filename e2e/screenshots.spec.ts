import { expect, test } from '@playwright/test';

// Regenerates the README images: SCREENSHOTS=1 npx playwright test screenshots --project=desktop
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to regenerate README screenshots');

const OUT = 'docs/screenshots';

test('capture README screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('./');
  await page.screenshot({ path: `${OUT}/landing.png` });

  await page.getByRole('button', { name: 'Try it with demo data' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.screenshot({ path: `${OUT}/dashboard.png` });

  await page.goto('./#/app/subscriptions');
  await expect(page.getByRole('heading', { level: 1, name: 'Subscriptions' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/subscriptions.png` });

  await page.goto('./#/app/import');
  await page.getByRole('button', { name: /try a sample statement/i }).click();
  await page.getByRole('button', { name: /find subscriptions/i }).click();
  await expect(page.getByText(/possible subscriptions/)).toBeVisible();
  await page.screenshot({ path: `${OUT}/import-review.png` });

  await page.goto('./#/app/calendar');
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/calendar.png` });

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/mobile-dark.png` });
});
