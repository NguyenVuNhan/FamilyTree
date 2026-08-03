import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStaircase } from '../../../src/data/staircase-parser';
import { buildModel } from '../../../src/data/build-model';
import { generateWorstCase } from './worst-case-generator';

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
