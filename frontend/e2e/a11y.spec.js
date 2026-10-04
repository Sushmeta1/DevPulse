import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { enterDemo, revealEverything } from './helpers.js';

// WCAG 2.1 A/AA, every page, both themes. Contrast regressions are the usual casualty of palette tweaks.
for (const scheme of ['light', 'dark']) {
  test.describe(`accessibility (${scheme})`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });

    const scan = async (page) => {
      await page.waitForTimeout(1000); // let entrance animations finish so colours are final
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' => ' + (n.any[0]?.message ?? '')).join(' | ')}`)).toEqual([]);
    };

    test('landing page', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /Explore the live demo/ }).first()).toBeVisible();
      await revealEverything(page); // content below the fold is opacity 0 until it has scrolled into view
      await scan(page);
    });

    for (const [name, path] of [
      ['overview', '/dashboard'], ['repositories', '/dashboard/repositories'], ['pull requests', '/dashboard/pulls'],
      ['contributors', '/dashboard/people'], ['insights', '/dashboard/insights'],
    ]) {
      test(name, async ({ page }) => {
        await enterDemo(page, path);
        await scan(page);
      });
    }

    test('command menu', async ({ page }) => {
      await enterDemo(page);
      await page.waitForTimeout(400); // let the app finish mounting its keyboard handler
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('dialog')).toBeVisible();
      await scan(page);
    });
  });
}
