import { expect, test } from '@playwright/test';
import { ALPHA_URL, fixture, NO_CONFIG_BASE, serveCsv } from './helpers';

test('E2E-22: no families configured → demo + banner, dismissible (UC-26)', async ({ page }) => {
  await page.goto(`${NO_CONFIG_BASE}/`); // demo family served from public/sample-data.csv
  await expect(page.getByTestId('sample-banner')).toContainText(/no family sheets/i);
  await expect(page.locator('.person-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
});

test('E2E-23: sheet request aborted → demo + couldn\'t-load banner (UC-27)', async ({ page }) => {
  await page.route(ALPHA_URL, (r) => r.abort());
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('sample-banner')).toContainText(/couldn't load/i);
  await expect(page.locator('.person-card').first()).toBeVisible();
});

test('E2E-24: slow response shows loading, never flashes fallback (UC-28)', async ({ page }) => {
  await page.route(ALPHA_URL, async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.fulfill({ status: 200, contentType: 'text/csv', body: fixture('standard.csv') });
  });
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('loading')).toBeVisible();

  // Continuously watch for the fallback banner across the whole delay window — not just at two
  // instants — so a future timing-based intermediate state (not just today's atomic setState)
  // would also be caught.
  let sawBanner = false;
  let done = false;
  const watcher = (async () => {
    while (!done) {
      if (await page.getByTestId('sample-banner').count()) sawBanner = true;
      await page.waitForTimeout(100);
    }
  })();

  await expect(page.locator('.person-card').first()).toBeVisible({ timeout: 5000 });
  done = true;
  await watcher;
  expect(sawBanner).toBe(false); // never flashed the fallback while live data was in flight
  await expect(page.getByTestId('sample-banner')).toHaveCount(0); // final state: no banner, live data arrived
});

test('E2E-25: HTML response → demo + couldn\'t-read banner, no crash (UC-29)', async ({ page }) => {
  await serveCsv(page, { body: '<!doctype html><html><body>Sorry, error</body></html>' });
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('sample-banner')).toContainText(/couldn't be read/i);
  await expect(page.locator('.person-card').first()).toBeVisible();
});

test('E2E-26: image URL 404 → initials fallback (UC-30)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'images-mixed.csv' });
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 404 }));
  await page.goto('/?family=alpha');
  await expect(page.locator('[data-person-id="url"]').getByText('UP')).toBeVisible();
});

test('E2E-27: data URI, raw base64, blank → correct rendering; stable distinct hues (UC-25, UC-31–33)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'images-mixed.csv' });
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }));
  await page.goto('/?family=alpha');
  await expect(page.locator('[data-person-id="datauri"] img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(page.locator('[data-person-id="raw"] img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  const bg = (id: string) =>
    page.locator(`[data-person-id="${id}"] [role="img"]`).evaluate((el) => getComputedStyle(el).backgroundImage);
  const b1 = await bg('blank');
  const b2 = await bg('blank2');
  expect(b1).not.toBe(b2);              // distinct hues
  await page.reload();
  expect(await bg('blank')).toBe(b1);   // stable across reloads
});
