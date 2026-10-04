import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { enterDemo, revealEverything } from './helpers.js';

// Regenerates docs/screenshots (used in the README and the project synopsis): `npm run screenshots`.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots');
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 (npm run screenshots) to regenerate');

const shots = [
  ['overview', '/dashboard?repo=acme/web&range=30', true],
  ['repositories', '/dashboard/repositories', false],
  ['reviews', '/dashboard/reviews?repo=acme/web&range=30', false],
  ['team', '/dashboard/team?repos=acme/web,acme/api,acme/mobile,acme/design-system&range=30', false],
  ['digest', '/dashboard/digest', false],
  ['pull-requests', '/dashboard/pulls?repo=acme/api&range=30', false],
  ['contributors', '/dashboard/people?repo=acme/web&range=30&who=maya-chen', false],
  ['insights', '/dashboard/insights?repo=acme/web&range=30', false],
];

// The marketing landing page (signed out): hero, then a scrolled-down tour/AI section, then a phone.
test('landing page screenshots', async ({ browser }) => {
  for (const scheme of ['dark', 'light']) {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForTimeout(2800); // headline, chips and parallax settled
    await page.screenshot({ path: path.join(OUT, `landing-hero-${scheme}.png`) });
    if (scheme === 'dark') {
      await revealEverything(page);
      await page.locator('#tour').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, 'landing-tour-dark.png') });
      await page.locator('#ai').scrollIntoViewIfNeeded();
      await page.waitForTimeout(5200); // the summary finishes writing itself
      await page.screenshot({ path: path.join(OUT, 'landing-ai-dark.png') });
    }
    await context.close();
  }
  const phone = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await phone.newPage();
  await p.goto('/');
  await p.waitForTimeout(2800);
  await p.screenshot({ path: path.join(OUT, 'landing-mobile-dark.png') });
  await phone.close();
});

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
