import { describe, expect, it } from 'vitest';
import { parseCsv, UnreadableCsvError } from './csv-parser';

const HEADER = 'ID,FullName,Image,PartnerID,ParentIDs';

describe('parseCsv', () => {
  it('parses rows with 1-based sheet row numbers (header = 1)', () => {
    const rows = parseCsv(`${HEADER}\nmargaret,Margaret Ellis,,robert,\nrobert,Robert Ellis,,,`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      rowNumber: 2, id: 'margaret', fullName: 'Margaret Ellis', image: '', gender: '', partnerId: 'robert', parentIds: [],
    });
    expect(rows[1].rowNumber).toBe(3);
  });

  it('splits ParentIDs on ";" and trims every field', () => {
    const rows = parseCsv(`${HEADER}\n dave , Dave Ellis ,, , margaret ; robert `);
    expect(rows[0].id).toBe('dave');
    expect(rows[0].fullName).toBe('Dave Ellis');
    expect(rows[0].parentIds).toEqual(['margaret', 'robert']);
  });

  it('handles quoted names containing commas', () => {
    const rows = parseCsv(`${HEADER}\na,"Ellis, Margaret",,,`);
    expect(rows[0].fullName).toBe('Ellis, Margaret');
  });

  it('matches headers case-insensitively and skips blank lines', () => {
    const rows = parseCsv('id,fullname,image,partnerid,parentids\na,Ann,,,\n\n');
    expect(rows).toHaveLength(1);
  });

  it('keeps rows with missing name (validator reports them, with correct row number)', () => {
    const rows = parseCsv(`${HEADER}\na,,,,`);
    expect(rows[0].fullName).toBe('');
  });

  it('throws UnreadableCsvError when required headers are missing (HTML error page)', () => {
    expect(() => parseCsv('<!doctype html><html>Sorry</html>')).toThrow(UnreadableCsvError);
    expect(() => parseCsv('Name,Notes\nBob,hi')).toThrow(UnreadableCsvError);
  });

  it('skips comma-only blank rows (all fields empty after trimming)', () => {
    const rows = parseCsv(`${HEADER}\nmargaret,Margaret Ellis,,robert,\n,,,,\nrobert,Robert Ellis,,,`);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('margaret');
    expect(rows[1].id).toBe('robert');
  });

  it('preserves true sheet row numbers across interior blank lines', () => {
    const rows = parseCsv(`${HEADER}\npersonA,Person A,,,\n,,,,\npersonB,Person B,,,`);
    expect(rows).toHaveLength(2);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[0].id).toBe('personA');
    expect(rows[1].rowNumber).toBe(4);
    expect(rows[1].id).toBe('personB');
  });

  it('parses an optional Gender column, trimmed; absent column yields empty string', () => {
    const rows = parseCsv('ID,FullName,Gender\na,Ann, F \nb,Bob,');
    expect(rows[0].gender).toBe('F');
    expect(rows[1].gender).toBe('');
    const noCol = parseCsv('ID,FullName\na,Ann');
    expect(noCol[0].gender).toBe('');
  });
});
