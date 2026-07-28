import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv-parser';
import { validateRows } from './validate';

const H = 'ID,FullName,Image,PartnerID,ParentIDs';
const v = (csv: string) => validateRows(parseCsv(csv));

describe('validateRows errors', () => {
  it('clean 3-gen family → no errors, no warnings', () => {
    const r = v(`${H}
margaret,Margaret Ellis,,robert,
robert,Robert Ellis,,,
david,David Ellis,,sarah,margaret;robert
sarah,Sarah Park,,,
emma,Emma Ellis,,,david;sarah`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('duplicate id', () => {
    const r = v(`${H}\na,Ann,,,\na,Bob,,,`);
    expect(r.errors.some((e) => e.message.includes('Duplicate ID "a"') && e.row === 3)).toBe(true);
  });

  it('unknown PartnerID reference', () => {
    const r = v(`${H}\na,Ann,,ghost,`);
    expect(r.errors.some((e) => e.message.includes('PartnerID "ghost"') && e.row === 2)).toBe(true);
  });

  it('unknown ParentIDs reference', () => {
    const r = v(`${H}\na,Ann,,,ghost`);
    expect(r.errors.some((e) => e.message.includes('ParentIDs "ghost"') && e.row === 2)).toBe(true);
  });

  it('missing FullName', () => {
    const r = v(`${H}\na,,,,`);
    expect(r.errors.some((e) => e.message.includes('missing FullName') && e.row === 2)).toBe(true);
  });

  it('more than 2 parents', () => {
    const r = v(`${H}\na,Ann,,,\nb,Bob,,,\nc,Cid,,,\nkid,Kid,,,a;b;c`);
    expect(r.errors.some((e) => e.message.includes('more than 2') && e.row === 5)).toBe(true);
  });

  it('asymmetric partner links (A→B while B→C)', () => {
    const r = v(`${H}\na,Ann,,b,\nb,Bob,,c,\nc,Cid,,,`);
    expect(r.errors.some((e) => e.message.includes('conflicting partner'))).toBe(true);
  });

  it('remarriage shape: two rows claim the same partner, naming both rows', () => {
    const r = v(`${H}\nanna,Anna,,,\nbob,Bob,,anna,\ncarl,Carl,,anna,`);
    const err = r.errors.find((e) => e.message.includes('"anna"'));
    expect(err?.message).toMatch(/bob.*row 3.*carl.*row 4/s);
  });

  it('ancestry cycle', () => {
    const r = v(`${H}\na,Ann,,,b\nb,Bob,,,a`);
    expect(r.errors.some((e) => e.message.toLowerCase().includes('cycle'))).toBe(true);
  });

  it('remarriage shape with 3+ claimants: every claimant is named', () => {
    const r = v(`${H}\nanna,Anna,,,\nbob,Bob,,anna,\ncarl,Carl,,anna,\ndan,Dan,,anna,`);
    const err = r.errors.find((e) => e.message.includes('"anna"'));
    expect(err?.message).toMatch(/bob.*row 3.*carl.*row 4.*dan.*row 5/s);
  });
});

describe('validateRows implicit unions (ParentIDs pairs)', () => {
  it('explicit partner a-b + child ParentIDs a;c → error naming a, both partners, both rows', () => {
    const r = v(`${H}\na,Ann,,b,\nb,Bob,,,\nc,Cid,,,\nkid,Kid,,,a;c`);
    const err = r.errors.find((e) => e.message.includes('"a"') && e.message.includes('unions'));
    expect(err?.message).toMatch(/"b".*row 2.*"c".*row 5/s);
  });

  it('two children with ParentIDs a;b and a;c (no PartnerIDs) → error', () => {
    const r = v(`${H}\na,Ann,,,\nb,Bob,,,\nc,Cid,,,\nkid1,Kid1,,,a;b\nkid2,Kid2,,,a;c`);
    const err = r.errors.find((e) => e.message.includes('"a"') && e.message.includes('unions'));
    expect(err?.message).toMatch(/"b".*row 5.*"c".*row 6/s);
  });

  it('no false positive: explicit partner a-b + child ParentIDs a;b (same pair) → clean', () => {
    const r = v(`${H}\na,Ann,,b,\nb,Bob,,,\nkid,Kid,,,a;b`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('single-parent overlap: ParentIDs a (lone) while a has partner b → error', () => {
    const r = v(`${H}\na,Ann,,b,\nb,Bob,,,\nkid,Kid,,,a`);
    const err = r.errors.find((e) => e.message.includes('"a"') && e.message.includes('unions'));
    expect(err?.message).toMatch(/"b".*row 2.*lone parent.*row 4/s);
  });

  it('single parent with no other union → clean', () => {
    const r = v(`${H}\na,Ann,,,\nkid,Kid,,,a`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

describe('validateRows warnings', () => {
  it('invalid image → warning with row, not error', () => {
    const r = v(`${H}\na,Ann,not-an-image!!,,`);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.message.includes('image') && w.row === 2)).toBe(true);
  });

  it('ids differing only by case → warning', () => {
    const r = v(`${H}\nrobert,Rob,,,\nROBERT2,Rob2,,,\nRobert,Other Rob,,,`);
    expect(r.warnings.some((w) => w.message.includes('only by letter case'))).toBe(true);
  });
});
