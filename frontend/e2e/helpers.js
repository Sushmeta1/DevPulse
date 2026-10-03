import { expect } from '@playwright/test';

/** Signs into the shared demo workspace and waits for the dashboard to be fully drawn. */
export async function enterDemo(page, path = '/') {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore the live demo/ }).click();
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
