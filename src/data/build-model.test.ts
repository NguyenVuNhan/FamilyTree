import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv-parser';
import { buildModel } from './build-model';

const H = 'ID,FullName,Image,PartnerID,ParentIDs';
const m = (csv: string) => buildModel(parseCsv(csv));

describe('buildModel', () => {
  it('builds persons with resolved image src', () => {
    const model = m(`${H}\na,Ann,https://x.test/a.jpg,,\nb,Bob,,,`);
    expect(model.persons.get('a')).toEqual({ id: 'a', fullName: 'Ann', imageSrc: 'https://x.test/a.jpg' });
    expect(model.persons.get('b')).toEqual({ id: 'b', fullName: 'Bob' });
  });

  it('couple + children from PartnerID and ParentIDs', () => {
    const model = m(`${H}\nma,Ma,,pa,\npa,Pa,,,\nkid,Kid,,,ma;pa`);
    expect(model.unions).toEqual([{ id: 'u:ma+pa', partners: ['ma', 'pa'], childIds: ['kid'] }]);
    expect(model.rootId).toBe('u:ma+pa');
  });

  it('ParentIDs pair implicitly forms a union without PartnerID', () => {
    const model = m(`${H}\nma,Ma,,,\npa,Pa,,,\nkid,Kid,,,ma;pa`);
    expect(model.unions).toEqual([{ id: 'u:ma+pa', partners: ['ma', 'pa'], childIds: ['kid'] }]);
  });

  it('single parent forms a one-partner union', () => {
    const model = m(`${H}\nma,Ma,,,\nkid,Kid,,,ma`);
    expect(model.unions).toEqual([{ id: 'u:ma', partners: ['ma'], childIds: ['kid'] }]);
  });

  it('couple with no children still forms a union (marriage line)', () => {
    const model = m(`${H}\na,Ann,,b,\nb,Bob,,,`);
    expect(model.unions).toEqual([{ id: 'u:a+b', partners: ['a', 'b'], childIds: [] }]);
  });

  it('single person → lone root, no unions', () => {
    const model = m(`${H}\na,Ann,,,`);
    expect(model.unions).toEqual([]);
    expect(model.rootId).toBe('p:a');
    expect(model.excludedIds).toEqual([]);
  });

  it('keeps the largest component, excludes the rest (sorted)', () => {
    const model = m(`${H}
ma,Ma,,pa,
pa,Pa,,,
k1,K1,,,ma;pa
k2,K2,,,ma;pa
zz,Loner Z,,,
aa,Loner A,,,`);
    expect(model.excludedIds).toEqual(['aa', 'zz']);
    expect(model.persons.has('zz')).toBe(false);
    expect(model.persons.size).toBe(4);
  });

  it('children keep sheet order within a union', () => {
    const model = m(`${H}\nma,Ma,,,\nz,Zed,,,ma\na,Ann,,,ma`);
    expect(model.unions[0].childIds).toEqual(['z', 'a']);
  });
});
