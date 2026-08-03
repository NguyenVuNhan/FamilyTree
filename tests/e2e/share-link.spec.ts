// tests/e2e/share-link.spec.ts
import { expect, test } from '@playwright/test';
import { ALPHA_URL, gotoSrc, serveCsv } from './helpers';

test('E2E-52: copy-share-link copies the canonical URL with confirmation (UC-69)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await gotoSrc(page); // Alpha Family
  await expect(page.locator('.person-card').first()).toBeVisible();

  await page.getByRole('button', { name: 'Copy share link' }).click();
  await expect(page.getByTestId('copy-confirmation')).toHaveText('Link copied');

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // Derive origin+path from the live page: under GITHUB_REPOSITORY (CI / Pages)
  // the app serves at /<repo>/ and the copied link must keep that base path.
  const { origin, pathname } = new URL(page.url());
  const expected = `${origin}${pathname}?${new URLSearchParams({ src: ALPHA_URL, name: 'Alpha Family' })}`;
  expect(copied).toBe(expected);
});
