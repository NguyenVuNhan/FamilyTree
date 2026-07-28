import { expect, test } from '@playwright/test';

// Post-deploy smoke suite (§15): runs against real hosting with the bundled
// demo family data. NO route interception — this is the live network path.

test('SMK-01: demo tree renders live; toggle and expand work (UC-38, UC-1, UC-5, UC-6)', async ({ page }) => {
  await page.goto('./?family=demo');
  await expect(page.getByRole('heading', { name: 'Demo Family' })).toBeVisible();
  await expect(page.locator('.person-card')).toHaveCount(10);
  expect(await page.getByTestId('connector-layer').locator('path').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Name' }).click();
  await expect(page.getByText('Margaret Ellis')).toBeVisible();
  await page.locator('[data-person-id="margaret"]').click();
  await expect(page.locator('[data-expanded="true"]')).toHaveCount(1);
});

test('SMK-02: pan and zoom respond on the live site (UC-38, UC-2)', async ({ page }) => {
  await page.goto('./?family=demo');
  await expect(page.locator('.person-card').first()).toBeVisible();
  const before = await page.getByTestId('viewport-transform').evaluate((el) => getComputedStyle(el).transform);
  const vp = (await page.getByTestId('viewport').boundingBox())!;
  await page.mouse.move(vp.x + 200, vp.y + 300);
  await page.mouse.down();
  await page.mouse.move(vp.x + 400, vp.y + 300);
  await page.mouse.up();
  // Pan is applied via a plain setView (no flushSync), so the transform may
  // not have committed yet when mouse.up() resolves — poll instead of a
  // single read (mirrors how interactions.spec.ts handles non-flushSync reads).
  await expect
    .poll(() => page.getByTestId('viewport-transform').evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(before);
  await page.getByRole('button', { name: 'Fit to view' }).click();
  await expect(page.getByTestId('viewport-transform')).toHaveCSS('transform', before);
});

test('SMK-03: print media hides chrome on the live site (UC-38, UC-4)', async ({ page }) => {
  await page.goto('./?family=demo');
  await expect(page.locator('.person-card').first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('.tree-canvas')).toBeVisible();
});

test('SMK-04: unknown family shows not-found on real hosting (UC-36, SPA base-path sanity)', async ({ page }) => {
  await page.goto('./?family=nonexistent');
  await expect(page.getByTestId('family-not-found')).toBeVisible();
});
