import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { enterDemo } from './helpers.js';

// Regenerates docs/screenshots (used in the README and the project synopsis): `npm run screenshots`.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots');
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 (npm run screenshots) to regenerate');

const shots = [
  ['overview', '/dashboard?repo=acme/web&range=30', true],
  ['repositories', '/dashboard/repositories', false],
  ['pull-requests', '/dashboard/pulls?repo=acme/api&range=30', false],
  ['contributors', '/dashboard/people?repo=acme/web&range=30&who=maya-chen', false],
  ['insights', '/dashboard/insights?repo=acme/web&range=30', false],
];

for (const scheme of ['dark', 'light']) {
  test(`screenshots (${scheme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await enterDemo(page);
    for (const [name, url, full] of shots) {
      if (scheme === 'light' && name !== 'overview') continue;
      await page.goto(url);
      await page.waitForTimeout(1600);
      if (name === 'insights') {
        await page.getByRole('button', { name: /Generate|Regenerate/ }).click();
        await page.waitForTimeout(1200);
      }
      await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`), fullPage: full });
    }
    if (scheme === 'dark') {
      await page.goto('/dashboard?repo=acme/web&range=30');
      await page.waitForTimeout(800);
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'command-menu-dark.png') });
    }
    await context.close();
    const phone = await browser.newContext({ colorScheme: scheme, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    if (scheme === 'dark') {
      const p = await phone.newPage();
      await enterDemo(p);
      await p.goto('/dashboard?repo=acme/web&range=30');
      await p.waitForTimeout(1600);
      await p.screenshot({ path: path.join(OUT, 'overview-mobile-dark.png'), fullPage: false });
    }
    await phone.close();
  });
}
