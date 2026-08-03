// tests/e2e/load-dialog.spec.ts
import { expect, test } from '@playwright/test';
import { E2E_SHEET_ID, fixture, SHEET_CSV_URL } from './helpers';

test('E2E-45: first visit — dialog over empty canvas; demo link works (UC-53, UC-54)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('load-dialog')).toBeVisible();
  await expect(page.getByTestId('link-input')).toBeFocused();
  await expect(page.getByTestId('saved-families')).toHaveCount(0); // empty registry → no section
  await expect(page.locator('.person-card')).toHaveCount(0);

  await page.getByRole('link', { name: /demo family/i }).click();
  await expect(page).toHaveURL(/\?family=demo/);
  await expect(page.getByRole('heading', { name: 'Demo Family' })).toBeVisible();
  await expect(page.locator('.person-card')).toHaveCount(10);
});

test('E2E-46: paste published URL + name → canonical ?sheet= URL, tree renders (UC-55, UC-59)', async ({ page }) => {
  await page.route('https://docs.google.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/csv', body: fixture('standard.csv') }));

  await page.goto('/');
  await page.getByTestId('link-input').fill(SHEET_CSV_URL);
  await page.getByTestId('name-input').fill('Alpha Family');
  await page.getByRole('button', { name: /view the tree/i }).click();

  await expect(page).toHaveURL(`/?sheet=${E2E_SHEET_ID}&name=Alpha+Family`);
  await expect(page.getByRole('heading', { name: 'Alpha Family' })).toBeVisible();
  await expect(page.locator('.person-card').first()).toBeVisible();
});

test('E2E-47: edit-mode URL → inline validation, no navigation (UC-60)', async ({ page }) => {
  await page.goto('/');
  const before = page.url();
  await page.getByTestId('link-input').fill('https://docs.google.com/spreadsheets/d/abc123/edit#gid=0');
  await page.getByRole('button', { name: /view the tree/i }).click();

  await expect(page.getByTestId('link-input-error')).toContainText(/publish to web/i);
  await expect(page.getByTestId('load-dialog')).toBeVisible();
  expect(page.url()).toBe(before);
  await expect(page.getByTestId('error-panel')).toHaveCount(0);
});
