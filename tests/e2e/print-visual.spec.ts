import { expect, test } from '@playwright/test';
import { serveCsv } from './helpers';

test('E2E-28: print media hides chrome, resets transform (UC-4)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await page.goto('/?family=alpha');
  await expect(page.locator('.person-card').first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('.tree-canvas')).toBeVisible();
  const connectorStroke = await page.locator('.connector').first().evaluate((el) => getComputedStyle(el).stroke);
  expect(connectorStroke).toBe('rgb(107, 114, 128)'); // #6b7280 ink-contrast
  const cardBorder = await page.locator('.person-card').first().evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(cardBorder).toBe('rgb(107, 114, 128)'); // #6b7280 — cards must not blend into white paper (issue #3)
});

test('E2E-29: visual regression at fit-to-view (UC-1) — local guard, CI ignores snapshots', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await page.route('https://img.example/**', (r) => r.abort());
  await page.goto('/?family=alpha');
  await expect(page.locator('.person-card')).toHaveCount(7);
  await expect(page).toHaveScreenshot('tree-standard.png', { maxDiffPixelRatio: 0.02 });
});
