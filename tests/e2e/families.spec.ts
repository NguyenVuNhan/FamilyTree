import { expect, test } from '@playwright/test';
import { BRAVO_URL, serveCsv } from './helpers';

test('E2E-30: ?family switches tree, display name, title; no param → default (UC-34, UC-35)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });                    // alpha
  await serveCsv(page, { url: BRAVO_URL, fixtureName: 'bravo.csv' });       // bravo
  await page.goto('/?family=bravo');
  await expect(page.getByRole('heading', { name: 'Bravo Family' })).toBeVisible();
  await expect(page).toHaveTitle('Bravo Family — Family Tree');
  await expect(page.getByRole('button', { name: 'Bravo Boss' })).toBeVisible();

  await page.goto('/?family=BrAvO'); // case-insensitive
  await expect(page.getByRole('heading', { name: 'Bravo Family' })).toBeVisible();

  await page.goto('/'); // no param → alpha (alphabetically first configured)
  await expect(page.getByRole('heading', { name: 'Alpha Family' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Margaret Ellis' })).toBeVisible();
});

test('E2E-31: unknown family → not-found, no crash, no name enumeration (UC-36)', async ({ page }) => {
  await page.goto('/?family=nonexistent');
  await expect(page.getByTestId('family-not-found')).toBeVisible();
  const text = await page.getByTestId('family-not-found').innerText();
  expect(text.toLowerCase()).not.toContain('alpha');
  expect(text.toLowerCase()).not.toContain('bravo');
  expect(text.toLowerCase()).not.toContain('demo');
});
