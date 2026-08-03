// tests/e2e/families.spec.ts
import { expect, test } from '@playwright/test';
import { BRAVO_URL, gotoSrc, serveCsv } from './helpers';

test('E2E-53: navigating between sources switches tree, heading, and title (UC-71)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });                    // alpha
  await serveCsv(page, { url: BRAVO_URL, fixtureName: 'bravo.csv' });       // bravo

  await gotoSrc(page); // Alpha Family
  await expect(page.getByRole('heading', { name: 'Alpha Family' })).toBeVisible();
  await expect(page).toHaveTitle('Alpha Family — Family Tree');
  await expect(page.getByRole('button', { name: 'Margaret Ellis' })).toBeVisible();

  await gotoSrc(page, { url: BRAVO_URL, name: 'Bravo Family' });
  await expect(page.getByRole('heading', { name: 'Bravo Family' })).toBeVisible();
  await expect(page).toHaveTitle('Bravo Family — Family Tree');
  await expect(page.getByRole('button', { name: 'Bravo Boss' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Margaret Ellis' })).toHaveCount(0); // no stale cards
});
