import { expect, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ALPHA_URL = 'https://sheets.example/alpha.csv';
export const BRAVO_URL = 'https://sheets.example/bravo.csv';
export const FIXTURE_SERVER = 'http://localhost:8787';
/** Passes the app's ^2PACX-[A-Za-z0-9_-]{20,}$ publish-ID check. */
export const E2E_SHEET_ID = '2PACX-TESTTESTTESTTESTTEST';
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/e/${E2E_SHEET_ID}/pub?output=csv`;

export function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

/** Intercept a sheet URL and serve a fixture CSV (or raw body). */
export async function serveCsv(page: Page, opts: { url?: string; fixtureName?: string; body?: string; status?: number }) {
  const { url = ALPHA_URL, fixtureName, body, status = 200 } = opts;
  await page.route(url, (route) =>
    route.fulfill({ status, contentType: 'text/csv', body: body ?? (fixtureName ? fixture(fixtureName) : '') }),
  );
}

/** The app URL that loads `sheetUrl` via ?src= (URLSearchParams encoding = canonical form). */
export function treeUrl(sheetUrl: string, name?: string): string {
  const params = new URLSearchParams({ src: sheetUrl });
  if (name) params.set('name', name);
  return `/?${params.toString()}`;
}

/** `treeUrl` plus a raw (unencoded) `view=` value — for tests that need to land directly
 *  on a non-default print arrangement/theme/format/margin without driving the panel UI. */
export function viewUrl(sheetUrl: string, view: string, name?: string): string {
  return `${treeUrl(sheetUrl, name)}&view=${encodeURIComponent(view)}`;
}

/** Clicks the toolbar's "Export SVG" button and returns the downloaded file's text content. */
export async function exportSvg(page: Page): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export SVG' }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error('download.path() returned null — was acceptDownloads disabled?');
  return readFileSync(path, 'utf-8');
}

/** Clicks Export SVG once and collects `expected` downloads (the panels
 *  arrangement produces one file per panel from a single click). Returns
 *  filename+content pairs sorted by filename — the `<n>of<N>` component makes
 *  that a deterministic panel order. */
export async function exportSvgs(page: Page, expected: number): Promise<{ name: string; svg: string }[]> {
  const downloads: Download[] = [];
  const listener = (d: Download) => { downloads.push(d); };
  page.on('download', listener);
  await page.getByRole('button', { name: 'Export SVG' }).click();
  await expect.poll(() => downloads.length, { timeout: 15_000 }).toBe(expected);
  page.off('download', listener);
  const files = await Promise.all(downloads.map(async (d) => {
    const path = await d.path();
    if (!path) throw new Error('download.path() returned null — was acceptDownloads disabled?');
    return { name: d.suggestedFilename(), svg: readFileSync(path, 'utf-8') };
  }));
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/** Migration shim for pre-dynamic specs: what `goto('/?family=alpha')` used to do. */
export async function gotoSrc(page: Page, opts: { url?: string; name?: string } = {}) {
  await page.goto(treeUrl(opts.url ?? ALPHA_URL, opts.name ?? 'Alpha Family'));
}

export const card = (page: Page, id: string) => page.locator(`.person-card[data-person-id="${id}"]`);
export const transform = (page: Page) => page.getByTestId('viewport-transform');

/** Reads the current CSS transform in the browser context — DOMMatrix only exists there. */
export async function scaleOf(page: Page): Promise<number> {
  return transform(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
}

export async function translateOf(page: Page): Promise<{ x: number; y: number }> {
  return transform(page).evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.e, y: m.f };
  });
}
