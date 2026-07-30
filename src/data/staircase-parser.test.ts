import { describe, expect, it } from 'vitest';
import { parseStaircase, UnreadableSheetError } from './staircase-parser';

describe('parseStaircase — header classification', () => {
  it('parses a single person with a synthesized id and true sheet row number', () => {
    const { rows, errors, warnings } = parseStaircase('Đời 1,Image\nAnn Lee,');
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(rows).toEqual([{ rowNumber: 2, id: 'r2', fullName: 'Ann Lee', image: '', partnerId: '', parentIds: [] }]);
  });

  it('matches reserved headers case-insensitively and maps Image cells', () => {
    const { rows } = parseStaircase('Đời 1,IMAGE\nAnn Lee,https://x.test/a.jpg');
    expect(rows[0].image).toBe('https://x.test/a.jpg');
  });

  it('free-text generation headers work (any language, any label)', () => {
    const { rows } = parseStaircase('Generation One,Image\nAnn Lee,');
    expect(rows).toHaveLength(1);
  });

  it('throws UnreadableSheetError without an Image column (HTML page, arbitrary CSV, empty file)', () => {
    expect(() => parseStaircase('<!doctype html><html>Sorry</html>')).toThrow(UnreadableSheetError);
    expect(() => parseStaircase('Name,Notes\nBob,hi')).toThrow(UnreadableSheetError);
    expect(() => parseStaircase('')).toThrow(UnreadableSheetError);
  });

  it('throws UnreadableSheetError when there are no generation columns', () => {
    expect(() => parseStaircase('Image,PartnerImage\n,')).toThrow(UnreadableSheetError);
  });

  it('header-only sheet → zero rows, zero errors (empty state upstream)', () => {
    const { rows, errors } = parseStaircase('Đời 1,Đời 2,Image');
    expect(rows).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('ignores columns with empty header labels (trailing commas in the header row)', () => {
    const { rows, errors } = parseStaircase('Đời 1,Image,,\nAnn Lee,,,');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });
});
