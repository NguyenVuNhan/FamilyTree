// tests/e2e/share-link.spec.ts
import { expect, test } from '@playwright/test';
import { ALPHA_URL, FIXTURE_SERVER, gotoSrc, serveCsv, treeUrl } from './helpers';

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

test('E2E-56: copied link carries only non-default fields in ?view= (UC-76)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await gotoSrc(page);
  await expect(page.locator('.person-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Layout settings' }).click();
  const panel = page.getByTestId('settings-panel');
  await panel.getByRole('button', { name: 'Circle' }).click();
  await panel.getByRole('slider', { name: 'Generation gap' }).fill('120');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Copy share link' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  const url = new URL(copied);
  const live = new URL(page.url());
  expect(`${url.origin}${url.pathname}`).toBe(`${live.origin}${live.pathname}`); // base-path-agnostic
  expect(url.searchParams.get('src')).toBe(ALPHA_URL);
  expect(url.searchParams.get('name')).toBe('Alpha Family');
  expect(url.searchParams.get('view')!.split(',').sort()).toEqual(['gen:120', 'style:circle']);
});

test('E2E-57: shared view applies in a fresh browser — strip, persist, tweak survives reload (UC-78, UC-80, UC-89)', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const srcUrl = `${FIXTURE_SERVER}/standard.csv`; // real localhost server → works in the second context
  await page.goto(treeUrl(srcUrl, 'Alpha Family'));
  await expect(page.locator('.person-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Layout settings' }).click();
  await page.getByTestId('settings-panel').getByRole('button', { name: 'Circle' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Copy share link' }).click();
  await expect(page.getByTestId('copy-confirmation')).toHaveText('Link copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(copied);
  await expect(p2.locator('.person-card.style-circle').first()).toBeVisible(); // sender's exact view
  await expect(p2.locator('.person-name').first()).toBeVisible();              // full mode came along
  const url2 = new URL(p2.url());
  expect(url2.searchParams.get('view')).toBeNull();   // stripped
  expect(url2.searchParams.get('src')).toBe(srcUrl);  // source params survive
  const stored = await p2.evaluate((k) => localStorage.getItem(k), `ft:layout:src:${srcUrl}`);
  expect(JSON.parse(stored!)).toMatchObject({ cardStyle: 'circle' });

  await p2.getByRole('button', { name: 'Layout settings' }).click();
  await p2.getByTestId('settings-panel').getByRole('button', { name: 'Photo left' }).click();
  await p2.reload();
  await expect(p2.locator('.person-card.style-photoLeft').first()).toBeVisible(); // no snap-back
  await ctx2.close();
});

test("E2E-58: a view link overrides the recipient's saved settings (UC-79)", async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await page.goto('/');
  await page.evaluate(
    ([key, val]) => localStorage.setItem(key, val),
    [`ft:layout:src:${ALPHA_URL}`, JSON.stringify({ cardStyle: 'photoLeft' })] as const,
  );
  await page.goto(`${treeUrl(ALPHA_URL, 'Alpha Family')}&view=${encodeURIComponent('style:circle')}`);
  await expect(page.locator('.person-card.style-circle').first()).toBeVisible(); // link wins
  await page.reload(); // param already stripped → the persisted override is what loads
  await expect(page.locator('.person-card.style-circle').first()).toBeVisible();
});

test('E2E-59: malformed view degrades per-field and silently (UC-81)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'standard.csv' });
  await page.goto(`${treeUrl(ALPHA_URL, 'Alpha Family')}&view=${encodeURIComponent('style:bogus,gen:120,junk,,pad:99999')}`);
  await expect(page.locator('.person-card.style-archCard').first()).toBeVisible(); // bad style → default, no error panel
  expect(new URL(page.url()).searchParams.get('view')).toBeNull(); // still stripped
  await page.getByRole('button', { name: 'Layout settings' }).click();
  await expect(page.getByRole('slider', { name: 'Generation gap' })).toHaveValue('120'); // good field survived
  await expect(page.getByRole('slider', { name: 'Card padding' })).toHaveValue('14');    // out-of-range → default
});

test('E2E-60: the demo family accepts a view link too (UC-82)', async ({ page }) => {
  await page.goto(`/?family=demo&view=${encodeURIComponent('style:circle')}`);
  await expect(page.locator('.person-card.style-circle').first()).toBeVisible();
  expect(new URL(page.url()).search).toBe('?family=demo'); // canonical, view stripped
  const stored = await page.evaluate(() => localStorage.getItem('ft:layout:demo'));
  expect(JSON.parse(stored!)).toMatchObject({ cardStyle: 'circle' });
});
