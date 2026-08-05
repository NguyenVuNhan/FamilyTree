import { expect, test } from '@playwright/test';
import { FIXTURE_SERVER, gotoSrc, serveCsv, viewUrl } from './helpers';

const STANDARD = `${FIXTURE_SERVER}/standard.csv`;
const TRIO = `${FIXTURE_SERVER}/stair-trio.csv`;

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

const PRINT_THEMES = ['indochine', 'nordic', 'inkwash', 'botanical'] as const;
for (const theme of PRINT_THEMES) {
  test(`E2E-79: flow visual regression — ${theme} theme (UC-76) — local guard, CI ignores snapshots`, async ({ page }) => {
    await page.route('https://img.example/**', (r) => r.abort());
    await page.goto(viewUrl(STANDARD, `arr:flow,theme:${theme}`, 'Std'));
    await expect(page.locator('g.person-node').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`flow-${theme}.png`, { maxDiffPixelRatio: 0.02 });
  });
}

for (const theme of PRINT_THEMES) {
  test(`E2E-84: fan visual regression — ${theme} theme (UC-76) — local guard, CI ignores snapshots`, async ({ page }) => {
    await page.route('https://img.example/**', (r) => r.abort());
    await page.goto(viewUrl(STANDARD, `arr:fan,theme:${theme}`, 'Std'));
    await expect(page.locator('g.person-node').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`fan-${theme}.png`, { maxDiffPixelRatio: 0.02 });
  });
}

test('E2E-88: triptych browser print is 3 sheet pages at @page 400×600 mm (UC-83, UC-85)', async ({ page }) => {
  await page.goto(viewUrl(TRIO, 'arr:panels,fmt:trip,mgn:50', 'Trio'));
  await expect(page.locator('g.print-panel')).toHaveCount(3);
  await page.emulateMedia({ media: 'print' });
  // Same as E2E-75: emulateMedia flips CSS matching but does NOT fire beforeprint —
  // dispatch it so PrintSheet composes its pages, mirroring a real Ctrl+P.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('.toolbar')).toBeHidden();
  const css = await page.evaluate(() => document.getElementById('print-page')?.textContent ?? '');
  expect(css).toContain('size: 400mm 600mm');
  await expect(page.locator('.print-sheet .print-sheet-page')).toHaveCount(3);
  // Page-count contract asserted via CSS semantics (computed break-after) rather than
  // parsing page.pdf() page objects, which is unreliable across Chromium versions
  // (compressed object streams) without a PDF library — see the PR ③ plan's D9. This
  // is a DOM/CSS-contract check only: it proves the print stylesheet WOULD force 3
  // separate physical sheets in a real printer/PDF pipeline, not that it counted 3
  // actual rendered pages (jsdom/Playwright have no page-layout engine to count
  // against). True page-count verification against a real print/PDF output is
  // deferred to the manual UI/UX gate.
  const breaks = await page.locator('.print-sheet-page').evaluateAll(
    (els) => els.map((el) => getComputedStyle(el).breakAfter),
  );
  // PrintSheet.tsx's rule is `.print-sheet-page:not(:last-child) { break-after: page; }`
  // (see commit 88f9d0a) — every page but the last forces a sheet break; the last page
  // is left at its default (no trailing blank page after the final panel). The brief's
  // literal ['page','page','page'] doesn't match this — corrected to reflect the actual
  // "all but last" contract.
  expect(breaks).toEqual(['page', 'page', 'auto']);
  const widths = await page.locator('.print-sheet-page svg').evaluateAll(
    (els) => els.map((el) => el.getAttribute('width')),
  );
  expect(widths).toEqual(['400mm', '400mm', '400mm']);
  const colorAdjust = await page.locator('.print-sheet svg').first().evaluate(
    (el) => getComputedStyle(el).getPropertyValue('-webkit-print-color-adjust'),
  );
  expect(colorAdjust).toBe('exact');
});

for (const theme of PRINT_THEMES) {
  test(`E2E-89: panels visual regression — ${theme} theme (UC-76) — local guard, CI ignores snapshots`, async ({ page }) => {
    await page.route('https://img.example/**', (r) => r.abort());
    await page.goto(viewUrl(TRIO, `arr:panels,theme:${theme}`, 'Trio'));
    await expect(page.locator('g.print-panel')).toHaveCount(3);
    await expect(page).toHaveScreenshot(`panels-${theme}.png`, { maxDiffPixelRatio: 0.02 });
  });
}
