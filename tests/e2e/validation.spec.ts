import { expect, test } from '@playwright/test';
import { serveCsv } from './helpers';

const ERROR_FIXTURES: Array<[string, RegExp]> = [
  ['err-dup-id.csv', /Duplicate ID "a".*row/s],
  ['err-unknown-partner.csv', /PartnerID "ghost".*row 2/s],
  ['err-unknown-parent.csv', /ParentIDs "ghost".*row 2/s],
  ['err-missing-name.csv', /missing FullName/],
  ['err-three-parents.csv', /more than 2/],
  ['err-remarriage.csv', /"anna".*"bob".*row 3.*"carl".*row 4/s],
  ['err-cycle.csv', /cycle/i],
];

for (const [fixtureName, pattern] of ERROR_FIXTURES) {
  test(`E2E-18 ${fixtureName}: error panel with row-numbered message, no tree behind (UC-20, UC-21)`, async ({ page }) => {
    await serveCsv(page, { fixtureName });
    await page.goto('/?family=alpha');
    await expect(page.getByTestId('error-panel')).toBeVisible();
    expect(await page.getByTestId('error-panel').innerText()).toMatch(pattern);
    await expect(page.locator('.person-card')).toHaveCount(0);
  });
}

test('E2E-19: header-only sheet → friendly empty state (UC-22)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'header-only.csv' });
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('empty-state')).toContainText(/no people found/i);
});

// Adaptation (documented in task-14-report.md): a zero-byte sheet has no parseable header row,
// so parseCsv() throws UnreadableCsvError — indistinguishable, by design, from any other
// unreadable payload (HTML error page, wrong columns). useFamilyData() catches that and falls
// back to the bundled sample data, showing the "couldn't be read" banner, NOT the empty-state.
// Only a sheet with a valid header and zero data rows (header-only.csv, above) reaches 'empty'.
test('E2E-19b: zero-byte sheet is unreadable (no header row) — falls back to sample data', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'empty.csv' });
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('sample-banner')).toContainText(/couldn't be read/i);
  await expect(page.locator('.person-card').first()).toBeVisible();
});

test('E2E-20: case-only id mismatch warns; the earlier row renders (UC-23)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'warn-case-ids.csv' });
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('warnings')).toContainText(/only by letter case/);
  await expect(page.locator('.person-card').first()).toBeVisible();
});

test('E2E-21: bad base64 warns, initials render, tree intact (UC-24)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'warn-bad-base64.csv' });
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('warnings')).toContainText(/image/i);
  await expect(page.locator('.person-card').getByText('AL')).toBeVisible(); // initials for Ann Lee
});
