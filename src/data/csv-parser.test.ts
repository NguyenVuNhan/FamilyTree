import { describe, expect, it } from 'vitest';
import { parseCsv, UnreadableCsvError } from './csv-parser';

const HEADER = 'ID,FullName,Image,PartnerID,ParentIDs';

describe('parseCsv', () => {
  it('parses rows with 1-based sheet row numbers (header = 1)', () => {
    const rows = parseCsv(`${HEADER}\nmargaret,Margaret Ellis,,robert,\nrobert,Robert Ellis,,,`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      rowNumber: 2, id: 'margaret', fullName: 'Margaret Ellis', image: '', partnerId: 'robert', parentIds: [],
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
});
