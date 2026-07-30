import { expect, test } from '@playwright/test';
import { card, serveCsv } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.route('https://img.example/**', (r) => r.abort()); // disconnected.csv carries margaret's image URL
});

const open = async (page: import('@playwright/test').Page, fixtureName: string) => {
  await serveCsv(page, { fixtureName });
  await page.goto('/?family=alpha');
};
const paths = (page: import('@playwright/test').Page) => page.getByTestId('connector-layer').locator('path');

test('E2E-12: single person — one card, zero connectors, no console/page errors (UC-13)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'single.csv');
  await expect(page.locator('.person-card')).toHaveCount(1);
  await expect(paths(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('E2E-13: couple only — two cards, exactly one line (UC-14)', async ({ page }) => {
  await open(page, 'couple-only.csv');
  await expect(page.locator('.person-card')).toHaveCount(2);
  await expect(paths(page)).toHaveCount(1);
});

test('E2E-14: single parent + 2 children — 2 drops, no marriage line (UC-15)', async ({ page }) => {
  await open(page, 'single-parent.csv');
  await expect(page.locator('.person-card')).toHaveCount(3);
  await expect(paths(page)).toHaveCount(2);
});

test('E2E-15: 5-generation chain renders and fits (UC-16)', async ({ page }) => {
  await open(page, 'chain5.csv');
  await expect(page.locator('.person-card')).toHaveCount(5);
  const vp = (await page.getByTestId('viewport').boundingBox())!;
  const canvas = (await page.locator('.tree-canvas').boundingBox())!;
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(vp.y + vp.height + 1);
});

test('E2E-16: 9 siblings — no overlapping cards, parents centered (UC-17)', async ({ page }) => {
  await open(page, 'wide9.csv');
  const boxes = await page.locator('.person-card').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute('data-person-id'), x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap).toBe(false);
    }
  }

  // parents centered: the union's own midpoint (between ma/pa) must line up with the
  // midpoint of the 9-child span — layout-engine.ts centers both the union and its
  // children within the same slot width, so these are analytically identical (mod
  // floating rounding), regardless of the fit-to-view scale applied on top.
  // Both midpoints are derived from the single `boxes` snapshot above (not fresh
  // boundingBox() calls) — separate round-trips raced the fit-to-view transform
  // settling and produced spurious ~100px+ diffs under repeated/parallel runs.
  const maBox = boxes.find((b) => b.id === 'r2')!;
  const paBox = boxes.find((b) => b.id === 'r2p')!;
  const parentMid = ((maBox.x + maBox.w / 2) + (paBox.x + paBox.w / 2)) / 2;
  const childBoxes = boxes.filter((b) => b.id !== 'r2' && b.id !== 'r2p');
  expect(childBoxes).toHaveLength(9);
  const spanLeft = Math.min(...childBoxes.map((b) => b.x));
  const spanRight = Math.max(...childBoxes.map((b) => b.x + b.w));
  const childrenMid = (spanLeft + spanRight) / 2;
  expect(Math.abs(parentMid - childrenMid)).toBeLessThan(2);
});

test('E2E-17: disconnected family — largest renders, notice lists excluded ids (UC-19)', async ({ page }) => {
  await open(page, 'disconnected.csv');
  await expect(card(page, 'r5')).toHaveCount(0);
  await expect(page.getByTestId('warnings')).toContainText('Lost One');
  await expect(page.getByTestId('warnings')).toContainText('Lost Two');
});
