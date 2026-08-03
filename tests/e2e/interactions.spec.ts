import { expect, test } from '@playwright/test';
import { card, gotoSrc, scaleOf, serveCsv, translateOf } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.route('https://img.example/**', (r) => r.abort()); // avatar fallback path is fine
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await gotoSrc(page);
  await expect(card(page, 'r2')).toBeVisible();
});

test('E2E-02: drag pans, wheel zooms toward cursor, % updates (UC-2)', async ({ page }) => {
  const before = await translateOf(page);
  const vp = page.getByTestId('viewport');
  const box = (await vp.boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 350);
  await page.mouse.up();
  const after = await translateOf(page);
  expect(after.x - before.x).toBeCloseTo(200, 0);
  expect(after.y - before.y).toBeCloseTo(50, 0);

  // Fit-to-view may already clamp the initial scale below 100% depending on
  // viewport size, so compare against the actual pre-wheel scale rather than
  // a hardcoded 1.0. onWheel doesn't flushSync, so poll instead of a single read.
  const beforeScale = await scaleOf(page);
  const beforePct = await page.getByTestId('zoom-pct').textContent();
  await page.mouse.wheel(0, -240);
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(beforeScale * 1.01);
  await expect(page.getByTestId('zoom-pct')).not.toHaveText(beforePct!);
});

test('E2E-03: zoom clamps at 0.4x/2.5x (UC-2)', async ({ page }) => {
  for (let i = 0; i < 20; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
  expect(await scaleOf(page)).toBeLessThanOrEqual(2.5);
  for (let i = 0; i < 40; i++) await page.getByRole('button', { name: 'Zoom out' }).click();
  expect(await scaleOf(page)).toBeGreaterThanOrEqual(0.4);
});

test('E2E-04: fit-to-view recovers after panning away (UC-3)', async ({ page }) => {
  const home = await translateOf(page);
  const vp = page.getByTestId('viewport');
  const box = (await vp.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 900, box.y + 700);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Fit to view' }).click();
  const back = await translateOf(page);
  expect(back.x).toBeCloseTo(home.x, 0);
  expect(back.y).toBeCloseTo(home.y, 0);
});

test('E2E-05: Show mode switches collapsed cards (UC-5)', async ({ page }) => {
  // default avatar mode: avatar visible, name text hidden
  await expect(card(page, 'r2p').getByText('Robert Ellis')).toHaveCount(0);
  await page.getByRole('button', { name: 'Layout settings' }).click();
  await page.getByTestId('settings-panel').getByRole('button', { name: 'Name', exact: true }).click();
  await page.keyboard.press('Escape'); // close the panel so it doesn't cover cards
  await expect(card(page, 'r2p').getByText('Robert Ellis')).toBeVisible();
  await expect(card(page, 'r2p').getByRole('img')).toHaveCount(0);
});

test('E2E-06: expand/collapse via every path; never two expanded (UC-6)', async ({ page }) => {
  await card(page, 'r2p').click();
  await expect(card(page, 'r2p')).toHaveAttribute('data-expanded', 'true');
  await expect(card(page, 'r2p').getByText('Robert Ellis')).toBeVisible(); // photo mode + expanded → both
  await card(page, 'r2p').click();
  await expect(card(page, 'r2p')).toHaveAttribute('data-expanded', 'false');
  await card(page, 'r2p').click();
  await card(page, 'r6').click();
  await expect(page.locator('[data-expanded="true"]')).toHaveCount(1);
  await expect(card(page, 'r6')).toHaveAttribute('data-expanded', 'true');
  await page.getByTestId('viewport').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('[data-expanded="true"]')).toHaveCount(0);
});

test('E2E-07: expanded card keeps both across mode toggle (UC-7, UC-8)', async ({ page }) => {
  // Close the panel via the gear toggle (not Escape) so the expanded card isn't collapsed.
  const gear = page.getByRole('button', { name: 'Layout settings' });
  const panel = page.getByTestId('settings-panel');
  await gear.click();
  await panel.getByRole('button', { name: 'Name', exact: true }).click();
  await gear.click();
  await card(page, 'r2p').click();
  await expect(card(page, 'r2p').getByRole('img')).toBeVisible();
  await gear.click();
  await panel.getByRole('button', { name: 'Avatar', exact: true }).click();
  await gear.click();
  await expect(card(page, 'r2p')).toHaveAttribute('data-expanded', 'true');
  await expect(card(page, 'r2p').getByText('Robert Ellis')).toBeVisible();
});

test('E2E-08: expansion survives pan and zoom (UC-9)', async ({ page }) => {
  await card(page, 'r2p').click();
  const vp = page.getByTestId('viewport');
  const box = (await vp.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 400);
  await page.mouse.up();
  await page.mouse.wheel(0, -120);
  await expect(card(page, 'r2p')).toHaveAttribute('data-expanded', 'true');
});

test('E2E-09: a drag ending on a card does NOT expand it (UC-10)', async ({ page }) => {
  const target = (await card(page, 'r3').boundingBox())!;
  await page.mouse.move(target.x - 60, target.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('[data-expanded="true"]')).toHaveCount(0);
});
