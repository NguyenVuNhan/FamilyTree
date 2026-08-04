// tests/e2e/print-export.spec.ts
import { expect, test } from '@playwright/test';
import { parseDims } from './helpers/svg-mm';
import { exportSvg, FIXTURE_SERVER, viewUrl } from './helpers';

// stair-worst-200.csv is deliberately unfittable at every format the app supports (see
// worst-case-generator.ts's generateDense() doc comment) — this test needs an actual
// export, so it runs against stair-dense-35.csv instead (same generator/seed, a shape
// sized to fit panorama at a 60mm margin).
const DENSE = `${FIXTURE_SERVER}/stair-dense-35.csv`;
const DISCONNECTED = `${FIXTURE_SERVER}/disconnected.csv`;

test('E2E-66: export is deterministic, offline-safe, and mm-calibrated (UC-83, UC-96)', async ({ page }) => {
  await page.goto(viewUrl(DENSE, 'arr:flow,fmt:pano', 'W'));
  await expect(page.locator('g.person-node').first()).toBeVisible();
  const first = await exportSvg(page);
  const second = await exportSvg(page);
  expect(second).toBe(first); // byte-identical: no timestamps, no randomness

  // fully self-contained — no network refetch on open. Every <svg> legitimately declares
  // xmlns="http://www.w3.org/2000/svg" (and buildExportSvg's doc.implementation.createDocument
  // sets it too), so strip xmlns attributes before checking for a live http(s) reference
  // rather than a false positive on the XML namespace URI itself.
  expect(first.replace(/\bxmlns(:\w+)?="[^"]*"/g, '')).not.toMatch(/https?:\/\//);
  expect(first).toContain('data:font/woff2;base64,'); // fonts embedded, not linked
  expect(first).toContain('h 100'); // the calibration bar's 100mm reference segment

  const { wMm, hMm, viewBox, mmPerUnit } = parseDims(first);
  expect(wMm).toBe(1200);
  expect(hMm).toBe(600);
  expect(mmPerUnit).toBeCloseTo(1, 5); // isotropic: 1 SVG user unit === 1 physical mm
  expect(viewBox[2] / viewBox[3]).toBeCloseTo(wMm / hMm, 5);
});

test('E2E-67: a disconnected component is excluded, named, and blocks export (UC-19, UC-89)', async ({ page }) => {
  await page.goto(viewUrl(DISCONNECTED, 'arr:flow', 'Disc'));
  await expect(page.locator('g.person-node').first()).toBeVisible();
  await expect(page.locator('g.person-node')).toHaveCount(5); // Margaret/Robert/David/Sarah/Linda

  const notice = page.getByTestId('warnings');
  await expect(notice).toContainText('Lost One');
  await expect(notice).toContainText('Lost Two');
  const noticeText = (await notice.textContent())!;
  expect(noticeText).not.toMatch(/\br\d+p?\b/); // display names only, never synthetic row ids

  // A silently dropped ancestor is never acceptable in an exported/printed tree (spec
  // rule, UC-19) — App.tsx's blocked-export precedence checks excludedIds first, before
  // unplaced-via-inlaw people or a fit refusal, naming excluded people by display name.
  const exportButton = page.getByRole('button', { name: 'Export SVG' });
  await expect(exportButton).toBeDisabled();
  const reason = (await exportButton.getAttribute('title')) ?? '';
  expect(reason).toContain('Lost One');
  expect(reason).toContain('Lost Two');
  expect(reason).not.toMatch(/\br\d+p?\b/);
});
