import { expect } from '@playwright/test';

/** Signs into the shared demo workspace and waits for the dashboard to be fully drawn. */
export async function enterDemo(page, path = '/') {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore the live demo/ }).first().click();
  await ready(page);
  if (path !== '/') {
    await page.goto(path);
    await ready(page);
  }
}

/** The page has a title and nothing is still loading (skeletons carry aria-busy). */
export async function ready(page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Collects anything the browser would show in its console as an error. */
export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_CERT|ERR_NAME|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Scrolls the whole page slowly so every scroll-triggered reveal has fired, then returns to the top. */
export async function revealEverything(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 450) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y); // the page smooth-scrolls by default
    await page.waitForTimeout(140);
  }
  // The AI summary writes itself word by word; wait for the last word so scans never catch it mid-fade.
  const lastWord = page.locator('.ai-word').last();
  if (await lastWord.count()) {
    await lastWord.scrollIntoViewIfNeeded();
    await expect(lastWord).toHaveCSS('opacity', '1', { timeout: 10_000 });
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);
}
