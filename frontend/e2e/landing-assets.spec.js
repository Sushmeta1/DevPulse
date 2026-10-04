import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { enterDemo } from './helpers.js';

// Captures the product screenshots used on the landing page: `npm run landing:assets`.
// Output goes to LANDING_TMP as PNG; scripts/landing-assets.sh turns them into optimised WebP in public/landing.
const OUT = process.env.LANDING_TMP;
test.skip(!OUT, 'run through npm run landing:assets');

const WARM = ['acme/api', 'acme/mobile', 'acme/design-system', 'acme/monorepo', 'acme/platform-infrastructure-consolidation-initiative-2025-q3'];
const shots = [
  ['overview', '/dashboard?repo=acme/web&range=30'],
  ['reviews', '/dashboard/reviews?repo=acme/web&range=30'],
  ['team', '/dashboard/team?repos=acme/web,acme/api,acme/mobile,acme/design-system&range=30'],
  ['digest', '/dashboard/digest'],
  ['repositories', '/dashboard/repositories'],
  ['pulls', '/dashboard/pulls?repo=acme/api&range=30'],
  ['people', '/dashboard/people?repo=acme/web&range=30&who=maya-chen'],
  ['insights', '/dashboard/insights?repo=acme/web&range=30'],
];

for (const scheme of ['dark', 'light']) {
  test(`landing assets (${scheme})`, async ({ browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
    const page = await context.newPage();
    // Marketing shots shouldn't show the demo notice; navigations are full reloads, so re-apply after each.
    const hideDemoNotice = () => page.addStyleTag({ content: '[data-demo-banner]{display:none!important}' });
    await enterDemo(page);
    // Analyse a handful of repositories so the portfolio page has real sparklines.
    for (const repo of WARM) {
      await page.goto(`/dashboard?repo=${encodeURIComponent(repo)}&range=30`);
      await page.waitForSelector('[aria-busy="true"]', { state: 'detached' });
      await page.waitForTimeout(250);
    }
    for (const [name, url] of shots) {
      await page.goto(url);
      await page.waitForSelector('[aria-busy="true"]', { state: 'detached' });
      await hideDemoNotice();
      if (name === 'insights') {
        await page.getByRole('button', { name: /Generate|Regenerate/ }).click();
        await page.getByText('Productivity insights').waitFor();
      }
      await page.waitForTimeout(1800); // entrance animations settled
      await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`), fullPage: true });
    }
    await context.close();
  });
}
