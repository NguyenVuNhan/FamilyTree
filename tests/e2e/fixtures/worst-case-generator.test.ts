import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStaircase } from '../../../src/data/staircase-parser';
import { buildModel } from '../../../src/data/build-model';
import { generateDense, generateWorstCase } from './worst-case-generator';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('stair-worst-200 fixture', () => {
  it('committed file equals generator output (byte equality, E2E-P7 guard)', () => {
    expect(readFileSync(join(__dirname, 'stair-worst-200.csv'), 'utf-8')).toBe(generateWorstCase());
  });
  it('200 people, zero errors, one component', () => {
    const { rows, errors } = parseStaircase(generateWorstCase());
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(200);
    const model = buildModel(rows);
    expect(model.excludedIds).toEqual([]);
  });
  it('embeds the degenerate shapes', () => {
    const csv = generateWorstCase();
    expect(csv).toMatch(/–\)?"?,/); // partnerless trailing separator
    expect(csv).toMatch(/\(\d{4}–\d{4}\)/); // full years
    expect(csv).toMatch(/\(\d{4}\)/); // birth-only
    expect(csv).toMatch(/\(–\d{4}\)/); // death-only
    expect(csv).toContain(',,,,,'); // spacing row
  });
});

// stair-worst-200.csv is deliberately unfittable at every format the app supports (its
// dense branch alone needs ~2756mm of content height, vs. a 1200mm custom-format
// ceiling) — see flow-layout.ts's leaf-run-wrap limitation noted in worst-case-generator.ts.
// The pre-press specs (legibility floor, connector/text collision, safe margin, export
// determinism) need a fixture that's actually exportable, so they run against this
// structurally different, shallow/wide sibling instead — target=28 (35 people total) was
// picked empirically as the largest that comfortably fits panorama (1200×600mm) at a
// 60mm margin: measured content height ≈460mm against a ≈480mm budget, a fixed set of
// people/rows we can byte-guard the same way as stair-worst-200.
describe('stair-dense-35 fixture', () => {
  it('committed file equals generator output (byte equality)', () => {
    expect(readFileSync(join(__dirname, 'stair-dense-35.csv'), 'utf-8')).toBe(generateDense(28));
  });
  it('35 people, zero errors, one component', () => {
    const { rows, errors } = parseStaircase(generateDense(28));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(35);
    const model = buildModel(rows);
    expect(model.excludedIds).toEqual([]);
  });
  it('embeds the degenerate shapes (partnerless row, mixed years, spacing, long names)', () => {
    const csv = generateDense(28);
    expect(csv).toMatch(/–"?,/); // partnerless trailing separator
    expect(csv).toMatch(/\(\d{4}–\d{4}\)/); // full years
    expect(csv).toMatch(/\(\d{4}\)/); // birth-only
    expect(csv).toMatch(/\(–\d{4}\)/); // death-only
    expect(csv).toContain(',,,,,'); // spacing row
    const longNames = csv.split('\n').filter((l) => l.split(' ').length >= 5);
    expect(longNames.length).toBeGreaterThanOrEqual(5);
  });
});
