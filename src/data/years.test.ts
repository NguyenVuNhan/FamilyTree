import { describe, expect, it } from 'vitest';
import { extractYears, formatYears } from './years';

describe('extractYears', () => {
  it.each([
    ['Nguyễn Văn Trường (1928–1996)', 'Nguyễn Văn Trường', 1928, 1996],
    ['Trần Thị Hồng Gấm (1932-2011)', 'Trần Thị Hồng Gấm', 1932, 2011], // plain hyphen inside parens ok
    ['Lê Thị Cúc (1950)', 'Lê Thị Cúc', 1950, undefined],
    ['Lê Thị Cúc (1950–)', 'Lê Thị Cúc', 1950, undefined],
    ['Phạm Văn Hai (–2001)', 'Phạm Văn Hai', undefined, 2001],
  ])('%s → clean name + years', (input, clean, birth, death) => {
    expect(extractYears(input)).toEqual({
      cleanName: clean,
      ...(birth !== undefined ? { birthYear: birth } : {}),
      ...(death !== undefined ? { deathYear: death } : {}),
    });
  });

  it.each([
    'Nguyễn (Bé) Văn An',        // parens not trailing
    'Trần Thị Mai (thứ ba)',     // trailing parens, not a year shape
    'Võ Văn Tư (195)',           // 3 digits is not a year
    'Plain Name',
  ])('non-year parens stay in the name verbatim: %s', (input) => {
    expect(extractYears(input)).toEqual({ cleanName: input });
  });

  it('only the TRAILING parens are considered', () => {
    expect(extractYears('Ngô (Bé) Thị Lan (1940–1990)')).toEqual({
      cleanName: 'Ngô (Bé) Thị Lan', birthYear: 1940, deathYear: 1990,
    });
  });
});

describe('formatYears', () => {
  it('formats both / birth / death / none', () => {
    expect(formatYears(1950, 2001)).toBe('1950–2001');
    expect(formatYears(1950, undefined)).toBe('b. 1950');
    expect(formatYears(undefined, 2001)).toBe('d. 2001');
    expect(formatYears(undefined, undefined)).toBeNull();
  });
});
