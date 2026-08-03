// tests/e2e/saved-families.spec.ts
import { expect, type Page, test } from '@playwright/test';
import { ALPHA_URL, BRAVO_URL, gotoSrc, serveCsv, treeUrl } from './helpers';

const searchOf = (url: string, name: string) => `?${new URLSearchParams({ src: url, name })}`;
const keyOf = (url: string) => `?${new URLSearchParams({ src: url })}`;

/**
 * One-time localStorage seed — deliberately NOT helpers.ts's seedRegistry().
 *
 * seedRegistry() seeds via page.addInitScript, which Playwright re-runs on
 * EVERY subsequent navigation for the life of the page (confirmed against a
 * plain goto-to-a-different-url and a reload, not just app-specific
 * behavior). That silently clobbers whatever the app or test writes on any
 * navigation after the first, back to the original seed payload. E2E-49
 * needs the seed to survive a live upsert (loading Charlie), a trip back to
 * '/', a removal, and a reload — every one of those is a fresh navigation,
 * so seedRegistry() cannot be used here without losing Charlie or resurrecting
 * removed Bravo. A single evaluate() on an already-loaded page writes once
 * and is never reapplied, matching how a returning user's localStorage
 * actually behaves across navigation.
 */
async function seedRegistryOnce(page: Page, entries: Array<{ key: string; name: string; search: string; savedAt: number }>) {
  await page.goto('/');
  await page.evaluate((payload) => localStorage.setItem('ft:families:v1', payload), JSON.stringify(entries));
}

test('E2E-48: successful load saves; bare URL lists it; shortcut loads it (UC-62, UC-63)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await gotoSrc(page); // Alpha Family
  await expect(page.locator('.person-card').first()).toBeVisible();

  await page.goto('/');
  const saved = page.getByTestId('saved-families');
  await expect(saved).toContainText('Alpha Family');
  // Both the main button ("Alpha Family <subtitle>") and the "Remove Alpha Family" button
  // (name comes from an aria-label, not visible text, so hasNotText can't see it) match
  // /alpha family/i — disambiguate structurally: only the main button wraps a <strong>.
  await saved.getByRole('button', { name: /alpha family/i }).filter({ has: page.locator('strong') }).click();
  await expect(page.locator('.person-card').first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp('\\' + searchOf(ALPHA_URL, 'Alpha Family').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('E2E-49: newest-first ordering; removal persists across reload (UC-62, UC-64)', async ({ page }) => {
  await seedRegistryOnce(page, [
    { key: keyOf(ALPHA_URL), name: 'Alpha Family', search: searchOf(ALPHA_URL, 'Alpha Family'), savedAt: 1000 },
    { key: keyOf(BRAVO_URL), name: 'Bravo Family', search: searchOf(BRAVO_URL, 'Bravo Family'), savedAt: 2000 },
  ]);
  const charlieUrl = 'https://sheets.example/charlie.csv';
  await serveCsv(page, { url: charlieUrl, fixtureName: 'standard.csv' });
  await page.goto(treeUrl(charlieUrl, 'Charlie Family'));
  await expect(page.locator('.person-card').first()).toBeVisible();

  await page.goto('/');
  const items = page.getByTestId('saved-families').getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Charlie Family'); // newest first
  await expect(items.nth(1)).toContainText('Bravo Family');
  await expect(items.nth(2)).toContainText('Alpha Family');

  await page.getByRole('button', { name: 'Remove Bravo Family' }).click();
  await page.reload();
  await expect(page.getByTestId('saved-families').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByTestId('saved-families')).not.toContainText('Bravo Family');
});

test('E2E-50: failed load is not saved (UC-65)', async ({ page }) => {
  await page.route(ALPHA_URL, (r) => r.abort());
  await gotoSrc(page);
  await expect(page.getByTestId('error-panel')).toBeVisible();

  await page.goto('/');
  await expect(page.getByTestId('load-dialog')).toBeVisible();
  await expect(page.getByTestId('saved-families')).toHaveCount(0);
});

test('E2E-51: localStorage unavailable → registry silently disabled, app still works (UC-67)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage disabled'); } });
  });
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await gotoSrc(page);
  await expect(page.locator('.person-card').first()).toBeVisible(); // no crash (settings + registry both tolerate it)

  await page.goto('/');
  await expect(page.getByTestId('load-dialog')).toBeVisible();
  await expect(page.getByTestId('saved-families')).toHaveCount(0);
  await expect(page.getByTestId('link-input')).toBeFocused();
});
