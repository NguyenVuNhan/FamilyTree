import { describe, expect, it } from 'vitest';
import { parseSheetInput } from './parse-sheet-input';

const ID = '2PACX-1vT4xAbCdEfGhIjKlMnOpQrStUvWxYz';

describe('parseSheetInput', () => {
  it.each([
    [`https://docs.google.com/spreadsheets/d/e/${ID}/pub?output=csv`, { type: 'sheet', id: ID, gid: undefined }],
    [`https://docs.google.com/spreadsheets/d/e/${ID}/pubhtml`, { type: 'sheet', id: ID, gid: undefined }],
    [`https://docs.google.com/spreadsheets/d/e/${ID}/pubhtml?gid=123&single=true`, { type: 'sheet', id: ID, gid: 123 }],
    [`https://docs.google.com/spreadsheets/d/e/${ID}/pub?gid=5&single=true&output=csv`, { type: 'sheet', id: ID, gid: 5 }],
    [`https://docs.google.com/spreadsheets/d/e/${ID}/pub?gid=0&output=csv`, { type: 'sheet', id: ID, gid: undefined }], // gid 0 → default tab
    [ID, { type: 'sheet', id: ID, gid: undefined }],                       // bare publish ID
    [`  ${ID}  `, { type: 'sheet', id: ID, gid: undefined }],              // whitespace-tolerant
  ])('google/bare input %s → sheet', (input, expected) => {
    expect(parseSheetInput(input)).toEqual(expected);
  });

  it('any other https URL → src, kept verbatim', () => {
    const url = 'https://raw.example.com/tree.csv?token=a&b=2';
    expect(parseSheetInput(url)).toEqual({ type: 'src', url });
  });

  it('http localhost → src (dev carve-out)', () => {
    expect(parseSheetInput('http://localhost:8787/standard.csv'))
      .toEqual({ type: 'src', url: 'http://localhost:8787/standard.csv' });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['https://docs.google.com/spreadsheets/d/abc123/edit#gid=0', 'edit-url'],   // not published
    ['https://docs.google.com/spreadsheets/d/abc123/edit', 'edit-url'],
    ['http://evil.example/a.csv', 'insecure'],
    ['hello world', 'not-a-link'],
    ['2PACX-short', 'not-a-link'],                                              // fails the 20-char floor
    ['ftp://files.example/a.csv', 'not-a-link'],
  ])('input %j → invalid/%s', (input, reason) => {
    expect(parseSheetInput(input)).toEqual({ type: 'invalid', reason });
  });
});
