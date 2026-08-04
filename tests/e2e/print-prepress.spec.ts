// tests/e2e/print-prepress.spec.ts
import { expect, test } from '@playwright/test';
import { collide, contentBBox, fontSizesMm, parseDims } from './helpers/svg-mm';
import { exportSvg, FIXTURE_SERVER, viewUrl } from './helpers';

// stair-worst-200.csv is deliberately unfittable at every format the app supports (see
// worst-case-generator.ts's generateDense() doc comment for the measured numbers) — its
// only legitimate e2e uses are the refusal test (print-arrangements.spec.ts) and the
// load/perf test, both of which don't need an actual export to succeed. The pre-press
// tests below need one that DOES export, so they run against stair-dense-35.csv instead
// (same generator module, same seed, a shallow/wide shape sized to actually fit panorama
// at a 60mm margin — target=28 → 35 people, empirically the largest that comfortably fits).
const DENSE = `${FIXTURE_SERVER}/stair-dense-35.csv`;
const STANDARD = `${FIXTURE_SERVER}/standard.csv`;
const ARRANGEMENTS = [{ arr: 'flow', fmt: 'pano' }]; // PR ② appends fan, PR ③ panels, PR ④ stacks

// See tests/e2e/print-arrangements.spec.ts for the shared note on why THEMES can't be
// imported here (themes.ts pulls in Vite-only *.woff2?url asset imports that Node's
// Playwright-test loader can't parse) — mirrored color tokens only, kept in sync with
// src/print/themes.ts's THEMES map.
const THEME_TOKENS = [
  { id: 'indochine' }, { id: 'nordic' }, { id: 'inkwash' }, { id: 'botanical' },
] as const;

for (const { arr, fmt } of ARRANGEMENTS) {
  test(`E2E-68: legibility floor at 1:1 — ${arr} (UC-74, UC-89)`, async ({ page }) => {
    await page.goto(viewUrl(DENSE, `arr:${arr},fmt:${fmt}`, 'W'));
    await expect(page.locator('g.person-node').first()).toBeVisible();
    const svg = await exportSvg(page);
    const { mmPerUnit } = parseDims(svg);
    for (const { id, mm } of await fontSizesMm(page, svg, 'text.pn-name, text.pn-name-title')) {
      expect(mm * mmPerUnit, `name of ${id}`).toBeGreaterThanOrEqual(6.5);
    }
    for (const { id, mm } of await fontSizesMm(page, svg, 'text.pn-years')) {
      expect(mm * mmPerUnit, `years of ${id}`).toBeGreaterThanOrEqual(3.2);
    }
  });

  test(`E2E-69: connector/text collision — ${arr} (UC-74)`, async ({ page }) => {
    await page.goto(viewUrl(DENSE, `arr:${arr},fmt:${fmt}`, 'W'));
    const svg = await exportSvg(page);
    expect(await collide(page, svg)).toEqual([]);
  });

  test(`E2E-70: safe margin + physical dims — ${arr} (UC-75)`, async ({ page }) => {
    await page.goto(viewUrl(DENSE, `arr:${arr},fmt:${fmt},mgn:60`, 'W'));
    const svg = await exportSvg(page);
    const { wMm, hMm, mmPerUnit } = parseDims(svg);
    expect([wMm, hMm]).toEqual([1200, 600]);
    const box = await contentBBox(page, svg);
    expect(box.x * mmPerUnit).toBeGreaterThanOrEqual(60);
    expect((box.x + box.width) * mmPerUnit).toBeLessThanOrEqual(1200 - 60);
    expect(box.y * mmPerUnit).toBeGreaterThanOrEqual(60);
    expect((box.y + box.height) * mmPerUnit).toBeLessThanOrEqual(600 - 60);
  });
}

// Not in the brief's given code (only prose + threshold contract) and deliberately run
// against `standard.csv` rather than `WORST`: this test is about per-theme rendered
// contrast, a property of the theme tokens, not of tree density — and standard.csv
// actually fits at every format's default, unlike WORST (see the DENSE/STANDARD note above).
test('E2E-71: rendered contrast witness per theme (UC-76)', async ({ page }) => {
  for (const theme of THEME_TOKENS) {
    await page.goto(viewUrl(STANDARD, `arr:flow,theme:${theme.id}`, 'Std'));
    await expect(page.locator('g.person-node').first()).toBeVisible();

    const results = await page.evaluate(() => {
      // WCAG relative-luminance/contrast formula, inlined so this evaluate doesn't need
      // to import src/print/themes.ts (see the THEME_TOKENS note above for why that's
      // awkward outside the app's own Vite pipeline) — identical math to relLuminance/
      // contrastRatio in src/print/themes.ts.
      const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const relLum = ([r, g, b]: [number, number, number]) =>
        0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
      const ratio = (a: [number, number, number], b: [number, number, number]) => {
        const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const parseRgb = (s: string): [number, number, number] => {
        const m = /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(s);
        if (!m) throw new Error(`could not parse color: ${s}`);
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      };

      const bgEl = document.querySelector('rect.pt-bg');
      if (!bgEl) throw new Error('no rect.pt-bg found');
      const bg = parseRgb(getComputedStyle(bgEl).fill);

      const out: Array<{ id: string; gen: number; kind: 'name' | 'connector'; ratio: number }> = [];
      for (const nameEl of Array.from(document.querySelectorAll('text.pn-name, text.pn-name-title'))) {
        const node = nameEl.closest('g.person-node');
        const capsule = node?.querySelector('rect.pn-capsule');
        if (!node || !capsule) continue;
        const capsuleFill = parseRgb(getComputedStyle(capsule).fill);
        const nameFill = parseRgb(getComputedStyle(nameEl).fill);
        out.push({
          id: node.getAttribute('data-person-id') ?? '(unknown)',
          gen: Number(node.getAttribute('data-generation') ?? '0'),
          kind: 'name',
          ratio: ratio(nameFill, capsuleFill),
        });
      }
      for (const conn of Array.from(document.querySelectorAll('path.connector'))) {
        const stroke = parseRgb(getComputedStyle(conn).stroke);
        out.push({
          id: `${conn.getAttribute('data-from') ?? '?'}->${conn.getAttribute('data-to') ?? '?'}`,
          gen: -1,
          kind: 'connector',
          ratio: ratio(stroke, bg),
        });
      }
      return out;
    });

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      if (r.kind === 'name') {
        expect(r.ratio, `${theme.id} name ${r.id} contrast`).toBeGreaterThanOrEqual(4.5);
        if (r.ratio < 7 && r.gen >= 3) {
          console.warn(`E2E-71: ${theme.id} name ${r.id} (gen ${r.gen}) contrast ${r.ratio.toFixed(2)} is in the 4.5-7 soft zone`);
        }
      } else {
        expect(r.ratio, `${theme.id} connector ${r.id} contrast`).toBeGreaterThanOrEqual(1.5);
        expect(r.ratio, `${theme.id} connector ${r.id} contrast`).toBeLessThanOrEqual(3.0);
      }
    }
  }
});
