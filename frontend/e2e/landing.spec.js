import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { revealEverything, trackErrors } from './helpers.js';

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

test.describe('landing page', () => {
  let errors;
  test.beforeEach(async ({ page }) => {
    errors = trackErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('actually ships.');
  });
  test.afterEach(() => { expect(errors, 'no console or page errors').toEqual([]); });

  test('the headline arrives line by line, in two tones, with no gradient text', async ({ page }) => {
    const lines = page.locator('h1 .hero-line');
    expect(await lines.count()).toBe(2);
    await expect(lines.last()).toHaveCSS('opacity', '1');
    const [first, second] = await lines.evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
    expect(second).not.toBe(first); // second line is the muted tone
    expect(await page.locator('h1').evaluate((h) => getComputedStyle(h.querySelector('.hero-line')).backgroundClip)).not.toBe('text');
    await expect(page.getByRole('button', { name: /Explore the live demo/ }).first()).toBeEnabled();
  });

  test('headline typography is tuned: tight tracking, balanced wrapping', async ({ page }) => {
    const style = await page.locator('h1').evaluate((h) => {
      const cs = getComputedStyle(h);
      return { spacing: parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize), wrap: cs.textWrap, size: parseFloat(cs.fontSize) };
    });
    expect(style.spacing).toBeLessThan(-0.03);
    expect(style.wrap).toContain('balance');
    expect(style.size).toBeGreaterThan(40);
  });

  test('product imagery loads and follows the theme', async ({ page }) => {
    const hero = page.locator('img[src*="/landing/hero-"]');
    await expect(hero).toHaveAttribute('src', /hero-dark\.webp/);
    await expect.poll(() => hero.evaluate((i) => i.complete && i.naturalWidth)).toBeGreaterThan(1000);
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(hero).toHaveAttribute('src', /hero-light\.webp/);
  });

  test('floating cards drift on their own and react to the pointer', async ({ page }) => {
    const float = page.locator('.float').first();
    await expect(float).toHaveCSS('animation-name', 'float');
    const chip = page.locator('div.pointer-events-none.absolute:has(.chip)').first();
    await page.mouse.move(100, 500);
    await page.mouse.move(1180, 640, { steps: 12 });
    await expect.poll(() => chip.evaluate((el) => el.style.transform)).toMatch(/translate3d/);
    const before = await chip.evaluate((el) => el.style.transform);
    await page.mouse.move(150, 300, { steps: 12 });
    await expect.poll(() => chip.evaluate((el) => el.style.transform)).not.toBe(before);
  });

  test('sections reveal as they scroll into view, exactly once', async ({ page }) => {
    const title = page.locator('#features-title');
    const heading = title.locator('xpath=ancestor::*[@data-reveal][1]');
    await expect(heading).toHaveAttribute('data-in', 'false');
    await title.scrollIntoViewIfNeeded();
    await expect(heading).toHaveAttribute('data-in', 'true');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await expect(heading).toHaveAttribute('data-in', 'true'); // does not re-hide
  });

  test('stats count up when scrolled into view', async ({ page }) => {
    const stats = page.getByLabel('DevPulse in numbers');
    await stats.scrollIntoViewIfNeeded();
    // The visible digits roll up from zero and are aria-hidden; assistive tech gets the settled value as text.
    await expect(stats.locator('dd .sr-only').first()).toHaveText('180');
    await expect(stats.locator('number-flow-react').first()).toHaveAttribute('aria-hidden', 'true');
  });

  test('navigation links scroll to their sections', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Page sections' }).getByRole('link', { name: 'FAQ' }).click();
    await expect(page.locator('#faq')).toBeInViewport();
  });

  test('the product tour switches pages and keeps scrolling the screenshot', async ({ page }) => {
    await page.locator('#tour').scrollIntoViewIfNeeded();
    const img = page.locator('#tour img.scroll-shot');
    await expect(img).toHaveAttribute('src', /overview-dark\.webp/);
    await expect.poll(() => img.getAttribute('data-run')).toBe('true'); // tall screenshot => it auto-scrolls
    await page.getByRole('tab', { name: 'Pull requests' }).click();
    await expect(page.locator('#tour img.scroll-shot')).toHaveAttribute('src', /pulls-dark\.webp/);
    await expect(page.getByText('Find what is stuck')).toBeVisible();
    await expect(page.locator('#tour').getByText('devpulse.app/dashboard/pulls')).toBeVisible();
  });

  test('the AI summary writes itself in once it is visible', async ({ page }) => {
    const card = page.locator('#ai [aria-label="Example AI sprint summary"]');
    const word = card.locator('.ai-word').first();
    await expect(word).toHaveCSS('opacity', '0');
    await card.scrollIntoViewIfNeeded();
    await expect(word).toHaveCSS('opacity', '1');
    await expect(card.locator('.ai-word').last()).toHaveCSS('opacity', '1', { timeout: 8000 });
  });

  test('FAQ accordion opens and closes', async ({ page }) => {
    const q = page.getByRole('button', { name: 'Does DevPulse read my code?' });
    await q.scrollIntoViewIfNeeded();
    await expect(page.getByText(/Source code is never requested/)).toBeHidden();
    await q.click();
    await expect(page.getByText(/Source code is never requested/)).toBeVisible();
    await q.click();
    await expect(page.getByText(/Source code is never requested/)).toBeHidden();
  });

  test('the header call to action starts the demo', async ({ page }) => {
    await page.getByRole('banner').getByRole('button', { name: 'Live demo' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('the final call to action starts the demo too', async ({ page }) => {
    await revealEverything(page);
    await page.locator('#cta-title').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Explore the live demo/ }).last().click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('landing page: reduced motion', () => {
  test('nothing floats, drifts, scrolls or scrolls smoothly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // (the `reducedMotion` use-option does not apply here)
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await expect(page.locator('.float').first()).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.hero-line').first()).toHaveCSS('transform', 'none');
    await expect(page.locator('.marquee-track')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.aurora span').first()).toHaveCSS('animation-name', 'none');
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
    await page.locator('#tour').scrollIntoViewIfNeeded();
    await expect(page.locator('#tour img.scroll-shot')).toHaveCSS('animation-name', 'none');
    const chip = page.locator('div.pointer-events-none.absolute:has(.chip)').first();
    await page.mouse.move(100, 500);
    await page.mouse.move(1100, 600, { steps: 8 });
    await page.waitForTimeout(400);
    expect(await chip.evaluate((el) => el.style.transform)).toBe(''); // no parallax
    await expect(page.locator('.hero-line').first()).toHaveCSS('animation-name', 'fade-only'); // gentler, not absent
  });
});

test.describe('landing page: mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('fits the screen, with no horizontal scrolling', async ({ page }) => {
    await page.goto('/');
    await revealEverything(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBe(0);
    await expect(page.getByRole('button', { name: /Explore the live demo/ }).first()).toBeVisible();
  });

  test('has no accessibility violations on a phone', async ({ page }) => {
    await page.goto('/');
    await revealEverything(page);
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' => ' + (n.any[0]?.message ?? '')).join(' | ')}`)).toEqual([]);
  });
});
