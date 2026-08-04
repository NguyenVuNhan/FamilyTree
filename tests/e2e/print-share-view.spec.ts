// tests/e2e/print-share-view.spec.ts
import { expect, test } from '@playwright/test';
import { FIXTURE_SERVER, treeUrl } from './helpers';

const SRC_URL = `${FIXTURE_SERVER}/standard.csv`;

test('E2E-68: a print view link round-trips arrangement/theme/margin and survives a post-load tweak (UC-76, UC-78, UC-89)', async ({
  page, context, browser,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(treeUrl(SRC_URL, 'Std'));
  await expect(page.locator('.person-card').first()).toBeVisible();

  const gear = page.getByRole('button', { name: 'Layout settings' });
  const panel = page.getByTestId('settings-panel');
  await gear.click();
  await panel.getByRole('group', { name: 'Arrangement' }).getByRole('button', { name: 'Scroll' }).click();
  await panel.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Ink wash' }).click();
  await panel.getByRole('slider', { name: 'Safe margin' }).fill('50');
  await page.keyboard.press('Escape');
  await expect(page.locator('g.person-node').first()).toBeVisible();

  await page.getByRole('button', { name: 'Copy share link' }).click();
  await expect(page.getByTestId('copy-confirmation')).toHaveText('Link copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  // pano is the default format, so it never appears in `view=` — only the 3 fields that
  // actually changed do, in FIELDS' canonical order (arr, theme, then mgn).
  const url = new URL(copied);
  expect(url.searchParams.get('view')).toBe('arr:flow,theme:inkwash,mgn:50');
  expect(copied).toContain(encodeURIComponent('arr:flow,theme:inkwash,mgn:50'));

  // Fresh context/tab with a *different* seeded layout for this same source — the shared
  // view must win over it completely (sender's exact arrangement/theme/margin).
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  // Seed via a plain '/' visit + evaluate (not addInitScript) — addInitScript would
  // re-run on every later navigation in this context, including the reload() below,
  // silently re-clobbering the tweak this test makes after the link applies.
  await p2.goto('/');
  await p2.evaluate(
    ([key, val]) => localStorage.setItem(key, val),
    [`ft:layout:src:${SRC_URL}`, JSON.stringify({ cardStyle: 'circle', arrangement: 'topDown', theme: 'nordic' })] as const,
  );
  await p2.goto(copied);
  await expect(p2.locator('g.person-node').first()).toBeVisible(); // sender's flow arrangement wins, not the seeded topDown
  const url2 = new URL(p2.url());
  expect(url2.searchParams.get('view')).toBeNull(); // stripped
  expect(url2.searchParams.get('src')).toBe(SRC_URL);
  const stored = await p2.evaluate((k) => localStorage.getItem(k), `ft:layout:src:${SRC_URL}`);
  expect(JSON.parse(stored!)).toMatchObject({ arrangement: 'flow', theme: 'inkwash', marginMm: 50 });

  // Tweak after the link applied, then reload — the tweak must survive (no snap-back to
  // the link's original theme).
  await p2.getByRole('button', { name: 'Layout settings' }).click();
  await p2.getByTestId('settings-panel').getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Botanical' }).click();
  await p2.reload();
  await expect(p2.locator('g.person-node').first()).toBeVisible();
  const restored = await p2.evaluate((k) => localStorage.getItem(k), `ft:layout:src:${SRC_URL}`);
  expect(JSON.parse(restored!)).toMatchObject({ theme: 'botanical' });
  await ctx2.close();
});

const BLANK_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('E2E-69: a garbage view value degrades to defaults silently — no error panel, no console errors (UC-81)', async ({ page }) => {
  // standard.csv's avatar URL is fake (img.example) — abort()/a real DNS failure both log
  // their own "Failed to load resource" console error, which would be unrelated noise
  // against what this test actually checks (bad ?view= handling). Fulfilling with a real
  // (blank) image keeps the resource load from failing at all.
  await page.route('https://img.example/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(BLANK_PNG_B64, 'base64') }));
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  const garbage = encodeURIComponent('¬_(ツ)_/¬,,,arr:banana,fmt:not-a-format,mgn:-999,theme:🎨,junk:junk:junk');
  await page.goto(`${treeUrl(SRC_URL, 'Std')}&view=${garbage}`);
  await expect(page.locator('.person-card').first()).toBeVisible(); // every field fell back to its own default (arrangement stays topDown)
  await expect(page.getByTestId('error-panel')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('view')).toBeNull(); // still stripped
  expect(errors).toEqual([]);
});

test('E2E-70: registry entries never carry ?view=, and the demo family accepts a print view link too (UC-78, UC-82)', async ({ page }) => {
  await page.goto(treeUrl(SRC_URL, 'RegTest'));
  await expect(page.locator('.person-card').first()).toBeVisible();
  await page.goto(`${treeUrl(SRC_URL, 'RegTest')}&view=${encodeURIComponent('arr:flow,theme:nordic')}`);
  await expect(page.locator('g.person-node').first()).toBeVisible();

  const entries = await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('ft:families:v1') ?? '[]') as { name: string; search: string }[];
    return all.filter((f) => f.name === 'RegTest');
  });
  expect(entries).toHaveLength(1); // the plain load and the view-link load dedupe to one entry
  expect(entries[0].search).not.toContain('view='); // the registry's shortcut URL is always the canonical (view-free) one

  await page.goto(`/?family=demo&view=${encodeURIComponent('arr:flow,theme:botanical')}`);
  await expect(page.locator('g.person-node').first()).toBeVisible();
  const capsuleFill = await page.locator('rect.pn-capsule').first().evaluate((el) => getComputedStyle(el).fill);
  expect(capsuleFill).toBe('rgb(247, 243, 232)'); // botanical's nodeFill #F7F3E8
  expect(new URL(page.url()).search).toBe('?family=demo'); // canonical, view stripped
});
