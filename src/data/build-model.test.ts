import { describe, expect, it } from 'vitest';
import type { PersonRow } from './types';
import { buildModel } from './build-model';

// buildModel is format-agnostic: build PersonRow[] directly, same as layout-engine.test.ts.
const P = (rowNumber: number, id: string, o: Partial<PersonRow> = {}): PersonRow => ({
  rowNumber, id, fullName: id.toUpperCase(), image: '', partnerId: '', parentIds: [], ...o,
});

describe('buildModel', () => {
  it('builds persons with resolved image src', () => {
    const model = buildModel([
      P(2, 'a', { fullName: 'Ann', image: 'https://x.test/a.jpg', partnerId: 'b' }),
      P(3, 'b', { fullName: 'Bob' }),
    ]);
    expect(model.persons.get('a')).toEqual({ id: 'a', fullName: 'Ann', imageSrc: 'https://x.test/a.jpg' });
    expect(model.persons.get('b')).toEqual({ id: 'b', fullName: 'Bob' });
  });

  it('couple + children from partnerId and parentIds', () => {
    const model = buildModel([
      P(2, 'ma', { fullName: 'Ma', partnerId: 'pa' }),
      P(3, 'pa', { fullName: 'Pa' }),
      P(4, 'kid', { fullName: 'Kid', parentIds: ['ma', 'pa'] }),
    ]);
    expect(model.unions).toEqual([{ id: 'u:ma+pa', partners: ['ma', 'pa'], childIds: ['kid'] }]);
    expect(model.rootId).toBe('u:ma+pa');
  });

  it('parentIds pair implicitly forms a union without partnerId', () => {
    const model = buildModel([
      P(2, 'ma', { fullName: 'Ma' }),
      P(3, 'pa', { fullName: 'Pa' }),
      P(4, 'kid', { fullName: 'Kid', parentIds: ['ma', 'pa'] }),
    ]);
    expect(model.unions).toEqual([{ id: 'u:ma+pa', partners: ['ma', 'pa'], childIds: ['kid'] }]);
  });

  it('single parent forms a one-partner union', () => {
    const model = buildModel([
      P(2, 'ma', { fullName: 'Ma' }),
      P(3, 'kid', { fullName: 'Kid', parentIds: ['ma'] }),
    ]);
    expect(model.unions).toEqual([{ id: 'u:ma', partners: ['ma'], childIds: ['kid'] }]);
  });

  it('couple with no children still forms a union (marriage line)', () => {
    const model = buildModel([
      P(2, 'a', { fullName: 'Ann', partnerId: 'b' }),
      P(3, 'b', { fullName: 'Bob' }),
    ]);
    expect(model.unions).toEqual([{ id: 'u:a+b', partners: ['a', 'b'], childIds: [] }]);
  });

  it('single person → lone root, no unions', () => {
    const model = buildModel([P(2, 'a', { fullName: 'Ann' })]);
    expect(model.unions).toEqual([]);
    expect(model.rootId).toBe('p:a');
    expect(model.excludedIds).toEqual([]);
  });

  it('keeps the largest component, excludes the rest (sorted)', () => {
    const model = buildModel([
      P(2, 'ma', { fullName: 'Ma', partnerId: 'pa' }),
      P(3, 'pa', { fullName: 'Pa' }),
      P(4, 'k1', { fullName: 'K1', parentIds: ['ma', 'pa'] }),
      P(5, 'k2', { fullName: 'K2', parentIds: ['ma', 'pa'] }),
      P(6, 'zz', { fullName: 'Loner Z' }),
      P(7, 'aa', { fullName: 'Loner A' }),
    ]);
    expect(model.excludedIds).toEqual(['aa', 'zz']);
    expect(model.persons.has('zz')).toBe(false);
    expect(model.persons.size).toBe(4);
  });

  it('children keep sheet order within a union', () => {
    const model = buildModel([
      P(2, 'ma', { fullName: 'Ma' }),
      P(3, 'z', { fullName: 'Zed', parentIds: ['ma'] }),
      P(4, 'a', { fullName: 'Ann', parentIds: ['ma'] }),
    ]);
    expect(model.unions[0].childIds).toEqual(['z', 'a']);
  });

  it('tie-break: earlier sheet row wins when components are equal size', () => {
    const model = buildModel([
      P(2, 'z', { fullName: 'Zed' }),
      P(3, 'a', { fullName: 'Ann' }),
    ]);
    expect(model.excludedIds).toEqual(['a']);
    expect(model.rootId).toBe('p:z');
  });
});
