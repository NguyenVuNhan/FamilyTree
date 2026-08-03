import { expect, test } from '@playwright/test';
import { card, gotoSrc, serveCsv } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.route('https://img.example/**', (r) => r.abort());
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await gotoSrc(page);
  await expect(card(page, 'r2')).toBeVisible();
});

test('E2E-32: settings change layout live and persist across reload', async ({ page }) => {
  const before = await card(page, 'r2').boundingBox();
  await page.getByRole('button', { name: 'Layout settings' }).click();
  const panel = page.getByTestId('settings-panel');
  await panel.getByRole('button', { name: 'Circle' }).click();
  await expect(page.locator('.person-card.style-circle').first()).toBeVisible();
  await panel.getByRole('slider', { name: 'Generation gap' }).fill('180');
  const after = await card(page, 'r2').boundingBox();
  expect(after!.width).not.toBe(before!.width); // circle slot is narrower

  await page.reload();
  await expect(card(page, 'r2')).toBeVisible();
  await expect(page.locator('.person-card.style-circle').first()).toBeVisible(); // persisted
});

test('E2E-33: reset restores the default layout', async ({ page }) => {
  await page.getByRole('button', { name: 'Layout settings' }).click();
  const panel = page.getByTestId('settings-panel');
  await panel.getByRole('button', { name: 'Arch' }).click();
  await panel.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.locator('.person-card.style-classic').first()).toBeVisible();
  await expect(page.locator('.person-card.style-archCard')).toHaveCount(0);
});
