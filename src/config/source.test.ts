import { describe, expect, it } from 'vitest';
import { buildSearch, isAllowedSrc, resolveSource, sheetCsvUrl, RESOLVE_ERRORS } from './source';

const ID = '2PACX-1vT4xAbCdEfGhIjKlMnOpQrStUvWxYz'; // ≥20 chars after "2PACX-"

describe('resolveSource', () => {
  it('?sheet= reconstructs the published CSV URL', () => {
    const r = resolveSource(`?sheet=${ID}`, '/');
    expect(r).toMatchObject({
      status: 'source',
      source: {
        kind: 'sheet',
        csvUrl: `https://docs.google.com/spreadsheets/d/e/${ID}/pub?output=csv`,
        displayName: 'Family Tree',
        settingsKey: `sheet:${ID}`,
        canonicalSearch: `?sheet=${ID}`,
        registryKey: `?sheet=${ID}`,
      },
    });
  });

  it('gid propagates into URL, settingsKey, and canonical search', () => {
    const r = resolveSource(`?sheet=${ID}&gid=42`, '/');
    expect(r).toMatchObject({
      status: 'source',
      source: {
        csvUrl: `https://docs.google.com/spreadsheets/d/e/${ID}/pub?output=csv&gid=42`,
        settingsKey: `sheet:${ID}:42`,
        canonicalSearch: `?sheet=${ID}&gid=42`,
      },
    });
  });

  it('gid=0 is omitted everywhere (Google default tab)', () => {
    const r = resolveSource(`?sheet=${ID}&gid=0`, '/');
    expect(r).toMatchObject({
      status: 'source',
      source: {
        csvUrl: `https://docs.google.com/spreadsheets/d/e/${ID}/pub?output=csv`,
        settingsKey: `sheet:${ID}`,
        canonicalSearch: `?sheet=${ID}`,
      },
    });
  });

  it('name sets displayName and appears in canonical search but not registryKey', () => {
    const r = resolveSource(`?sheet=${ID}&name=Smith+Family`, '/');
    expect(r).toMatchObject({
      status: 'source',
      source: {
        displayName: 'Smith Family',
        canonicalSearch: `?sheet=${ID}&name=Smith+Family`,
        registryKey: `?sheet=${ID}`,
      },
    });
  });

  it('non-2PACX sheet value → error', () => {
    expect(resolveSource('?sheet=not-a-publish-id', '/')).toEqual({ status: 'error', message: RESOLVE_ERRORS.sheetId });
  });

  it('too-short 2PACX id → error (20-char floor)', () => {
    expect(resolveSource('?sheet=2PACX-short', '/')).toEqual({ status: 'error', message: RESOLVE_ERRORS.sheetId });
  });

  it('non-numeric gid → error', () => {
    expect(resolveSource(`?sheet=${ID}&gid=abc`, '/')).toEqual({ status: 'error', message: RESOLVE_ERRORS.gid });
  });

  it('?src= https URL is used verbatim', () => {
    const url = 'https://example.com/data.csv?x=1&y=2';
    const search = `?${new URLSearchParams({ src: url, name: 'X' })}`;
    const r = resolveSource(search, '/');
    expect(r).toMatchObject({
      status: 'source',
      source: {
        kind: 'src',
        csvUrl: url,
        displayName: 'X',
        settingsKey: `src:${url}`,
        canonicalSearch: `?${new URLSearchParams({ src: url, name: 'X' })}`,
        registryKey: `?${new URLSearchParams({ src: url })}`,
      },
    });
  });

  it('src round-trips through its own canonical search (URLs containing ?/& survive)', () => {
    const url = 'https://example.com/a.csv?a=1&gid=9';
    const first = resolveSource(`?${new URLSearchParams({ src: url })}`, '/');
    expect(first.status).toBe('source');
    const again = resolveSource((first as { source: { canonicalSearch: string } }).source.canonicalSearch, '/');
    expect(again).toMatchObject({ status: 'source', source: { csvUrl: url } });
  });

  it('http src allowed for localhost and 127.0.0.1 only', () => {
    expect(resolveSource(`?${new URLSearchParams({ src: 'http://localhost:8787/a.csv' })}`, '/').status).toBe('source');
    expect(resolveSource(`?${new URLSearchParams({ src: 'http://127.0.0.1:8787/a.csv' })}`, '/').status).toBe('source');
    expect(resolveSource(`?${new URLSearchParams({ src: 'http://evil.example/a.csv' })}`, '/'))
      .toEqual({ status: 'error', message: RESOLVE_ERRORS.srcNotHttps });
  });

  it('non-URL src → error', () => {
    expect(resolveSource('?src=hello%20there', '/')).toEqual({ status: 'error', message: RESOLVE_ERRORS.srcNotHttps });
  });

  it('sheet wins over src', () => {
    const r = resolveSource(`?src=${encodeURIComponent('https://x.example/a.csv')}&sheet=${ID}`, '/');
    expect(r).toMatchObject({ status: 'source', source: { kind: 'sheet' } });
  });

  it('?family=demo (any case) → bundled demo with baseUrl; never saved', () => {
    const r = resolveSource('?family=DeMo', '/repo/');
    expect(r).toMatchObject({
      status: 'source',
      source: {
        kind: 'demo', csvUrl: '/repo/sample-data.csv', displayName: 'Demo Family',
        settingsKey: 'demo', canonicalSearch: '?family=demo', registryKey: null,
      },
    });
  });

  it('unknown family → error', () => {
    expect(resolveSource('?family=smith', '/')).toEqual({ status: 'error', message: RESOLVE_ERRORS.unknownFamily });
  });

  it('no params → none (dialog)', () => {
    expect(resolveSource('', '/')).toEqual({ status: 'none' });
    expect(resolveSource('?utm_source=x', '/')).toEqual({ status: 'none' });
  });
});

describe('buildSearch / sheetCsvUrl / isAllowedSrc', () => {
  it('buildSearch produces URLSearchParams-encoded canonical strings', () => {
    expect(buildSearch({ type: 'sheet', id: ID, gid: 42 }, 'Smith Family')).toBe(`?sheet=${ID}&gid=42&name=Smith+Family`);
    expect(buildSearch({ type: 'sheet', id: ID })).toBe(`?sheet=${ID}`);
    expect(buildSearch({ type: 'src', url: 'https://x.example/a.csv' }))
      .toBe(`?${new URLSearchParams({ src: 'https://x.example/a.csv' })}`);
  });
  it('sheetCsvUrl omits falsy gid', () => {
    expect(sheetCsvUrl(ID)).toBe(`https://docs.google.com/spreadsheets/d/e/${ID}/pub?output=csv`);
    expect(sheetCsvUrl(ID, 7)).toBe(`https://docs.google.com/spreadsheets/d/e/${ID}/pub?output=csv&gid=7`);
  });
  it('isAllowedSrc', () => {
    expect(isAllowedSrc('https://any.host/x.csv')).toBe(true);
    expect(isAllowedSrc('http://localhost:1234/x.csv')).toBe(true);
    expect(isAllowedSrc('http://sub.localhost.evil/x.csv')).toBe(false);
    expect(isAllowedSrc('ftp://x/x.csv')).toBe(false);
    expect(isAllowedSrc('not a url')).toBe(false);
  });
});
