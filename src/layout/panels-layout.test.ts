import { describe, expect, it } from 'vitest';
import type { FamilyModel, Person, Union } from '../data/types';
import type { PrintMeasurer } from './flow-layout';
import { PANEL_GAP_MM, panelsLayout, panelsUnplacedIds } from './panels-layout';

const measure: PrintMeasurer = (text, fontMm) => text.length * fontMm * 0.5; // deterministic fake

const kids = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
function deepModel(): FamilyModel {
  const gg = kids(5, 'x');
  const persons = new Map<string, Person>();
  const unions: Union[] = [
    { id: 'u:a+b', partners: ['a', 'b'], childIds: ['c'] },
    { id: 'u:c+cw', partners: ['c', 'cw'], childIds: ['g'] },
    { id: 'u:g+gw', partners: ['g', 'gw'], childIds: gg },
    ...gg.map((x): Union => ({ id: `u:${x}+${x}w`, partners: [x, `${x}w`], childIds: [] })),
  ];
  for (const id of ['a', 'b', 'c', 'cw', 'g', 'gw', ...gg, ...gg.map((x) => `${x}w`)]) {
    persons.set(id, { id, fullName: `Name ${id}`, cleanName: `Name ${id}` });
  }
  return { persons, unions, rootId: 'u:a+b', excludedIds: [], excludedNames: [] };
}

function model(unions: Union[], ids: string[], rootId?: string): FamilyModel {
  const persons = new Map<string, Person>();
  for (const id of ids) persons.set(id, { id, fullName: `Name ${id}`, cleanName: `Name ${id}` });
  return { persons, unions, rootId: rootId ?? unions[0].id, excludedIds: [], excludedNames: [] };
}

/** Same shape as panels-partition.test.ts's twoLevelModel: root → c0 → g0+g0w (cut as
 *  panel I) → h+hw → k+kw + 5 great-grandchild couples (k+kw's own subtree cut again,
 *  inside panel I, as panel II with parentLabel 'I' — not the master). */
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

/** Same shape as panels-partition.test.ts's 35-person boundary case: root couple (2) +
 *  11 tiny branches (couple + 1 child = 3 each) = 35 > PANEL_SOFT_CAP(32). No individual
 *  branch ever reaches MAJOR_BRANCH_MIN, so narrowing to F0–F1 is a no-op and the
 *  tiny-fallback renders one unbounded panel — overCap catches it. */
function allTinyOverCapModel(): FamilyModel {
  const branches = kids(11, 'br');
  const unions: Union[] = [{ id: 'u:a+b', partners: ['a', 'b'], childIds: branches }];
  const ids = ['a', 'b'];
  for (const br of branches) {
    unions.push({ id: `u:${br}+${br}w`, partners: [br, `${br}w`], childIds: [`${br}k`] });
    ids.push(br, `${br}w`, `${br}k`);
  }
  return model(unions, ids);
}

describe('panelsLayout — composition', () => {
  it('lays panels side-by-side with the panel gap, tops aligned; dims include the title strip', () => {
    const comp = panelsLayout(deepModel(), measure);
    expect(comp.kind).toBe('panels');
    expect(comp.panels).toHaveLength(2);
    const [master, sub] = comp.panels;
    expect(master.label).toBeNull();
    expect(master.xMm).toBe(0);
    expect(sub.xMm).toBeCloseTo(master.wMm + PANEL_GAP_MM, 9);
    expect(master.hMm).toBeCloseTo(master.scene.hMm + 26, 9); // TITLE_BLOCK_MM
    expect(comp.wMm).toBeCloseTo(sub.xMm + sub.wMm, 9);
    expect(comp.hMm).toBeCloseTo(Math.max(master.hMm, sub.hMm), 9);
  });

  it('carries head metadata by display name and the marker chip renders as a scene node', () => {
    const comp = panelsLayout(deepModel(), measure);
    const [master, sub] = comp.panels;
    expect(sub.headId).toBe('g');
    expect(sub.headName).toBe('Name g'); // cleanName, never the id
    expect(master.cutLabels).toEqual(['I']);
    const chip = master.scene.nodes.find((n) => n.personId === 'm:I')!;
    expect(chip).toBeDefined();
    expect(chip.nameLines).toEqual(['I']);
    // the replacement connector targets the chip
    expect(master.scene.edges.some((e) => e.fromId === 'u:g+gw' && e.toId === 'm:I')).toBe(true);
  });

  it('no-silent-drop holds globally: every person placed in some panel; markers/echoes never mask a miss', () => {
    const m = deepModel();
    const comp = panelsLayout(m, measure);
    expect(panelsUnplacedIds(m, comp)).toEqual([]);
    // deleting a panel would surface its people
    const broken = { ...comp, panels: [comp.panels[0]] };
    expect(panelsUnplacedIds(m, broken)).toContain('x0');
  });

  it('is deterministic', () => {
    const m = deepModel();
    expect(panelsLayout(m, measure)).toEqual(panelsLayout(m, measure));
  });

  it('panels never overlap horizontally', () => {
    const comp = panelsLayout(deepModel(), measure);
    for (let i = 1; i < comp.panels.length; i++) {
      const prev = comp.panels[i - 1];
      expect(comp.panels[i].xMm).toBeGreaterThanOrEqual(prev.xMm + prev.wMm + PANEL_GAP_MM - 1e-9);
    }
  });

  it('propagates overCap from the partition plan onto each panel and aggregates it onto the composition', () => {
    const normal = panelsLayout(deepModel(), measure);
    for (const p of normal.panels) expect(p.overCap).toBe(false);
    expect(normal.overCap).toBe(false);

    const overCapped = panelsLayout(allTinyOverCapModel(), measure);
    expect(overCapped.panels).toHaveLength(1);
    expect(overCapped.panels[0].overCap).toBe(true);
    expect(overCapped.overCap).toBe(true);
  });

  it('recursive multi-cut: no-silent-drop holds, parentLabel chain survives the mapping, offsets stay monotonic', () => {
    const m = twoLevelModel();
    const comp = panelsLayout(m, measure);
    expect(comp.panels).toHaveLength(3);
    expect(panelsUnplacedIds(m, comp)).toEqual([]);

    const [master, mid, leaf] = comp.panels;
    expect(master.label).toBeNull();
    expect(mid.label).toBe('I');
    expect(mid.parentLabel).toBeNull();
    expect(leaf.label).toBe('II');
    // swap-proof: the leaf's parentLabel must equal the MID panel's label, not just be non-null
    expect(leaf.parentLabel).toBe(mid.label);

    for (let i = 1; i < comp.panels.length; i++) {
      const prev = comp.panels[i - 1];
      expect(comp.panels[i].xMm).toBeGreaterThanOrEqual(prev.xMm + prev.wMm + PANEL_GAP_MM - 1e-9);
    }
  });

  it('echo tolerance: a cut-couple echo person missing from ONE of their two panel scenes is still not reported unplaced', () => {
    const m = deepModel();
    const comp = panelsLayout(m, measure);
    const [master, sub] = comp.panels;
    // 'g' echoes in both panels (master's frontier couple, sub's root couple) — strip it
    // from only the sub panel's scene and confirm the master's copy still covers it.
    expect(master.scene.nodes.some((n) => n.personId === 'g')).toBe(true);
    expect(sub.scene.nodes.some((n) => n.personId === 'g')).toBe(true);
    const strippedSub = { ...sub, scene: { ...sub.scene, nodes: sub.scene.nodes.filter((n) => n.personId !== 'g') } };
    const broken = { ...comp, panels: [master, strippedSub] };
    expect(panelsUnplacedIds(m, broken)).not.toContain('g');
  });

  it('genuine drop: a person missing from their ONLY panel scene is reported unplaced', () => {
    const m = deepModel();
    const comp = panelsLayout(m, measure);
    const [master, sub] = comp.panels;
    // 'x0' only ever renders in the sub panel — strip it and confirm it surfaces.
    expect(sub.scene.nodes.some((n) => n.personId === 'x0')).toBe(true);
    const strippedSub = { ...sub, scene: { ...sub.scene, nodes: sub.scene.nodes.filter((n) => n.personId !== 'x0') } };
    const broken = { ...comp, panels: [master, strippedSub] };
    expect(panelsUnplacedIds(m, broken)).toContain('x0');
  });
});
