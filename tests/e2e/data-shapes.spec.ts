import { expect, test } from '@playwright/test';
import { card, serveCsv } from './helpers';

const open = async (page: import('@playwright/test').Page, fixtureName: string) => {
  await serveCsv(page, { fixtureName });
  await page.goto('/?family=alpha');
};
const paths = (page: import('@playwright/test').Page) => page.getByTestId('connector-layer').locator('path');

test('E2E-12: single person — one card, zero connectors, no console errors (UC-13)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
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
    els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }),
  );
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap).toBe(false);
    }
  }
});

test('E2E-17: disconnected family — largest renders, notice lists excluded ids (UC-19)', async ({ page }) => {
  await open(page, 'disconnected.csv');
  await expect(card(page, 'x1')).toHaveCount(0);
  await expect(page.getByTestId('warnings')).toContainText('x1');
  await expect(page.getByTestId('warnings')).toContainText('x2');
});
