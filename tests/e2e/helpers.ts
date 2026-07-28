import { type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ALPHA_URL = 'https://sheets.example/alpha.csv';
export const BRAVO_URL = 'https://sheets.example/bravo.csv';
export const NO_CONFIG_BASE = 'http://localhost:5174';

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
