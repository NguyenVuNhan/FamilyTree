import { expect, test } from '@playwright/test';
import { FIXTURE_SERVER, gotoSrc, serveCsv, viewUrl } from './helpers';

const STANDARD = `${FIXTURE_SERVER}/standard.csv`;

test('E2E-28: print media hides chrome, resets transform (UC-4)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await gotoSrc(page);
  await expect(page.locator('.person-card').first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('.tree-canvas')).toBeVisible();
  const connectorStroke = await page.locator('.connector').first().evaluate((el) => getComputedStyle(el).stroke);
  expect(connectorStroke).toBe('rgb(107, 114, 128)'); // #6b7280 ink-contrast
  const cardBorder = await page.locator('.person-card').first().evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(cardBorder).toBe('rgb(107, 114, 128)'); // #6b7280 — cards must not blend into white paper (issue #3)
  const colorAdjust = await page.locator('.avatar-fallback').first().evaluate(
    (el) => getComputedStyle(el).getPropertyValue('-webkit-print-color-adjust'),
  );
  expect(colorAdjust).toBe('exact'); // gradient avatars must not print as black discs (issue #3)
});

test('E2E-29: visual regression at fit-to-view (UC-1) — local guard, CI ignores snapshots', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await page.route('https://img.example/**', (r) => r.abort());
  await gotoSrc(page);
  await expect(page.locator('.person-card')).toHaveCount(7);
  await expect(page).toHaveScreenshot('tree-standard.png', { maxDiffPixelRatio: 0.02 });
});

test('E2E-30: print visual regression (UC-4) — local guard, CI ignores snapshots', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await page.route('https://img.example/**', (r) => r.abort());
  await gotoSrc(page);
  await expect(page.locator('.person-card')).toHaveCount(7);
  await page.emulateMedia({ media: 'print' });
  await expect(page).toHaveScreenshot('tree-standard-print.png', { maxDiffPixelRatio: 0.02 });
});

test('E2E-75: print media renders the flow print-sheet at physical size (UC-83) — local guard, CI ignores snapshots', async ({ page }) => {
  await page.route('https://img.example/**', (r) => r.abort());
  await page.goto(viewUrl(STANDARD, 'arr:flow', 'Std'));
  await expect(page.locator('g.person-node').first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  // PrintSheet only (re)composes its markup on the real 'beforeprint' DOM event — which
  // page.emulateMedia() does NOT fire (it only flips the CSS media type used for style
  // matching, same as it does for E2E-28/29/30 above). Dispatch it explicitly so the
  // print-only sheet actually gets its <style id="print-page"> and <svg> before we
  // inspect them, mirroring what a real print/Ctrl+P would trigger.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));

  await expect(page.locator('.toolbar')).toBeHidden();
  const printPageCss = await page.evaluate(() => document.getElementById('print-page')?.textContent ?? '');
  expect(printPageCss).toContain('size: 1200mm 600mm'); // pano is the default format

  const colorAdjust = await page.locator('.print-sheet svg').evaluate(
    (el) => getComputedStyle(el).getPropertyValue('-webkit-print-color-adjust'),
  );
  expect(colorAdjust).toBe('exact');

  await expect(page).toHaveScreenshot('print-flow-sheet.png', { maxDiffPixelRatio: 0.02 });
});

const FLOW_THEMES = ['indochine', 'nordic', 'inkwash', 'botanical'] as const;
for (const theme of FLOW_THEMES) {
  test(`E2E-79: flow visual regression — ${theme} theme (UC-76) — local guard, CI ignores snapshots`, async ({ page }) => {
    await page.route('https://img.example/**', (r) => r.abort());
    await page.goto(viewUrl(STANDARD, `arr:flow,theme:${theme}`, 'Std'));
    await expect(page.locator('g.person-node').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`flow-${theme}.png`, { maxDiffPixelRatio: 0.02 });
  });
}
