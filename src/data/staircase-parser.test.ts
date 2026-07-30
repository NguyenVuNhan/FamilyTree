import { describe, expect, it } from 'vitest';
import { parseStaircase, UnreadableSheetError } from './staircase-parser';
import { buildModel } from './build-model';
import { layoutTree, unplacedIds } from '../layout/layout-engine';
import { DEFAULT_METRICS } from '../layout/card-metrics';

describe('parseStaircase — header classification', () => {
  it('parses a single person with a synthesized id and true sheet row number', () => {
    const { rows, errors, warnings } = parseStaircase('Đời 1,Image\nAnn Lee,');
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(rows).toEqual([{ rowNumber: 2, id: 'r2', fullName: 'Ann Lee', image: '', gender: '', partnerId: '', parentIds: [] }]);
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
      { rowNumber: 2, id: 'r2', fullName: 'Ann Lee', image: '', gender: '', partnerId: 'r2p', parentIds: [] },
      { rowNumber: 2, id: 'r2p', fullName: 'Bob Lee', image: '', gender: '', partnerId: '', parentIds: [] },
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

  it('Gender and PartnerGender reserved columns land on the person and partner rows', () => {
    const { rows } = parseStaircase('Đời 1,Image,Gender,PartnerGender\nAnn Lee + Bob Lee,,f,nam');
    expect(rows[0].gender).toBe('f');
    expect(rows[1].gender).toBe('nam');
  });

  it('stray gender cells (spacing row or partner-less row) are ignored silently', () => {
    const { rows, errors, warnings } = parseStaircase('Đời 1,Image,Gender,PartnerGender\nAnn Lee,,f,m\n,,f,');
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]); // PartnerGender without partner and gender-only spacing row: soft metadata, no noise
    expect(rows).toHaveLength(1);
    expect(rows[0].gender).toBe('f');
  });

  it('handles quoted cells containing commas (data URIs)', () => {
    const { rows } = parseStaircase('Đời 1,Image\nAnn Lee,"data:image/png;base64,iVBORw0KGgo="');
    expect(rows[0].image).toBe('data:image/png;base64,iVBORw0KGgo=');
  });
});

describe('parseStaircase — positional parent resolution', () => {
  const SHEET = [
    'Đời 1,Đời 2,Đời 3,Image',
    'Võ Như Thôi (1932) + Nguyễn Thị Nga (1936),,,', // row 2
    ',Võ Như Ái + Kiều Thị Nhi,,',                    // row 3
    ',,Võ Như Trung,',                                // row 4
    ',,Võ Như Sơn,',                                  // row 5
    ',Võ Thị Ánh,,',                                  // row 6 — steps back out
  ].join('\n');

  it('children attach to the nearest shallower row above (the Word-outline rule)', () => {
    const { rows, errors } = parseStaircase(SHEET);
    expect(errors).toEqual([]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('r3')!.parentIds).toEqual(['r2', 'r2p']); // Ái child of Thôi+Nga
    expect(byId.get('r4')!.parentIds).toEqual(['r3', 'r3p']); // Trung child of Ái+Nhi
    expect(byId.get('r5')!.parentIds).toEqual(['r3', 'r3p']); // Sơn = Trung's sibling
    expect(byId.get('r6')!.parentIds).toEqual(['r2', 'r2p']); // Ánh back out to Đời 2
  });

  it('a partner-less parent yields a single parent id', () => {
    const { rows } = parseStaircase('Đời 1,Đời 2,Image\nMona Lee,,\n,Kid One,');
    expect(rows[1].parentIds).toEqual(['r2']);
  });

  it('fully empty rows are spacing — skipped, row numbers preserved', () => {
    const { rows } = parseStaircase('Đời 1,Đời 2,Image\nAnn Lee,,\n,,\n,Kid One,');
    expect(rows.map((r) => [r.id, r.rowNumber])).toEqual([['r2', 2], ['r4', 4]]);
    expect(rows[1].parentIds).toEqual(['r2']);
  });

  it('two generation cells in one row → error naming both columns', () => {
    const { errors } = parseStaircase('Đời 1,Đời 2,Image\nAnn Lee,Bob Lee,');
    expect(errors).toEqual([
      { row: 2, message: 'Row 2 has people in both "Đời 1" and "Đời 2" — each row should use exactly one generation column' },
    ]);
  });

  it('first person row deeper than the first generation → must-start error', () => {
    const { errors } = parseStaircase('Đời 1,Đời 2,Image\n,Orphan Kid,');
    expect(errors).toEqual([{ row: 2, message: 'Row 2 is in "Đời 2" but the tree must start in "Đời 1"' }]);
  });

  it('depth jump deeper than parent+1 → did-you-mean error', () => {
    const { errors } = parseStaircase('Đời 1,Đời 2,Đời 3,Image\nAnn Lee,,,\n,,Deep Kid,');
    expect(errors).toEqual([
      { row: 3, message: 'Row 3 is in "Đời 3" but the row above it is in "Đời 1" — did you mean "Đời 2"?' },
    ]);
  });

  it('separator with no name before it → missing-name error', () => {
    const { errors } = parseStaircase('Đời 1,Image\n+ Ghost Partner,');
    expect(errors).toEqual([{ row: 2, message: 'Row 2 is missing the person\'s name before the "+"' }]);
  });

  it('collects every error in one pass; error rows never become parents', () => {
    const text = ['Đời 1,Đời 2,Image', 'Ann Lee,Bob Lee,', ',Kid One,', '+ Ghost,'].join('\n');
    const { rows, errors } = parseStaircase(text);
    expect(errors).toHaveLength(3); // two-cells, must-start (row 2 didn't enter the stack), missing-name
    expect(rows).toEqual([]);
  });

  it('image on a spacing row → warning, image ignored', () => {
    const { warnings, rows } = parseStaircase('Đời 1,Image\nAnn Lee,\n,https://x.test/lost.jpg');
    expect(rows).toHaveLength(1);
    expect(warnings).toEqual([{ row: 3, message: 'Row 3 has an image but no person — the image is ignored' }]);
  });

  it('partner image without a partner → warning, image ignored', () => {
    const { warnings, rows } = parseStaircase('Đời 1,Image,PartnerImage\nAnn Lee,,https://x.test/b.jpg');
    expect(rows).toHaveLength(1);
    expect(warnings).toEqual([{ row: 2, message: 'Row 2 has a partner image but no partner — the image is ignored' }]);
  });
});

describe('parseStaircase — unbounded generation depth', () => {
  it('25 generation columns parse, build, and lay out with nobody dropped', () => {
    const N = 25;
    const header = [...Array.from({ length: N }, (_, i) => `G${i + 1}`), 'Image'].join(',');
    const lines = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N + 1 }, (_, c) => (c === i ? `Person ${i + 1}` : '')).join(','),
    );
    const { rows, errors } = parseStaircase([header, ...lines].join('\n'));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(N);
    expect(rows[N - 1].parentIds).toEqual([`r${N}`]); // sheet row 26's parent is row 25's person

    const model = buildModel(rows);
    const layout = layoutTree(model, DEFAULT_METRICS);
    expect(unplacedIds(model, layout)).toEqual([]);
    expect(layout.cards).toHaveLength(N);
  });

  it('a generation column to the RIGHT of Image/PartnerImage is still the next-deeper generation', () => {
    const { rows, errors } = parseStaircase('Đời 1,Image,Đời 2\nAnn Lee,,\n,,Kid One');
    expect(errors).toEqual([]);
    expect(rows[1]).toEqual(expect.objectContaining({ id: 'r3', fullName: 'Kid One', parentIds: ['r2'] }));
  });
});
