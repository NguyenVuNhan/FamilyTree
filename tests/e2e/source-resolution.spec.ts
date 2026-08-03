// tests/e2e/source-resolution.spec.ts
import { expect, test } from '@playwright/test';
import { E2E_SHEET_ID, FIXTURE_SERVER, fixture, serveCsv, SHEET_CSV_URL, treeUrl } from './helpers';

test('E2E-40: ?src= over real localhost http renders; name fallback then explicit name (UC-42, UC-43, UC-52)', async ({ page }) => {
  // Real fixture server — proves the http-localhost carve-out and a genuine CORS fetch.
  await page.goto(treeUrl(`${FIXTURE_SERVER}/standard.csv`));
  await expect(page.locator('.person-card').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Family Tree' })).toBeVisible(); // fallback title
  await expect(page).toHaveTitle('Family Tree — Family Tree');

  await page.goto(treeUrl(`${FIXTURE_SERVER}/standard.csv`, 'Gia đình Nguyễn'));
  await expect(page.getByRole('heading', { name: 'Gia đình Nguyễn' })).toBeVisible(); // Unicode-safe
  await expect(page).toHaveTitle('Gia đình Nguyễn — Family Tree');
});

test('E2E-41: ?sheet= reconstructs the published-CSV URL; gid propagates (UC-40, UC-41)', async ({ page }) => {
  const captured: string[] = [];
  await page.route('https://docs.google.com/**', (route) => {
    captured.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/csv', body: fixture('standard.csv') });
  });

  await page.goto(`/?sheet=${E2E_SHEET_ID}`);
  await expect(page.locator('.person-card').first()).toBeVisible();
  expect(captured.at(-1)).toBe(SHEET_CSV_URL);

  await page.goto(`/?sheet=${E2E_SHEET_ID}&gid=42`);
  await expect(page.locator('.person-card').first()).toBeVisible();
  expect(captured.at(-1)).toBe(`${SHEET_CSV_URL}&gid=42`);
});

test('E2E-42: sheet wins over src; src is never fetched (UC-51)', async ({ page }) => {
  let srcRequested = false;
  await page.route('https://sheets.example/**', (route) => {
    srcRequested = true;
    return route.fulfill({ status: 200, contentType: 'text/csv', body: fixture('bravo.csv') });
  });
  await page.route('https://docs.google.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/csv', body: fixture('standard.csv') }));

  await page.goto(`/?sheet=${E2E_SHEET_ID}&src=${encodeURIComponent('https://sheets.example/alpha.csv')}`);
  await expect(page.getByRole('button', { name: 'Margaret Ellis' })).toBeVisible(); // standard.csv content
  expect(srcRequested).toBe(false);
});

test('E2E-43: malformed params → ErrorPanel with the specific message, no cards (UC-47, UC-49, UC-50)', async ({ page }) => {
  await page.goto(`/?src=${encodeURIComponent('http://evil.example/x.csv')}`);
  await expect(page.getByTestId('error-panel')).toContainText('https:// address');
  await expect(page.locator('.person-card')).toHaveCount(0);

  await page.goto('/?sheet=not-a-publish-id');
  await expect(page.getByTestId('error-panel')).toContainText('publish ID');
  await expect(page.locator('.person-card')).toHaveCount(0);

  await page.goto('/?family=smith');
  await expect(page.getByTestId('error-panel')).toContainText('no family tree at this address');
  await expect(page.getByRole('link', { name: /demo family/i })).toBeVisible();
  await expect(page.locator('.person-card')).toHaveCount(0);
});

test('E2E-44: fetch failure and unreadable payload → could-not-load ErrorPanel with demo link (UC-44, UC-45)', async ({ page }) => {
  await page.route('https://sheets.example/alpha.csv', (r) => r.abort());
  await page.goto(treeUrl('https://sheets.example/alpha.csv'));
  await expect(page.getByTestId('error-panel')).toContainText(/couldn't be loaded/);
  await expect(page.getByRole('link', { name: /demo family/i })).toBeVisible();

  await serveCsv(page, { url: 'https://sheets.example/bravo.csv', body: '<!doctype html><html><body>Sorry</body></html>' });
  await page.goto(treeUrl('https://sheets.example/bravo.csv'));
  await expect(page.getByTestId('error-panel')).toContainText(/readable sheet/);
  await expect(page.locator('.person-card')).toHaveCount(0);
});
