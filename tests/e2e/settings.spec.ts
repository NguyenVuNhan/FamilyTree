import { expect, test } from '@playwright/test';
import { ALPHA_URL, card, gotoSrc, serveCsv } from './helpers';

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
  expect(after!.height).toBeLessThan(before!.height); // circle-full (~106) is shorter than arch-full (~180)

  await page.reload();
  await expect(card(page, 'r2')).toBeVisible();
  await expect(page.locator('.person-card.style-circle').first()).toBeVisible(); // persisted
});

test('E2E-33: reset restores the default layout', async ({ page }) => {
  await page.getByRole('button', { name: 'Layout settings' }).click();
  const panel = page.getByTestId('settings-panel');
  await panel.getByRole('button', { name: 'Classic' }).click();
  await panel.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.locator('.person-card.style-archCard').first()).toBeVisible();
  await expect(page.locator('.person-card.style-classic')).toHaveCount(0);
});

test('E2E-54: a fresh visitor sees the arch default — photo card, name underneath (UC-73)', async ({ page }) => {
  await expect(page.locator('.person-card.style-archCard')).toHaveCount(7);
  await expect(page.locator('.person-card.style-classic')).toHaveCount(0);
  const name = card(page, 'r2').locator('.person-name');
  await expect(name).toHaveText('Margaret Ellis');
  // Read both rects in one evaluate on the card element — two separate
  // boundingBox() round-trips can straddle a concurrent layout/scale change
  // under parallel-worker CPU contention (same flake class as E2E-61).
  const { nameY, imgY, imgHeight } = await card(page, 'r2').evaluate((cardEl) => {
    const nameEl = cardEl.querySelector('.person-name')!;
    const imgEl = cardEl.querySelector('img, .avatar-fallback')!;
    const nameRect = nameEl.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();
    return { nameY: nameRect.y, imgY: imgRect.y, imgHeight: imgRect.height };
  });
  expect(nameY).toBeGreaterThan(imgY + imgHeight / 2); // name sits below the photo
});

test('E2E-55: previously saved settings beat the new defaults (UC-74)', async ({ page }) => {
  await page.evaluate(
    ([key, val]) => localStorage.setItem(key, val),
    [`ft:layout:src:${ALPHA_URL}`, JSON.stringify({ cardStyle: 'circle', contentMode: 'avatar' })] as const,
  );
  await page.reload();
  await expect(page.locator('.person-card.style-circle').first()).toBeVisible();
  await expect(page.locator('.person-card.style-archCard')).toHaveCount(0);
  await expect(page.locator('.person-name')).toHaveCount(0); // avatar mode
});
