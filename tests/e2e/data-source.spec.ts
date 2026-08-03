import { expect, test } from '@playwright/test';
import { gotoSrc, serveCsv } from './helpers';

test('E2E-26: image URL 404 → initials fallback (UC-30)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'images-mixed.csv' });
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 404 }));
  await gotoSrc(page);
  await expect(page.locator('[data-person-id="r2"]').getByText('UP')).toBeVisible();
});

test('E2E-27: data URI, raw base64, blank → correct rendering; stable distinct hues (UC-25, UC-31–33)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'images-mixed.csv' });
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }));
  await gotoSrc(page);
  await expect(page.locator('[data-person-id="r2p"] img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(page.locator('[data-person-id="r3"] img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  const bg = (id: string) =>
    page.locator(`[data-person-id="${id}"] [role="img"]`).evaluate((el) => getComputedStyle(el).backgroundImage);
  const b1 = await bg('r4');
  const b2 = await bg('r5');
  expect(b1).not.toBe(b2);              // distinct hues
  await page.reload();
  expect(await bg('r4')).toBe(b1);   // stable across reloads
});
