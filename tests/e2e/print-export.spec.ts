// tests/e2e/print-export.spec.ts
import { expect, test } from '@playwright/test';
import { contentBBox, parseDims } from './helpers/svg-mm';
import { exportSvg, exportSvgs, FIXTURE_SERVER, viewUrl } from './helpers';

// stair-worst-200.csv is deliberately unfittable at every format flow/fan support (see
// worst-case-generator.ts's generateDense() doc comment) — the flow/fan-facing tests below
// need an actual export, so they run against stair-dense-35.csv instead (same
// generator/seed, a shape sized to fit panorama at a 60mm margin). The panels arrangement
// is different: it's PR ③'s whole point that panels CAN absorb worst-200 — see E2E-86.
const DENSE = `${FIXTURE_SERVER}/stair-dense-35.csv`;
const DISCONNECTED = `${FIXTURE_SERVER}/disconnected.csv`;
const WORST = `${FIXTURE_SERVER}/stair-worst-200.csv`;
const TRIO = `${FIXTURE_SERVER}/stair-trio.csv`;

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

// ADJUDICATED SEMANTICS (see src/print/fit.ts's checkPanelsFit doc comment, "fix round
// 2"): checkPanelsFit gates on dimensional fit only — overCap now only ANNOTATES a
// dimensional refusal, it never refuses a panel that already fits. worst-200's deepest
// panels (IV/V/VI: 40/38/40 people each, already narrowed to F0–F1 and still over
// PANEL_SOFT_CAP) don't fit pano's usable area, so panels refuses honestly there too.
//
// The coordinator's first-round adjudication called for switching to A0 to unblock the
// export. Empirically re-verified against real (non-fake) font metrics, A0 is NOT
// actually big enough either: Panel IV's real rendered content needs ~51×93cm, and A0's
// 84cm height falls short by ~9cm (the earlier "A0 fits" numbers were based on a coarser
// estimate, not the browser's real font measurement). A true fixed preset large enough
// for a 40-person single-generation branch doesn't exist in FORMAT_PRESETS, so this uses
// the app's existing 'custom' format support (fmt:<w>x<h>, see src/settings/view-param.ts
// and PRINT_BOUNDS.customMm — bounds 300–2000mm wide, 300–1200mm tall) with 700×1100mm,
// comfortably inside those bounds and empirically confirmed (see below) to clear every one
// of worst-200's 8 panels with real fonts, not just the tightest one. This is the same
// class of fix as pano→A0, just a bigger vessel: PR ③'s promise is that panels absorbs
// what flow/fan refuse GIVEN AN ADEQUATE FORMAT — checkPanelsFit's own refusal message
// literally suggests "choose a larger per-panel format" as the remedy.
test('E2E-86: worst-200 refuses panels at pano (names the panel), then exports all 8 panels at a large custom format — absorbing what flow and fan refuse everywhere (UC-85, UC-89)', async ({ page }) => {
  // (a) pano: a dimensional refusal, not silence — the canvas still renders underneath
  // it (a fit failure never hides the tree, per App.tsx), and the refusal names the
  // offending panel plus the "could not be subdivided further" overCap annotation.
  await page.goto(viewUrl(WORST, 'arr:panels', 'Worst'));
  await expect(page.locator('svg.print-canvas-svg[data-arrangement="panels"]')).toBeVisible();
  await expect(page.locator('g.print-panel').first()).toBeVisible();
  const refusal = page.getByTestId('fit-refusal');
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText('Panel IV');
  await expect(refusal).toContainText('could not be subdivided further');
  await expect(page.getByRole('button', { name: 'Export SVG' })).toBeDisabled();

  // (b) A large custom per-panel format (fmt:700x1100 in the view param — no
  // settings-panel UI needed since viewUrl can land directly on it): every panel now
  // fits, refusal clears, export unblocks.
  await page.goto(viewUrl(WORST, 'arr:panels,fmt:700x1100', 'Worst'));
  await expect(page.locator('svg.print-canvas-svg[data-arrangement="panels"]')).toBeVisible();
  await expect(page.locator('g.print-panel').first()).toBeVisible();
  await expect(page.getByTestId('fit-refusal')).toHaveCount(0);
  const n = await page.locator('g.print-panel').count();
  expect(n).toBe(8); // master + I..VII, empirically verified against the current partitioner
  const exportButton = page.getByRole('button', { name: 'Export SVG' });
  await expect(exportButton).toBeEnabled();
  const files = await exportSvgs(page, n);
  expect(files.map((f) => f.name)).toEqual(
    Array.from({ length: n }, (_, i) => `Worst-panels-indochine-${i + 1}of${n}-70x110cm.svg`),
  );
  for (const { name, svg } of files) {
    const { wMm, hMm, mmPerUnit } = parseDims(svg);
    expect([wMm, hMm], name).toEqual([700, 1100]); // the custom per-panel full sheet
    expect(mmPerUnit, name).toBeCloseTo(1, 5);
    expect(svg.replace(/\bxmlns(:\w+)?="[^"]*"/g, ''), name).not.toMatch(/https?:\/\//); // self-contained per file
  }
  // Reload before the determinism re-export: Chrome's per-tab download limiter
  // caps an IMMEDIATE second burst of automatic downloads at ~2 files (probe-
  // verified: back-to-back click → 2/8 delivered; after reload → 8/8; 20s apart
  // → 8/8). Navigation resets the limiter, and byte-identical output across two
  // page loads is a strictly stronger determinism statement anyway.
  await page.reload();
  await expect(page.locator('svg.print-canvas-svg[data-arrangement="panels"]')).toBeVisible();
  await expect(page.getByTestId('fit-refusal')).toHaveCount(0);
  const second = await exportSvgs(page, n);
  expect(second).toEqual(files); // byte-identical per panel: deterministic export
});

test('E2E-87: triptych export — exactly 3 SVGs at 40×60 cm, each with its own full safe margin (UC-85)', async ({ page }) => {
  await page.goto(viewUrl(TRIO, 'arr:panels,fmt:trip,mgn:50', 'Trio'));
  await expect(page.locator('g.print-panel')).toHaveCount(3);
  await expect(page.getByTestId('fit-refusal')).toHaveCount(0);
  const files = await exportSvgs(page, 3);
  expect(files.map((f) => f.name)).toEqual([
    'Trio-panels-indochine-1of3-40x60cm.svg',
    'Trio-panels-indochine-2of3-40x60cm.svg',
    'Trio-panels-indochine-3of3-40x60cm.svg',
  ]);
  for (const { name, svg } of files) {
    const { wMm, hMm, mmPerUnit } = parseDims(svg);
    expect([wMm, hMm], name).toEqual([400, 600]);
    // per-panel safe margin: no node is ever split across a seam because every
    // panel is its own document — content stays fully inside [mgn, size−mgn]
    const box = await contentBBox(page, svg);
    expect(box.x * mmPerUnit, name).toBeGreaterThanOrEqual(50);
    expect((box.x + box.width) * mmPerUnit, name).toBeLessThanOrEqual(400 - 50);
    expect(box.y * mmPerUnit, name).toBeGreaterThanOrEqual(50);
    expect((box.y + box.height) * mmPerUnit, name).toBeLessThanOrEqual(600 - 50);
  }
});
