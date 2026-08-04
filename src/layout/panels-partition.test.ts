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

/** Two-level recursion fixture: root → c0 → g0+g0w (≥ MAJOR_BRANCH_MIN, cut by the
 *  master as panel I) → h+hw → k+kw + 5 great-grandchild couples (k+kw's own
 *  subtree = 2 + 10 = 12 ≥ MAJOR_BRANCH_MIN, sitting on panel I's OWN gen-2
 *  frontier) → cut again, inside panel I, as panel II (parentLabel 'I', not the master). */
function twoLevelModel(): FamilyModel {
  const gg = kids(5, 'y');
  const unions: Union[] = [
    { id: 'u:r+rw', partners: ['r', 'rw'], childIds: ['c0'] },
    { id: 'u:c0+c0w', partners: ['c0', 'c0w'], childIds: ['g0'] },
    { id: 'u:g0+g0w', partners: ['g0', 'g0w'], childIds: ['h'] },
    { id: 'u:h+hw', partners: ['h', 'hw'], childIds: ['k'] },
    { id: 'u:k+kw', partners: ['k', 'kw'], childIds: gg },
    ...gg.map((y): Union => ({ id: `u:${y}+${y}w`, partners: [y, `${y}w`], childIds: [] })),
  ];
  return model(unions, [
    'r', 'rw', 'c0', 'c0w', 'g0', 'g0w', 'h', 'hw', 'k', 'kw', ...gg, ...gg.map((y) => `${y}w`),
  ]);
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
    expect(plans[0].overCap).toBe(false);
    expect(plans[0].model.rootId).toBe('u:a+b');
    expect([...plans[0].model.persons.keys()].sort()).toEqual(['a', 'b', 'c0', 'c1']);
  });

  it('a deep frontier union with ≥ MAJOR_BRANCH_MIN people is cut: marker child in the master, own panel rooted at the union', () => {
    const plans = partitionPanels(deepModel());
    expect(plans).toHaveLength(2);
    const [master, sub] = plans;
    expect(master.cutLabels).toEqual(['I']);
    expect(master.overCap).toBe(false);
    expect(sub.overCap).toBe(false);
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
    expect(plans[0].overCap).toBe(false);
    expect(plans[0].model.persons.has('x2')).toBe(true); // past F2, still in the master
  });

  it(`a window over ${PANEL_SOFT_CAP} people narrows the panel to a hub (F0–F1) and cuts at generation 1`, () => {
    // root with 3 branches; each branch head couple has 6 grandchild couples, each with
    // one child; every grandchild couple's own subtree (couple + child = 3) is < MAJOR_BRANCH_MIN,
    // so the tiny-fallback renders it in full ⇒ window-2 = 2 + 3×(2 + 6×3) = 62 > PANEL_SOFT_CAP
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
    // narrowing to F0–F1 actually bounded this panel (real cuts, not the tiny-fallback), so it never overflows
    expect(master.overCap).toBe(false);
    expect(plans).toHaveLength(4);
    expect(plans.map((p) => p.label)).toEqual([null, 'I', 'II', 'III']); // BFS creation order
    expect(plans[1].parentLabel).toBeNull(); // cut by the master
    for (const p of plans) expect(p.overCap).toBe(false);
  });

  it("a 'p:' lone-root model yields one master plan", () => {
    const persons = new Map<string, Person>([['s', { id: 's', fullName: 'Solo', cleanName: 'Solo' }]]);
    const plans = partitionPanels({ persons, unions: [], rootId: 'p:s', excludedIds: [], excludedNames: [] });
    expect(plans).toHaveLength(1);
    expect(plans[0].rootId).toBe('p:s');
    expect(plans[0].overCap).toBe(false);
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

  it('recursion: a cut branch that itself contains a ≥ MAJOR_BRANCH_MIN frontier union is cut again inside its own panel', () => {
    const m = twoLevelModel();
    const plans = partitionPanels(m);
    expect(plans).toHaveLength(3);
    const [master, mid, leaf] = plans;
    expect(master.label).toBeNull();
    expect(master.cutLabels).toEqual(['I']);
    // panel I is cut directly by the master (its own out-chip lives in the master)
    expect(mid.label).toBe('I');
    expect(mid.parentLabel).toBeNull();
    // panel I emits its OWN cut, one level deeper than the master ever sees
    expect(mid.cutLabels).toEqual(['II']);
    expect(leaf.label).toBe('II');
    expect(leaf.parentLabel).toBe('I'); // parented by the mid-panel, not the master
    // labels are globally unique across the whole plan set
    const labels = plans.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
    // person conservation: Σ real-person occurrences across panels = model people + 2×#cuts
    // (each cut union's partners echo: once at the parent frontier, once as the child panel's root)
    const totalCuts = plans.reduce((s, p) => s + p.cutLabels.length, 0);
    expect(totalCuts).toBe(2);
    let total = 0;
    for (const p of plans) for (const id of p.model.persons.keys()) if (!id.startsWith('m:')) total += 1;
    expect(total).toBe(m.persons.size + 2 * totalCuts);
  });

  it(`boundary: exactly ${PANEL_SOFT_CAP} people (all-tiny branches) stays at F0–F2 in one panel with no cuts — <=, not <`, () => {
    // root couple (2) + 10 tiny branches (couple + 1 child = 3 each, all < MAJOR_BRANCH_MIN) = 2 + 10×3 = 32
    const branches = kids(10, 'br');
    const unions: Union[] = [{ id: 'u:a+b', partners: ['a', 'b'], childIds: branches }];
    const ids = ['a', 'b'];
    for (const br of branches) {
      unions.push({ id: `u:${br}+${br}w`, partners: [br, `${br}w`], childIds: [`${br}k`] });
      ids.push(br, `${br}w`, `${br}k`);
    }
    const plans = partitionPanels(model(unions, ids));
    expect(plans).toHaveLength(1);
    expect(plans[0].cutLabels).toEqual([]);
    expect(plans[0].model.persons.size).toBe(32); // hard-coded so this test breaks if PANEL_SOFT_CAP or its <= drift
    expect(plans[0].overCap).toBe(false);
  });

  it(`boundary: one person over ${PANEL_SOFT_CAP} (all-tiny branches, 35 people) narrows to F0–F1 but the tiny-fallback still renders one unbounded panel — overCap catches it`, () => {
    // root couple (2) + 11 tiny branches (couple + 1 child = 3 each) = 2 + 11×3 = 35 > 32
    const branches = kids(11, 'br');
    const unions: Union[] = [{ id: 'u:a+b', partners: ['a', 'b'], childIds: branches }];
    const ids = ['a', 'b'];
    for (const br of branches) {
      unions.push({ id: `u:${br}+${br}w`, partners: [br, `${br}w`], childIds: [`${br}k`] });
      ids.push(br, `${br}w`, `${br}k`);
    }
    const plans = partitionPanels(model(unions, ids));
    expect(plans).toHaveLength(1);
    expect(plans[0].cutLabels).toEqual([]); // no individual branch ever reaches MAJOR_BRANCH_MIN, so nothing can be cut
    expect(plans[0].model.persons.size).toBe(35); // hard-coded, same reason as the 32-person boundary test above
    expect(plans[0].overCap).toBe(true);
  });

  it('overCap flags an unbounded panel (40 all-tiny married-children branches) that narrowing cannot fix', () => {
    // the Important #1 probe: 40 branches, each too small to ever be cut ⇒ 2 + 40×3 = 122 people, 1 panel, 0 cuts
    const branches = kids(40, 'c');
    const unions: Union[] = [{ id: 'u:a+b', partners: ['a', 'b'], childIds: branches }];
    const ids = ['a', 'b'];
    for (const c of branches) {
      unions.push({ id: `u:${c}+${c}w`, partners: [c, `${c}w`], childIds: [`${c}k`] });
      ids.push(c, `${c}w`, `${c}k`);
    }
    const plans = partitionPanels(model(unions, ids));
    expect(plans).toHaveLength(1);
    expect(plans[0].cutLabels).toEqual([]);
    expect(plans[0].model.persons.size).toBe(122);
    expect(plans[0].overCap).toBe(true);
  });
});
