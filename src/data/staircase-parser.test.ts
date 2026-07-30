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

describe('parseStaircase — couples and separators', () => {
  it('splits "Name + Partner" into two persons wired as a couple', () => {
    const { rows } = parseStaircase('Đời 1,Image\nAnn Lee + Bob Lee,');
    expect(rows).toEqual([
      { rowNumber: 2, id: 'r2', fullName: 'Ann Lee', image: '', partnerId: 'r2p', parentIds: [] },
      { rowNumber: 2, id: 'r2p', fullName: 'Bob Lee', image: '', partnerId: '', parentIds: [] },
    ]);
  });

  it('splits on an en-dash too, and on the FIRST separator only', () => {
    const { rows } = parseStaircase('Đời 1,Image\nVõ Thị Ánh – Lê Văn Sinh + Extra,');
    expect(rows[0].fullName).toBe('Võ Thị Ánh');
    expect(rows[1].fullName).toBe('Lê Văn Sinh + Extra');
  });

  it('plain hyphens are not separators (names may contain them)', () => {
    const { rows } = parseStaircase('Đời 1,Image\nMai-Anh Lee,');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ fullName: 'Mai-Anh Lee', partnerId: '' }));
  });

  it('keeps parenthesized years / alternate names verbatim', () => {
    const { rows } = parseStaircase('Đời 1,Image\nVõ Như Thôi (1932) + Nguyễn Thị Nga (1936),');
    expect(rows[0].fullName).toBe('Võ Như Thôi (1932)');
    expect(rows[1].fullName).toBe('Nguyễn Thị Nga (1936)');
  });

  it('a trailing separator with no partner name is lenient — no partner, no error', () => {
    const { rows, errors } = parseStaircase('Đời 1,Image\nVõ Thị Thành –,');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ fullName: 'Võ Thị Thành', partnerId: '' }));
  });

  it('PartnerImage lands on the partner person', () => {
    const { rows } = parseStaircase('Đời 1,Image,PartnerImage\nAnn Lee + Bob Lee,https://x.test/a.jpg,https://x.test/b.jpg');
    expect(rows[0].image).toBe('https://x.test/a.jpg');
    expect(rows[1].image).toBe('https://x.test/b.jpg');
  });

  it('handles quoted cells containing commas (data URIs)', () => {
    const { rows } = parseStaircase('Đời 1,Image\nAnn Lee,"data:image/png;base64,iVBORw0KGgo="');
    expect(rows[0].image).toBe('data:image/png;base64,iVBORw0KGgo=');
  });
});
