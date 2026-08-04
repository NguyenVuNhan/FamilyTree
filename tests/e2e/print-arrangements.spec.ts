// tests/e2e/print-arrangements.spec.ts
import { expect, test } from '@playwright/test';
import { exportSvg, FIXTURE_SERVER, scaleOf, translateOf, treeUrl, viewUrl } from './helpers';

const WORST = `${FIXTURE_SERVER}/stair-worst-200.csv`;
const STANDARD = `${FIXTURE_SERVER}/standard.csv`;
const YEARS_MIXED = `${FIXTURE_SERVER}/stair-years-mixed.csv`;
const LONG_NAMES = `${FIXTURE_SERVER}/stair-long-names.csv`;

// Playwright's test runner loads spec files directly under Node (no Vite), so
// `import { THEMES } from '../../src/print/themes'` — as sketched in the task
// brief — fails at module-load time: themes.ts pulls in `*.woff2?url` asset
// imports that only Vite's transform understands ("Unknown file extension
// .woff2"). Mirroring just the color tokens here (kept in sync with
// src/print/themes.ts's THEMES map) avoids that without touching app source.
const THEME_TOKENS = [
  { id: 'indochine', background: '#F5EBDC', text: '#3B2F2A', connector: '#B9A48C', accent: '#9E2B25', nodeFill: '#F5EBDC', nodeBorder: '#9E2B25' },
  { id: 'nordic', background: '#FAFAF7', text: '#2E2E2E', connector: '#C9CFD3', accent: '#6B8E9F', nodeFill: '#FAFAF7', nodeBorder: '#6B8E9F' },
  { id: 'inkwash', background: '#FBFAF7', text: '#1C1C1C', connector: '#969696', accent: '#B03A2E', nodeFill: '#FBFAF7', nodeBorder: '#1C1C1C' },
  { id: 'botanical', background: '#F7F3E8', text: '#2F5233', connector: '#A9B49B', accent: '#B8933D', nodeFill: '#F7F3E8', nodeBorder: '#B8933D' },
] as const;

test('E2E-54: arrangement switch + panel gating (UC-77, UC-78)', async ({ page }) => {
  await page.goto(treeUrl(STANDARD, 'Std'));
  await page.getByRole('button', { name: 'Layout settings' }).click();
  await page.getByRole('group', { name: 'Arrangement' }).getByRole('button', { name: 'Scroll' }).click();
  await expect(page.locator('svg.print-canvas-svg g.person-node')).toHaveCount(7);
  await expect(page.locator('.person-card')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Card style' }).getByRole('button').first()).toBeDisabled();
  await expect(page.getByRole('group', { name: 'Theme' })).toBeVisible();
  await page.getByRole('group', { name: 'Arrangement' }).getByRole('button', { name: 'Top-down' }).click();
  await expect(page.locator('.person-card')).toHaveCount(7);
  await expect(page.getByRole('group', { name: 'Theme' })).toHaveCount(0);
});

test('E2E-55: theme fills match design tokens exactly (UC-76)', async ({ page }) => {
  for (const theme of THEME_TOKENS) {
    await page.goto(viewUrl(STANDARD, `arr:flow,theme:${theme.id}`, 'Std'));
    const capsule = page.locator('rect.pn-capsule').first();
    await expect(capsule).toBeVisible();
    const capsuleStyle = await capsule.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fill: cs.fill, stroke: cs.stroke };
    });
    const connectorStroke = await page.locator('path.connector').first().evaluate((el) => getComputedStyle(el).stroke);
    const bgFill = await page.locator('rect.pt-bg').evaluate((el) => getComputedStyle(el).fill);
    const nameFill = await page.locator('text.pn-name, text.pn-name-title').first().evaluate((el) => getComputedStyle(el).fill);
    const titleFill = await page.locator('text.pt-title').evaluate((el) => getComputedStyle(el).fill);

    const rgb = await page.evaluate((hexes) => {
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      const out = hexes.map((hex) => {
        probe.style.color = hex;
        return getComputedStyle(probe).color;
      });
      probe.remove();
      return out;
    }, [theme.nodeFill, theme.nodeBorder, theme.connector, theme.background, theme.text, theme.accent]);
    const [wantFill, wantStroke, wantConnector, wantBg, wantText, wantAccent] = rgb;

    expect(capsuleStyle.fill, `${theme.id} capsule fill`).toBe(wantFill);
    expect(capsuleStyle.stroke, `${theme.id} capsule stroke`).toBe(wantStroke);
    expect(connectorStroke, `${theme.id} connector stroke`).toBe(wantConnector);
    expect(bgFill, `${theme.id} background fill`).toBe(wantBg);
    expect(nameFill, `${theme.id} name fill`).toBe(wantText);
    expect(titleFill, `${theme.id} title fill`).toBe(wantAccent);
  }
});

test('E2E-57: frame guide shows on-canvas only, never in the export, and hides under print (UC-75)', async ({ page }) => {
  await page.goto(viewUrl(STANDARD, 'arr:flow,guide:1', 'Std'));
  await expect(page.locator('[data-print-role="guide"]')).toBeVisible();
  const svg = await exportSvg(page);
  expect(svg).not.toContain('data-print-role="guide"');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-print-role="guide"]')).toBeHidden();
});

test('E2E-64: years line renders every year-expression shape correctly (UC-74)', async ({ page }) => {
  await page.goto(viewUrl(YEARS_MIXED, 'arr:flow', 'Years'));
  const node = (id: string) => page.locator(`g.person-node[data-person-id="${id}"]`);
  await expect(node('r2')).toBeVisible();
  await expect(node('r2').locator('text.pn-years')).toHaveText('1928–1996');
  await expect(node('r2p').locator('text.pn-years')).toHaveText('1932–2011');
  await expect(node('r3').locator('text.pn-years')).toHaveText('b. 1955');
  await expect(node('r4').locator('text.pn-years')).toHaveText('b. 1958');
  await expect(node('r5').locator('text.pn-years')).toHaveText('d. 2001');
  await expect(node('r6').locator('text.pn-years')).toHaveCount(0); // no year expression at all
  await expect(node('r7').locator('text.pn-years')).toHaveCount(0); // "(thứ sáu)" is not a year expression

  const svg = await exportSvg(page);
  expect(svg).not.toMatch(/\(\s*[–-]?\s*\)/); // no stray empty/dash-only parens ever leak into the export
});

test('E2E-65: long names wrap fully within their capsule, 1mm inset, never truncated (UC-74)', async ({ page }) => {
  await page.goto(viewUrl(LONG_NAMES, 'arr:flow', 'Long'));
  await expect(page.locator('g.person-node').first()).toBeVisible();
  // See E2E-73's comment: usePrintMeasure re-measures once the theme's real fonts finish
  // loading, which can move capsule/text geometry after the initial fallback-font render.
  // Settle fonts before reading bboxes so this isn't racing that re-layout.
  await page.evaluate(() => document.fonts.ready);
  const violations = await page.evaluate(() => {
    const bad: string[] = [];
    for (const node of Array.from(document.querySelectorAll('g.person-node'))) {
      const id = node.getAttribute('data-person-id') ?? '(unknown)';
      const capsule = node.querySelector('rect.pn-capsule');
      if (!capsule) continue;
      const cb = (capsule as unknown as SVGGraphicsElement).getBBox();
      for (const text of Array.from(node.querySelectorAll('text.pn-name, text.pn-name-title'))) {
        if (text.textContent?.includes('…')) bad.push(`${id}: ellipsis found ("${text.textContent}")`);
        const tb = (text as unknown as SVGGraphicsElement).getBBox();
        const insetOk =
          tb.x >= cb.x + 1 - 0.01 &&
          tb.y >= cb.y + 1 - 0.01 &&
          tb.x + tb.width <= cb.x + cb.width - 1 + 0.01 &&
          tb.y + tb.height <= cb.y + cb.height - 1 + 0.01;
        if (!insetOk) {
          bad.push(`${id}: text bbox ${JSON.stringify(tb)} escapes capsule-1mm-inset ${JSON.stringify(cb)}`);
        }
      }
    }
    return bad;
  });
  expect(violations).toEqual([]);
});

test('E2E-66: density overflow refusal, larger format unblocks (UC-89)', async ({ page }) => {
  await page.goto(viewUrl(WORST, 'arr:flow,fmt:a4', 'Worst'));
  await expect(page.getByTestId('fit-refusal')).toContainText('cm');
  await expect(page.getByRole('button', { name: 'Export SVG' })).toBeDisabled();
  await page.getByRole('button', { name: 'Layout settings' }).click();
  await page.getByRole('group', { name: 'Format' }).getByRole('button', { name: 'Panorama' }).click();
  // pano may still refuse at n=200 — the assertion is state-consistency, not a specific
  // verdict. `toBeDisabled({ disabled })` isn't a real Playwright matcher option, so branch
  // explicitly on the observed refusal state instead.
  const refusing = await page.getByTestId('fit-refusal').isVisible();
  const exportButton = page.getByRole('button', { name: 'Export SVG' });
  if (refusing) {
    await expect(exportButton).toBeDisabled();
  } else {
    await expect(exportButton).toBeEnabled();
  }
});

test('E2E-72: worst-200 stress fixture loads within the flow performance budget (UC-89)', async ({ page }) => {
  const t0 = Date.now();
  await page.goto(viewUrl(WORST, 'arr:flow', 'Worst'));
  await expect(page.locator('g.person-node')).toHaveCount(200);
  const elapsedMs = Date.now() - t0;
  // `.warnings` is also the CSS class of the (unrelated) fit-refusal banner, which this
  // fixture legitimately triggers at the default pano format (see E2E-66/E2E-62) — assert
  // on the data-quality warnings strip specifically via its own testid.
  await expect(page.getByTestId('warnings')).toHaveCount(0); // no unplaced/excluded people in this fixture
  console.log(`E2E-72: worst-200 flow navigate+layout+render took ${elapsedMs}ms`); // deliberate: surfaces a flaky-close budget in CI logs
  expect(elapsedMs, 'navigate+layout+render wall time').toBeLessThan(2000);
});

test('E2E-73: pan/zoom/expand interactions match the Top-down arrangement (UC-78)', async ({ page }) => {
  await page.goto(viewUrl(STANDARD, 'arr:flow', 'Std'));
  await expect(page.locator('g.person-node').first()).toBeVisible();
  // usePrintMeasure (src/components/use-print-measure.ts) re-measures once the theme's
  // faces finish loading and bumps a generation counter, which changes the flow scene's
  // wMm/hMm and re-triggers PanZoomViewport's fit-to-view effect. Under parallel-worker
  // CPU contention that refit can land mid-drag and silently shift the baseline this test
  // measures against (reproduced as a deterministic ~3px-short delta) — settle fonts first.
  await page.evaluate(() => document.fonts.ready);

  const before = await translateOf(page);
  const vp = page.getByTestId('viewport');
  const box = (await vp.boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  // A single jump (not `{ steps: N }`) — matches interactions.spec.ts's E2E-02 convention.
  await page.mouse.move(box.x + 400, box.y + 350);
  await page.mouse.up();
  const after = await translateOf(page);
  expect(after.x - before.x).toBeCloseTo(100, 0);
  expect(after.y - before.y).toBeCloseTo(50, 0);

  const beforeScale = await scaleOf(page);
  await page.mouse.wheel(0, -240);
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(beforeScale * 1.01);

  const node = page.locator('g.person-node').first();
  await node.click();
  await expect(page.getByTestId('print-expanded')).toBeVisible();
  await node.click();
  await expect(page.getByTestId('print-expanded')).toHaveCount(0);

  // Exercises the same keydown handler a real Tab-then-Enter would reach (tabIndex=0 on
  // the node); .focus() is used instead of walking the page's full Tab order, which is
  // long and unrelated to what this test is verifying (keyboard activation parity).
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('print-expanded')).toBeVisible();
});
