import { expect, test, devices } from '@playwright/test';
import { card, serveCsv } from './helpers';

test('E2E-10: keyboard-only walkthrough (UC-11)', async ({ page }) => {
  await page.route('https://img.example/**', (r) => r.abort()); // avatar fallback path is fine
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await page.goto('/?family=alpha');
  await expect(card(page, 'margaret')).toBeVisible();

  // Tab until a person card is focused, then Enter expands, Esc collapses
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.classList.contains('person-card'))) break;
  }
  const focusedOutline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return getComputedStyle(el).outlineStyle;
  });
  expect(focusedOutline).not.toBe('none'); // visible focus ring
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-expanded="true"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-expanded="true"]')).toHaveCount(0);

  // toolbar toggle operable by keyboard
  await page.getByRole('button', { name: 'Name' }).focus();
  await page.keyboard.press('Enter');
  await expect(card(page, 'robert').getByText('Robert Ellis')).toBeVisible();
});

test.describe('E2E-11: mobile viewport (UC-12) — pinch stays manual', () => {
  // Spread the iPhone 12 device descriptor minus defaultBrowserType: this project only
  // runs chromium, and test.use() can't switch browser type inside a describe group.
  const iPhone12: Record<string, unknown> = { ...devices['iPhone 12'] };
  delete iPhone12.defaultBrowserType;
  test.use({ ...iPhone12, hasTouch: true });
  test('tap expands, one-finger pan moves canvas, toolbar visible', async ({ page }) => {
    await page.route('https://img.example/**', (r) => r.abort()); // avatar fallback path is fine
    await serveCsv(page, { fixtureName: 'standard.csv' });
    await page.goto('/?family=alpha');
    await expect(page.locator('.toolbar')).toBeVisible();
    await card(page, 'robert').tap();
    await expect(card(page, 'robert')).toHaveAttribute('data-expanded', 'true');
    const before = await page.getByTestId('viewport-transform').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e);
    const vp = (await page.getByTestId('viewport').boundingBox())!;
    await page.touchscreen.tap(vp.x + 10, vp.y + 10); // background tap collapses
    // one-finger pan via touch drag
    await page.locator('[data-testid="viewport"]').dispatchEvent('pointerdown', { clientX: vp.x + 50, clientY: vp.y + 300, pointerId: 9, button: 0 });
    await page.locator('[data-testid="viewport"]').dispatchEvent('pointermove', { clientX: vp.x + 150, clientY: vp.y + 300, pointerId: 9 });
    await page.locator('[data-testid="viewport"]').dispatchEvent('pointerup', { clientX: vp.x + 150, clientY: vp.y + 300, pointerId: 9 });
    // pan doesn't flushSync (unlike the toolbar zoom buttons), so poll rather than reading once
    const readE = () => page.getByTestId('viewport-transform').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e);
    await expect.poll(readE).toBeCloseTo(before + 100, 0);
  });
});
