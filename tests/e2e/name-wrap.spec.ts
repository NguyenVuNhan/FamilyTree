// tests/e2e/name-wrap.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { gotoSrc, serveCsv } from './helpers';

const LONG_NAME = 'Nguyễn Hữu Thị Lan Nam Phương Hoàng Hậu';

test.beforeEach(async ({ page }) => {
  await page.route('https://img.example/**', (r) => r.abort()); // avatar fallback path is fine
  await serveCsv(page, { fixtureName: 'long-names.csv' });
  await gotoSrc(page);
  await expect(page.locator('.person-card').first()).toBeVisible();
});

async function expectNoClipping(page: Page) {
  const results = await page.locator('.person-name').evaluateAll((els) =>
    els.map((el) => ({
      clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      nowrap: getComputedStyle(el).whiteSpace === 'nowrap',
    })),
  );
  expect(results.length).toBeGreaterThan(0);
  for (const r of results) {
    expect(r.clipped).toBe(false);
    expect(r.nowrap).toBe(false);
  }
}

test('E2E-61: long names wrap fully visible with uniform card heights (UC-83, UC-85)', async ({ page }) => {
  await expect(page.getByText(LONG_NAME)).toBeVisible(); // the whole name, not an ellipsis
  await expectNoClipping(page);
  const longBox = (await page.getByText(LONG_NAME).boundingBox())!;
  const shortBox = (await page.getByText('Bảo Long').boundingBox())!;
  expect(longBox.height).toBeGreaterThanOrEqual(shortBox.height * 2); // wrapping actually happened
  const heights = await page.locator('.person-card').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height));
  for (const h of heights) expect(Math.abs(h - heights[0])).toBeLessThanOrEqual(1); // uniform, short names included
});

test('E2E-62: long names survive every card style (UC-84)', async ({ page }) => {
  await page.getByRole('button', { name: 'Layout settings' }).click();
  const panel = page.getByTestId('settings-panel');
  for (const style of ['Classic', 'Circle', 'Photo left', 'Arch']) {
    await panel.getByRole('button', { name: style, exact: true }).click();
    await expectNoClipping(page);
  }
});
