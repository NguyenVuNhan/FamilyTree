import { describe, expect, it } from 'vitest';
import type { FamilyModel, Person, Union } from '../data/types';
import {
  MAJOR_BRANCH_MIN, PANEL_SOFT_CAP, partitionPanels, toRoman,
} from './panels-partition';

function model(unions: Union[], ids: string[], rootId?: string): FamilyModel {
  const persons = new Map<string, Person>();
  for (const id of ids) persons.set(id, { id, fullName: `Name ${id}`, cleanName: `Name ${id}` });
  return { persons, unions, rootId: rootId ?? unions[0].id, excludedIds: [], excludedNames: [] };
}
const kids = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** root a+b → child c (couple c+cw) → grandchild g (couple g+gw) → 5 great-grandchild couples.
 *  g's union subtree = 2 + 10 = 12 ≥ MAJOR_BRANCH_MIN and sits on the master's gen-2 frontier → one cut. */
function deepModel(): FamilyModel {
  const gg = kids(5, 'x');
  const unions: Union[] = [
    { id: 'u:a+b', partners: ['a', 'b'], childIds: ['c'] },
    { id: 'u:c+cw', partners: ['c', 'cw'], childIds: ['g'] },
    { id: 'u:g+gw', partners: ['g', 'gw'], childIds: gg },
    ...gg.map((x): Union => ({ id: `u:${x}+${x}w`, partners: [x, `${x}w`], childIds: [] })),
  ];
  return model(unions, ['a', 'b', 'c', 'cw', 'g', 'gw', ...gg, ...gg.map((x) => `${x}w`)]);
}

describe('toRoman', () => {
  it.each([[1, 'I'], [2, 'II'], [3, 'III'], [4, 'IV'], [5, 'V'], [9, 'IX'], [14, 'XIV'], [40, 'XL']])(
    '%d → %s', (n, s) => expect(toRoman(n)).toBe(s));
});

describe('partitionPanels — window and cuts', () => {
  it('a family fitting F0–F2 is a single master plan with no cuts', () => {
    const m = model([{ id: 'u:a+b', partners: ['a', 'b'], childIds: ['c0', 'c1'] }], ['a', 'b', 'c0', 'c1']);
    const plans = partitionPanels(m);
    expect(plans).toHaveLength(1);
    expect(plans[0].label).toBeNull();
    expect(plans[0].cutLabels).toEqual([]);
    expect(plans[0].model.rootId).toBe('u:a+b');
    expect([...plans[0].model.persons.keys()].sort()).toEqual(['a', 'b', 'c0', 'c1']);
  });

  it('a deep frontier union with ≥ MAJOR_BRANCH_MIN people is cut: marker child in the master, own panel rooted at the union', () => {
    const plans = partitionPanels(deepModel());
    expect(plans).toHaveLength(2);
    const [master, sub] = plans;
    expect(master.cutLabels).toEqual(['I']);
    // the cut union survives in the master model with its children replaced by the marker person
    const cutInMaster = master.model.unions.find((u) => u.id === 'u:g+gw')!;
    expect(cutInMaster.childIds).toEqual(['m:I']);
    expect(master.model.persons.get('m:I')).toMatchObject({ fullName: 'I', cleanName: 'I' });
    // master keeps F0–F2 people (a,b,c,cw,g,gw) and nothing deeper
    expect([...master.model.persons.keys()].filter((id) => !id.startsWith('m:')).sort())
      .toEqual(['a', 'b', 'c', 'cw', 'g', 'gw']);
    // the sub-panel roots at the cut union with its REAL children and carries head metadata
    expect(sub.label).toBe('I');
    expect(sub.parentLabel).toBeNull();
    expect(sub.rootId).toBe('u:g+gw');
    expect(sub.headId).toBe('g');
    expect(sub.model.unions.find((u) => u.id === 'u:g+gw')!.childIds).toHaveLength(5);
    expect(sub.model.persons.has('x0w')).toBe(true);
  });

  it(`a deep-but-tiny frontier subtree (< ${MAJOR_BRANCH_MIN}) renders in full inside the parent panel (tiny fallback)`, () => {
    const gg = kids(3, 'x'); // g's subtree = 2 + 3 = 5 < 12
    const m = model(
      [
        { id: 'u:a+b', partners: ['a', 'b'], childIds: ['c'] },
        { id: 'u:c+cw', partners: ['c', 'cw'], childIds: ['g'] },
        { id: 'u:g+gw', partners: ['g', 'gw'], childIds: gg },
      ],
      ['a', 'b', 'c', 'cw', 'g', 'gw', ...gg],
    );
    const plans = partitionPanels(m);
    expect(plans).toHaveLength(1);
    expect(plans[0].model.persons.has('x2')).toBe(true); // past F2, still in the master
  });

  it(`a window over ${PANEL_SOFT_CAP} people narrows the panel to a hub (F0–F1) and cuts at generation 1`, () => {
    // root with 3 branches; each branch head couple has 6 grandchild couples ⇒ window-2 = 2 + 3×(2+12) = 44 > PANEL_SOFT_CAP
    const branches = ['p', 'q', 'r'];
    const unions: Union[] = [{ id: 'u:a+b', partners: ['a', 'b'], childIds: branches }];
    const ids = ['a', 'b'];
    for (const br of branches) {
      const gs = kids(6, `${br}g`);
      unions.push({ id: `u:${br}+${br}w`, partners: [br, `${br}w`], childIds: gs });
      ids.push(br, `${br}w`);
      for (const g of gs) {
        unions.push({ id: `u:${g}+${g}w`, partners: [g, `${g}w`], childIds: [`${g}k`] });
        ids.push(g, `${g}w`, `${g}k`);
      }
    }
    const plans = partitionPanels(model(unions, ids));
    const master = plans[0];
    // hub: root couple + the 3 head couples + 3 markers, nothing deeper
    expect(master.cutLabels).toEqual(['I', 'II', 'III']);
    expect([...master.model.persons.keys()].filter((id) => !id.startsWith('m:')).sort())
      .toEqual(['a', 'b', 'p', 'pw', 'q', 'qw', 'r', 'rw'].sort());
    expect(plans).toHaveLength(4);
    expect(plans.map((p) => p.label)).toEqual([null, 'I', 'II', 'III']); // BFS creation order
    expect(plans[1].parentLabel).toBeNull(); // cut by the master
  });

  it("a 'p:' lone-root model yields one master plan", () => {
    const persons = new Map<string, Person>([['s', { id: 's', fullName: 'Solo', cleanName: 'Solo' }]]);
    const plans = partitionPanels({ persons, unions: [], rootId: 'p:s', excludedIds: [], excludedNames: [] });
    expect(plans).toHaveLength(1);
    expect(plans[0].rootId).toBe('p:s');
    expect([...plans[0].model.persons.keys()]).toEqual(['s']);
  });

  it('is deterministic and covers every person exactly once as home (echo roots aside)', () => {
    const m = deepModel();
    const a = partitionPanels(m);
    const b = partitionPanels(m);
    expect(a).toEqual(b);
    const seen = new Map<string, number>();
    for (const p of a) for (const id of p.model.persons.keys()) {
      if (!id.startsWith('m:')) seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of m.persons.keys()) expect(seen.get(id), id).toBeGreaterThanOrEqual(1);
    // the ONLY duplicates are the cut union's partners (parent frontier + child root echo)
    const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id).sort();
    expect(dups).toEqual(['g', 'gw']);
    for (const [, n] of seen) expect(n).toBeLessThanOrEqual(2);
  });
});
