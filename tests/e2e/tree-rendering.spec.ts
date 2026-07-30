import { expect, test } from '@playwright/test';
import { serveCsv, card } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.route('https://img.example/**', (r) => r.abort()); // avatar fallback path is fine
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await page.goto('/?family=alpha');
});

test('E2E-01: standard fixture renders everyone, connectors, centered (UC-1, UC-18)', async ({ page }) => {
  for (const name of ['Margaret Ellis', 'Robert Ellis', 'David Ellis', 'Sarah Park', 'Linda Ellis', 'Emma Ellis', 'Noah Ellis']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  // unions: margaret+robert (marriage + 2 child drops: david, linda),
  // david+sarah (marriage + 2 child drops: emma, noah) = 6 paths (verified against layout-engine.ts,
  // which emits one marriage line per 2-partner union plus one elbow drop per direct child)
  await expect(page.getByTestId('connector-layer').locator('path')).toHaveCount(6);
  // married child (david+sarah couple) and single child (linda) share generation row
  const davidBox = (await card(page, 'r3').boundingBox())!;
  const lindaBox = (await card(page, 'r6').boundingBox())!;
  expect(Math.abs(davidBox.y - lindaBox.y)).toBeLessThan(2);
  // tree is fitted inside the viewport
  const vp = (await page.getByTestId('viewport').boundingBox())!;
  const canvas = (await page.locator('.tree-canvas').boundingBox())!;
  expect(canvas.x).toBeGreaterThanOrEqual(vp.x - 1);
  expect(canvas.x + canvas.width).toBeLessThanOrEqual(vp.x + vp.width + 1);
});
