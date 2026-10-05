import { expect, test } from '@playwright/test';
import { enterDemo, trackErrors } from './helpers.js';

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });

test.describe('reviews, team and digest', () => {
  let errors;
  test.beforeEach(() => { errors = []; });
  test.afterEach(() => { expect(errors, 'no console or page errors').toEqual([]); });

  test('the Reviews page shows first-review speed, who is waiting, and reviewer load', async ({ page }) => {
    errors = trackErrors(page);
    await enterDemo(page, '/dashboard/reviews');
    await expect(page.getByText('Median first review')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Waiting for a first review' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reviewer load' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Reviews/ }).first()).toHaveAttribute('aria-current', 'page');
  });

  test('the Overview leads with review speed and no longer repeats the commit feed', async ({ page }) => {
    errors = trackErrors(page);
    await enterDemo(page);
    await expect(page.getByText('Median time to first review')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent commits' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Contributors' }).click();
    await expect(page.getByRole('heading', { name: 'Recent commits' })).toBeVisible();
  });

  test('Team combines chosen repositories and the table sorts', async ({ page }) => {
    errors = trackErrors(page);
    await enterDemo(page, '/dashboard/team');
    await page.getByRole('button', { name: 'Choose repositories' }).click();
    const dialog = page.getByRole('dialog');
    for (const name of ['acme/web', 'acme/api', 'acme/mobile']) {
      const row = dialog.locator('label', { hasText: name });
      if (!(await row.getByRole('checkbox').isChecked())) await row.click(); // some are already in view
    }
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/repos=.*acme%2Fapi.*acme%2Fmobile|repos=.*acme\/api.*acme\/mobile/);
    const table = page.getByRole('table');
    await expect(table.getByRole('rowheader').filter({ hasText: /acme\/\s*(web|api|mobile)$/ })).toHaveCount(3);
    await page.getByRole('button', { name: /^Waiting/ }).click();
    await expect(page.getByRole('columnheader', { name: /Waiting/ })).toHaveAttribute('aria-sort', /ascending|descending/);
    await table.getByRole('link', { name: /acme\/\s*api/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/acme\/\s*api/);
  });

  test('Digest previews email, Slack and plain text, and the demo cannot send', async ({ page }) => {
    errors = trackErrors(page);
    await enterDemo(page, '/dashboard/digest');
    // The preview is sandboxed (no scripts), so assert on what is handed to it rather than reaching inside.
    const mail = page.locator('iframe[title="E-mail preview"]');
    await expect(mail).toHaveAttribute('sandbox', '');
    await expect(mail).toHaveAttribute('srcdoc', /Your week:/);
    await page.getByRole('tab', { name: 'Slack' }).click();
    await expect(page.getByText('App', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Plain text' }).click();
    await expect(page.locator('pre')).toContainText('Last 7 days across');
    await expect(page.getByText(/cannot send it/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save settings' })).toHaveCount(0);
  });

  test('the command menu reaches the new pages', async ({ page }) => {
    errors = trackErrors(page);
    await enterDemo(page);
    await page.waitForTimeout(400);
    await page.keyboard.press('Control+k');
    await page.keyboard.type('weekly digest');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dashboard\/digest/);
  });
});
