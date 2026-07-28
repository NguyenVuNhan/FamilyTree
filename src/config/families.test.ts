import { describe, expect, it } from 'vitest';
import { buildFamilies, filterFamilyEnv, resolveFamily } from './families';

const BASE = '/';

describe('buildFamilies', () => {
  it('returns only demo when nothing configured', () => {
    const fams = buildFamilies({}, BASE);
    expect(fams).toEqual([{ key: 'demo', displayName: 'Demo Family', csvUrl: '/sample-data.csv' }]);
  });

  it('pairs URL and NAME vars, lowercases key, sorts configured alphabetically, demo last', () => {
    const fams = buildFamilies({
      FAMILY_TREE_URL_ZULU: 'https://z.example/z.csv',
      FAMILY_TREE_NAME_ZULU: 'Zulu Family',
      FAMILY_TREE_URL_ALPHA: 'https://a.example/a.csv',
      FAMILY_TREE_NAME_ALPHA: 'Alpha Family',
    }, BASE);
    expect(fams.map((f) => f.key)).toEqual(['alpha', 'zulu', 'demo']);
    expect(fams[0]).toEqual({ key: 'alpha', displayName: 'Alpha Family', csvUrl: 'https://a.example/a.csv' });
  });

  it('ignores unrelated env vars', () => {
    expect(buildFamilies({ PATH: 'x', FAMILY_TREE_URL_A: 'u', FAMILY_TREE_NAME_A: 'A' }, BASE)).toHaveLength(2);
  });

  it('throws naming the incomplete pair when NAME is missing', () => {
    expect(() => buildFamilies({ FAMILY_TREE_URL_SMITH: 'u' }, BASE)).toThrow(/FAMILY_TREE_NAME_SMITH/);
  });

  it('throws naming the incomplete pair when URL is missing', () => {
    expect(() => buildFamilies({ FAMILY_TREE_NAME_SMITH: 'Smith' }, BASE)).toThrow(/FAMILY_TREE_URL_SMITH/);
  });

  it('throws when a configured family uses the reserved name DEMO', () => {
    expect(() => buildFamilies({ FAMILY_TREE_URL_DEMO: 'u', FAMILY_TREE_NAME_DEMO: 'D' }, BASE)).toThrow(/reserved/i);
  });

  it('builds demo csvUrl from baseUrl', () => {
    const fams = buildFamilies({}, '/FamilyTree/');
    expect(fams[0].csvUrl).toBe('/FamilyTree/sample-data.csv');
  });
});

describe('resolveFamily', () => {
  const fams = buildFamilies({
    FAMILY_TREE_URL_ALPHA: 'https://a.example/a.csv', FAMILY_TREE_NAME_ALPHA: 'Alpha Family',
    FAMILY_TREE_URL_BRAVO: 'https://b.example/b.csv', FAMILY_TREE_NAME_BRAVO: 'Bravo Family',
  }, '/');

  it('null param resolves to first configured family', () => {
    expect(resolveFamily(fams, null)?.key).toBe('alpha');
  });

  it('null param resolves to demo when nothing configured', () => {
    expect(resolveFamily(buildFamilies({}, '/'), null)?.key).toBe('demo');
  });

  it('matches case-insensitively', () => {
    expect(resolveFamily(fams, 'BrAvO')?.key).toBe('bravo');
  });

  it('returns undefined for unknown names', () => {
    expect(resolveFamily(fams, 'nope')).toBeUndefined();
  });
});

describe('filterFamilyEnv', () => {
  it('drops URL/NAME pairs whose suffix is not in the allow list', () => {
    const filtered = filterFamilyEnv({
      FAMILY_TREE_URL_ALPHA: 'a-url',
      FAMILY_TREE_NAME_ALPHA: 'Alpha',
      FAMILY_TREE_URL_ZZZ: 'decoy-url',
      FAMILY_TREE_NAME_ZZZ: 'Decoy',
    }, ['ALPHA', 'BRAVO']);
    expect(filtered).toEqual({ FAMILY_TREE_URL_ALPHA: 'a-url', FAMILY_TREE_NAME_ALPHA: 'Alpha' });
  });

  it('empty allow list drops every FAMILY_TREE_URL_/NAME_ pair', () => {
    const filtered = filterFamilyEnv({
      FAMILY_TREE_URL_ALPHA: 'a-url', FAMILY_TREE_NAME_ALPHA: 'Alpha',
    }, []);
    expect(filtered).toEqual({});
  });

  it('passes through unrelated keys unchanged', () => {
    const filtered = filterFamilyEnv({ FAMILY_TREE_E2E_ONLY: 'ALPHA', FOO: 'bar' }, ['ALPHA']);
    expect(filtered).toEqual({ FAMILY_TREE_E2E_ONLY: 'ALPHA', FOO: 'bar' });
  });

  it('allow-list match is case-insensitive on the suffix', () => {
    const filtered = filterFamilyEnv({ FAMILY_TREE_URL_ALPHA: 'u' }, ['alpha']);
    expect(filtered).toEqual({ FAMILY_TREE_URL_ALPHA: 'u' });
  });
});
