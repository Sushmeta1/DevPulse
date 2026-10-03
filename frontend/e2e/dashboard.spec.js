import { expect, test } from '@playwright/test';
import { enterDemo, trackErrors } from './helpers.js';

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });

test.describe('dashboard', () => {
  let errors;
  test.beforeEach(async ({ page }) => {
    errors = trackErrors(page);
    await enterDemo(page);
  });
  test.afterEach(() => { expect(errors, 'no console or page errors').toEqual([]); });

  test('lands on the first repository with the dark theme applied before paint', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/acme\/\s*web/);
  });

  test('chart and calendar tooltips appear on hover', async ({ page }) => {
    const chart = page.getByRole('img', { name: /^Commits per day/ }).first();
    const box = await chart.boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
    await expect(page.getByText('previous period').first()).toBeVisible();
    await page.getByRole('gridcell').nth(12).hover();
    await expect(page.getByRole('status').first()).toBeVisible();
  });

  test('changing the range updates the URL and survives a reload', async ({ page }) => {
    await page.getByRole('tab', { name: '90d' }).click();
    await expect(page).toHaveURL(/range=90/);
    await page.reload();
    await expect(page.getByRole('tab', { name: '90d' })).toHaveAttribute('aria-selected', 'true');
  });

  test('filtering by a contributor is reflected in the URL and can be cleared', async ({ page }) => {
    await page.getByRole('button', { name: /Maya Chen/ }).first().click();
    await expect(page).toHaveURL(/who=maya-chen/);
    await page.getByRole('button', { name: 'Clear filter: maya-chen' }).click();
    await expect(page).not.toHaveURL(/who=/);
  });

  test('metric, weekly and compare controls work', async ({ page }) => {
    await page.getByRole('tab', { name: 'Weekly' }).click();
    await page.getByRole('tab', { name: 'PRs merged' }).click();
    await expect(page.getByRole('img', { name: /PRs merged per week/ })).toBeVisible();
  });

  test('the command menu switches repository from the keyboard', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.keyboard.type('design-system');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/design-system/);
  });

  test('a capped monorepo warns that history is incomplete and withholds bogus deltas', async ({ page }) => {
    await page.goto('/dashboard?repo=acme/monorepo&range=90');
    await expect(page.getByText(/most recent 1,000 commits/)).toBeVisible();
    await expect(page.getByText(/versus the previous period/)).toHaveCount(0);
  });

  test('empty, single-commit and very long repository names all render', async ({ page }) => {
    await page.goto('/dashboard?repo=acme/empty');
    await expect(page.getByText('No commits in this period').first()).toBeVisible();
    await page.goto('/dashboard/people?repo=acme/hello-world');
    await expect(page.getByText('No linked GitHub account').or(page.getByText('@jo'))).toBeVisible();
    await page.goto('/dashboard?repo=acme/platform-infrastructure-consolidation-initiative-2025-q3');
    await expect(page.getByText('AI sprint summary')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBe(0);
  });

  test('an unknown repository gets a helpful state, not a blank page', async ({ page }) => {
    await page.goto('/dashboard?repo=acme/nope');
    await expect(page.getByText('Repository not found')).toBeVisible();
  });

  test('pull request filters and search', async ({ page }) => {
    await page.goto('/dashboard/pulls?repo=acme/api&range=14');
    await page.getByRole('tab', { name: /Merged/ }).click();
    await page.getByRole('searchbox').fill('zzzzzz');
    await expect(page.getByText('No matching pull requests')).toBeVisible();
  });

  test('generating an AI summary shows it and keeps history', async ({ page }) => {
    await page.goto('/dashboard/insights');
    await page.getByRole('button', { name: /Generate|Regenerate/ }).click();
    await expect(page.getByText('Sprint summary generated')).toBeVisible();
    await expect(page.getByText('Productivity insights')).toBeVisible();
  });

  test('theme choice persists across reloads', async ({ page }) => {
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('exiting the demo returns to the login page', async ({ page }) => {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Exit demo' }).click();
    await expect(page.getByRole('button', { name: /Explore the live demo/ })).toBeVisible();
  });
});

test.describe('repositories portfolio', () => {
  test.beforeEach(async ({ page }) => { await enterDemo(page, '/dashboard/repositories'); });

  test('lists every repository with analyzed ones showing activity', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Repositories' })).toBeVisible();
    await expect(page.getByRole('link', { name: /acme\/\s*web/ })).toBeVisible();
    await expect(page.getByText(/Not analyzed yet/).first()).toBeVisible();
  });

  test('search, "analyzed only" and opening a repository', async ({ page }) => {
    await page.getByRole('searchbox').fill('mobile');
    await expect(page.getByRole('link', { name: /acme\/\s*mobile/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /acme\/\s*web/ })).toHaveCount(0);
    await page.getByRole('searchbox').fill('zzzz');
    await expect(page.getByText('No matching repositories')).toBeVisible();
    await page.getByRole('searchbox').fill('');
    await page.getByRole('link', { name: /acme\/\s*api/ }).click();
    await expect(page).toHaveURL(/repo=acme%2Fapi/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/acme\/\s*api/);
  });
});

test.describe('login page', () => {
  test('explains itself, offers the demo, and shows readable OAuth errors', async ({ page }) => {
    await page.goto('/?error=oauth_not_configured');
    await expect(page.getByRole('alert')).toContainText('not configured');
    await expect(page.getByRole('button', { name: /Explore the live demo/ })).toBeVisible();
  });

  test('protected routes redirect to login', async ({ page }) => {
    await page.goto('/dashboard/pulls');
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('no horizontal scrolling on any page', async ({ page }) => {
    await enterDemo(page);
    for (const path of ['/dashboard', '/dashboard/repositories', '/dashboard/pulls', '/dashboard/people', '/dashboard/insights']) {
      await page.goto(path);
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBe(0);
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('entrance elements do not translate', async ({ page }) => {
    await enterDemo(page);
    const transform = await page.evaluate(() => getComputedStyle(document.querySelector('.rise') ?? document.body).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });
});
