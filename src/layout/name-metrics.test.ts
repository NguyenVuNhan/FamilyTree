import { describe, expect, it } from 'vitest';
import { canvasMeasurer, lineCount, maxNameLines } from './name-metrics';

const perChar = (text: string) => text.length * 10; // deterministic fake: 10px per char (spaces too)

describe('lineCount', () => {
  it('short name fits one line', () => {
    expect(lineCount('Ann', 100, perChar)).toBe(1);
  });
  it('wraps greedily on word boundaries', () => {
    // 'Nguyễn Thị' = 100 ≤ 100 → line 1; 'Ngọc Ánh' = 80 → line 2
    expect(lineCount('Nguyễn Thị Ngọc Ánh', 100, perChar)).toBe(2);
  });
  it('breaks an over-long single word at character level', () => {
    expect(lineCount('Supercalifragilistic', 100, perChar)).toBe(2); // 200px over 100px lines
  });
  it('empty and whitespace-only names count as one line', () => {
    expect(lineCount('', 100, perChar)).toBe(1);
    expect(lineCount('   ', 100, perChar)).toBe(1);
  });
});

describe('maxNameLines', () => {
  it('takes the max across the family, floor 1', () => {
    expect(maxNameLines(['Ann', 'Nguyễn Thị Ngọc Ánh'], 100, perChar)).toBe(2);
    expect(maxNameLines([], 100, perChar)).toBe(1);
  });
});

describe('canvasMeasurer', () => {
  it('falls back to a per-char estimate when canvas 2D is unavailable (jsdom)', () => {
    const measure = canvasMeasurer('600 13.5px sans-serif');
    expect(measure('abcd')).toBe(32); // 4 × 8
  });
});
