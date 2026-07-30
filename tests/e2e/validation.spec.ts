import { expect, test } from '@playwright/test';
import { serveCsv } from './helpers';

const ERROR_FIXTURES: Array<[string, RegExp]> = [
  ['err-two-columns.csv', /Row 2 has people in both "Đời 1" and "Đời 2"/],
  ['err-first-row-jump.csv', /Row 2 is in "Đời 2" but the tree must start in "Đời 1"/],
  ['err-depth-jump.csv', /Row 3 is in "Đời 3".*did you mean "Đời 2"\?/s],
  ['err-partner-no-name.csv', /Row 2 is missing the person's name before the "\+"/],
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

// Adaptation: a zero-byte sheet has no parseable header row, so parseStaircase() throws
// UnreadableSheetError — indistinguishable, by design, from any other unreadable payload
// (HTML error page, wrong columns). useFamilyData() catches that and falls back to the
// bundled sample data, showing the "couldn't be read" banner, NOT the empty-state.
// Only a sheet with a valid header and zero data rows (header-only.csv, above) reaches 'empty'.
test('E2E-19b: zero-byte sheet is unreadable (no header row) — falls back to sample data', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'empty.csv' });
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('sample-banner')).toContainText(/couldn't be read/i);
  await expect(page.locator('.person-card').first()).toBeVisible();
});

test('E2E-21: bad base64 warns, initials render, tree intact (UC-24)', async ({ page }) => {
  await serveCsv(page, { fixtureName: 'warn-bad-base64.csv' });
  await page.goto('/?family=alpha');
  await expect(page.getByTestId('warnings')).toContainText(/image/i);
  await expect(page.locator('.person-card').getByText('AL')).toBeVisible(); // initials for Ann Lee
});
