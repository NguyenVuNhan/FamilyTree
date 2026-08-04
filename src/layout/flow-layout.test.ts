import { describe, expect, it } from 'vitest';
import type { FamilyModel, Person } from '../data/types';
import {
  NAME_FONT_MM,
  buildPrintTree,
  capsule,
  flowLayout,
  printUnplacedIds,
  yearFontMm,
  type PrintMeasurer,
  type PrintScene,
} from './flow-layout';

const measure: PrintMeasurer = (text, fontMm) => text.length * fontMm * 0.5; // deterministic fake

function couple(children: Array<{ id: string; name?: string }>): FamilyModel {
  const persons = new Map();
  persons.set('a', { id: 'a', fullName: 'A', cleanName: 'A', birthYear: 1930 });
  persons.set('b', { id: 'b', fullName: 'B', cleanName: 'B' });
  for (const c of children) persons.set(c.id, { id: c.id, fullName: c.name ?? c.id, cleanName: c.name ?? c.id });
  return {
    persons,
    unions: [{ id: 'u:a+b', partners: ['a', 'b'], childIds: children.map((c) => c.id) }],
    rootId: 'u:a+b',
    excludedIds: [], excludedNames: [],
  };
}

/** Pairwise box-overlap assertion shared by several tests below. */
function assertNoOverlaps(scene: PrintScene) {
  for (const a of scene.nodes) for (const b of scene.nodes) {
    if (a === b) continue;
    const apart = a.xMm + a.wMm <= b.xMm || b.xMm + b.wMm <= a.xMm ||
                  a.yMm + a.hMm <= b.yMm || b.yMm + b.hMm <= a.yMm;
    expect(apart, `${a.personId} vs ${b.personId}`).toBe(true);
  }
}

/** Parse an SVG path's numbers into (M point, then each C's 3 points) groups. */
function pathNums(d: string): number[] {
  return d.match(/-?\d+(\.\d+)?/g)!.map(Number);
}
/** A cubic bezier is always contained in the convex hull of its 4 control points, so
 *  bounding-box-vs-bounding-box overlap is a rigorous (not approximate) crossing check. */
function segmentBBoxes(d: string): Array<{ minX: number; maxX: number; minY: number; maxY: number }> {
  const n = pathNums(d);
  const boxes: Array<{ minX: number; maxX: number; minY: number; maxY: number }> = [];
  let curX = n[0];
  let curY = n[1];
  for (let i = 2; i + 6 <= n.length; i += 6) {
    const xs = [curX, n[i], n[i + 2], n[i + 4]];
    const ys = [curY, n[i + 1], n[i + 3], n[i + 5]];
    boxes.push({ minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
    curX = n[i + 4];
    curY = n[i + 5];
  }
  return boxes;
}
function boxesOverlap(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

describe('font tiers (legibility-floor-first, spec §Error handling 2)', () => {
  it('monotonic ≥8% steps, floor 6.5, years ≥ 3.2', () => {
    expect(NAME_FONT_MM[0]).toBe(12);
    for (let i = 1; i < NAME_FONT_MM.length; i++) {
      expect(NAME_FONT_MM[i]).toBeLessThan(NAME_FONT_MM[i - 1] * 0.92); // ≥8% step
      expect(NAME_FONT_MM[i]).toBeGreaterThanOrEqual(6.5);
    }
    expect(yearFontMm(6.5)).toBeGreaterThanOrEqual(3.2);
  });

  it('font size clamps to the floor (6.5) at generation ≥ 4, not just at the table length', () => {
    // Chain 5 unions deep: gen0..gen4, plus one more generation to prove the clamp
    // persists past the table's last real index, not just exactly at it.
    const persons = new Map<string, Person>();
    const ids = ['p0a', 'p0b', 'p1a', 'p1b', 'p2a', 'p2b', 'p3a', 'p3b', 'p4a', 'p4b', 'p5'];
    for (const id of ids) persons.set(id, { id, fullName: id, cleanName: id });
    const model: FamilyModel = {
      persons,
      unions: [
        { id: 'u0', partners: ['p0a', 'p0b'], childIds: ['p1a'] },
        { id: 'u1', partners: ['p1a', 'p1b'], childIds: ['p2a'] },
        { id: 'u2', partners: ['p2a', 'p2b'], childIds: ['p3a'] },
        { id: 'u3', partners: ['p3a', 'p3b'], childIds: ['p4a'] },
        { id: 'u4', partners: ['p4a', 'p4b'], childIds: ['p5'] },
      ],
      rootId: 'u0',
      excludedIds: [], excludedNames: [],
    };
    const scene = flowLayout(model, measure);
    const at = (id: string) => scene.nodes.find((n) => n.personId === id)!;
    expect(at('p4a').generation).toBe(4);
    expect(at('p4a').fontMm).toBe(6.5);
    expect(at('p5').generation).toBe(5);
    expect(at('p5').fontMm).toBe(6.5); // still floored, one generation past the table's last index
  });
});

describe('flowLayout', () => {
  it('generations become columns: child x > parent x; partners stack in y', () => {
    const scene = flowLayout(couple([{ id: 'c1' }, { id: 'c2' }]), measure);
    const at = (id: string) => scene.nodes.find((n) => n.personId === id)!;
    expect(at('c1').xMm).toBeGreaterThan(at('a').xMm + at('a').wMm);
    expect(at('b').xMm).toBe(at('a').xMm);            // same column
    expect(at('b').yMm).toBeGreaterThan(at('a').yMm); // stacked below
    expect(at('a').generation).toBe(0);
    expect(at('c1').generation).toBe(1);
  });

  it('every person gets exactly one node; deterministic', () => {
    const model = couple([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]);
    const s1 = flowLayout(model, measure);
    const s2 = flowLayout(model, measure);
    expect(s1.nodes.map((n) => n.personId).sort()).toEqual(['a', 'b', 'c1', 'c2', 'c3']);
    expect(s1).toEqual(s2);
    expect(printUnplacedIds(model, s1)).toEqual([]);
  });

  it('no node boxes overlap (worst-case guard runs at n=200 in e2e; unit pins the rule)', () => {
    assertNoOverlaps(flowLayout(couple(Array.from({ length: 9 }, (_, i) => ({ id: `c${i}` }))), measure));
  });

  it('plain sibling stack (≤6 children, no leaf-run wrap) has no overlaps', () => {
    const scene = flowLayout(couple(Array.from({ length: 4 }, (_, i) => ({ id: `c${i}` }))), measure);
    const xs = new Set(scene.nodes.filter((n) => n.generation === 1).map((n) => n.xMm));
    expect(xs.size).toBe(1); // single column — leaf-run wrap did not trigger
    assertNoOverlaps(scene);
  });

  it('leaf-run wrap: >6 childless siblings split into two mini-columns', () => {
    const scene = flowLayout(couple(Array.from({ length: 8 }, (_, i) => ({ id: `c${i}` }))), measure);
    const xs = new Set(scene.nodes.filter((n) => n.generation === 1).map((n) => n.xMm));
    expect(xs.size).toBe(2); // two mini-columns
  });

  it('canvas wMm/hMm bound every node, including a leaf-run\'s second mini-column', () => {
    // A wide leaf-run's second mini-column can render past the nominal last-generation
    // column edge — scene.wMm must reflect actual content, not just colX/colW bookkeeping,
    // or a print/SVG consumer sizing off it would crop the run.
    const persons = new Map<string, Person>();
    persons.set('a', { id: 'a', fullName: 'A', cleanName: 'A' });
    persons.set('b', { id: 'b', fullName: 'B', cleanName: 'B' });
    for (let i = 0; i < 8; i++) {
      persons.set(`k${i}`, { id: `k${i}`, fullName: 'Alexanderoo', cleanName: 'Alexanderoo' });
    }
    const model: FamilyModel = {
      persons,
      unions: [{ id: 'u:a+b', partners: ['a', 'b'], childIds: Array.from({ length: 8 }, (_, i) => `k${i}`) }],
      rootId: 'u:a+b',
      excludedIds: [], excludedNames: [],
    };
    const scene = flowLayout(model, measure);
    for (const n of scene.nodes) {
      expect(n.xMm + n.wMm).toBeLessThanOrEqual(scene.wMm);
      expect(n.yMm + n.hMm).toBeLessThanOrEqual(scene.hMm);
    }
  });

  it("leaf-run wrap: a leaf-run union beside a sibling branch that descends deeper has no overlaps", () => {
    // Mixed-generation regression (review finding): the leaf-run's second mini-column can
    // render past colX[gen+2] while an unrelated sibling branch under the same grandparent
    // actually has content there — must still be zero overlaps.
    const persons = new Map<string, Person>();
    for (const id of ['x', 'y', 'z', 'w', 'g2', 'gc']) persons.set(id, { id, fullName: id, cleanName: id });
    persons.set('a', { id: 'a', fullName: 'Alexanderoo', cleanName: 'Alexanderoo' });
    persons.set('b', { id: 'b', fullName: 'B', cleanName: 'B' });
    persons.set('g1', { id: 'g1', fullName: 'G', cleanName: 'G' });
    for (let i = 0; i < 8; i++) persons.set(`k${i}`, { id: `k${i}`, fullName: 'Alexanderoo', cleanName: 'Alexanderoo' });

    const model: FamilyModel = {
      persons,
      unions: [
        { id: 'u:x+y', partners: ['x', 'y'], childIds: ['a', 'z'] },
        { id: 'u:a+b', partners: ['a', 'b'], childIds: Array.from({ length: 8 }, (_, i) => `k${i}`) },
        { id: 'u:z+w', partners: ['z', 'w'], childIds: ['g1'] },
        { id: 'u:g1+g2', partners: ['g1', 'g2'], childIds: ['gc'] },
      ],
      rootId: 'u:x+y',
      excludedIds: [], excludedNames: [],
    };
    assertNoOverlaps(flowLayout(model, measure));
  });

  it("leaf-run's second mini-column connector never crosses the first mini-column's capsules", () => {
    // Review finding: both mini-columns in a row share the same target y (row center), so a
    // naive single-bezier from the union anchor to the second mini-column sweeps straight
    // through the first mini-column's capsule at that row's height. Geometric check (bezier
    // curves are contained in the convex hull of their control points, so bbox-vs-bbox
    // overlap is exact, not approximate).
    const persons = new Map<string, Person>();
    persons.set('a', { id: 'a', fullName: 'Alexanderoo', cleanName: 'Alexanderoo' });
    persons.set('b', { id: 'b', fullName: 'B', cleanName: 'B' });
    for (let i = 0; i < 8; i++) persons.set(`k${i}`, { id: `k${i}`, fullName: 'Alexanderoo', cleanName: 'Alexanderoo' });
    const model: FamilyModel = {
      persons,
      unions: [{ id: 'u:a+b', partners: ['a', 'b'], childIds: Array.from({ length: 8 }, (_, i) => `k${i}`) }],
      rootId: 'u:a+b',
      excludedIds: [], excludedNames: [],
    };
    const scene = flowLayout(model, measure);
    const boxOf = (id: string) => {
      const nd = scene.nodes.find((x) => x.personId === id)!;
      return { minX: nd.xMm, maxX: nd.xMm + nd.wMm, minY: nd.yMm, maxY: nd.yMm + nd.hMm };
    };
    for (const e of scene.edges) {
      const segs = segmentBBoxes(e.d);
      for (const other of scene.nodes) {
        if (other.personId === e.toId) continue; // touching the target is expected
        const otherBox = boxOf(other.personId);
        for (const seg of segs) {
          expect(boxesOverlap(seg, otherBox), `edge ${e.fromId}->${e.toId} vs ${other.personId}`).toBe(false);
        }
      }
    }
  });

  it("a 'p:' lone-root model places exactly one node and zero edges", () => {
    const persons = new Map<string, Person>();
    persons.set('solo', { id: 'solo', fullName: 'Solo', cleanName: 'Solo' });
    const model: FamilyModel = { persons, unions: [], rootId: 'p:solo', excludedIds: [], excludedNames: [] };
    const scene = flowLayout(model, measure);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0].personId).toBe('solo');
    expect(scene.nodes[0].generation).toBe(0);
    expect(scene.edges).toHaveLength(0);
  });

  it('cousin-marriage dedup: a union reached from two branches renders each person exactly once, no orphan edges', () => {
    // Root's two children (a, b) each start their own line; their descendants (m, n) marry
    // each other, so the union {m,n} is reachable from BOTH the a-branch and the b-branch.
    // Mirrors layoutTree's documented contract: whichever branch reaches it first renders it
    // in full; the later branch drops that child slot instead of re-walking/duplicating it.
    const persons = new Map<string, Person>();
    for (const id of ['g1', 'g2', 'a', 'a2', 'b', 'b2', 'm', 'n', 'z']) {
      persons.set(id, { id, fullName: id, cleanName: id });
    }
    const model: FamilyModel = {
      persons,
      unions: [
        { id: 'u:root', partners: ['g1', 'g2'], childIds: ['a', 'b'] },
        { id: 'u:a', partners: ['a', 'a2'], childIds: ['m'] },
        { id: 'u:b', partners: ['b', 'b2'], childIds: ['n'] },
        { id: 'u:mn', partners: ['m', 'n'], childIds: ['z'] },
      ],
      rootId: 'u:root',
      excludedIds: [], excludedNames: [],
    };
    const scene = flowLayout(model, measure);
    expect(scene.nodes.map((n) => n.personId).sort()).toEqual(
      ['a', 'a2', 'b', 'b2', 'g1', 'g2', 'm', 'n', 'z'].sort(),
    );
    // exactly one node per person (no duplicate render of the shared union's partners)
    const counts = new Map<string, number>();
    for (const nd of scene.nodes) counts.set(nd.personId, (counts.get(nd.personId) ?? 0) + 1);
    for (const [id, count] of counts) expect(count, id).toBe(1);
    // no orphan edges: every edge's toId must resolve to a placed node
    const placed = new Set(scene.nodes.map((n) => n.personId));
    for (const e of scene.edges) expect(placed.has(e.toId), e.toId).toBe(true);
    expect(printUnplacedIds(model, scene)).toEqual([]);
  });

  it('edges carry from/to ids and bezier paths', () => {
    const scene = flowLayout(couple([{ id: 'c1' }]), measure);
    expect(scene.edges).toHaveLength(1);
    expect(scene.edges[0]).toMatchObject({ fromId: 'u:a+b', toId: 'c1' });
    expect(scene.edges[0].d).toMatch(/^M [\d.]+ [\d.]+ C /);
  });

  it('years line renders from person fields', () => {
    const scene = flowLayout(couple([]), measure);
    expect(scene.nodes.find((n) => n.personId === 'a')!.years).toBe('b. 1930');
    expect(scene.nodes.find((n) => n.personId === 'b')!.years).toBeNull();
  });
});

describe('shared print-tree primitives (PR ② prep)', () => {
  it('buildPrintTree walks unions once and returns a person node for a p: root', () => {
    const m = couple([{ id: 'c1' }, { id: 'c2' }]);
    const tree = buildPrintTree(m);
    expect(tree.kind).toBe('union');
    if (tree.kind === 'union') {
      expect(tree.union.id).toBe('u:a+b');
      expect(tree.children.map((c) => (c.kind === 'person' ? c.personId : ''))).toEqual(['c1', 'c2']);
    }
    const solo: FamilyModel = {
      persons: new Map([['s', { id: 's', fullName: 'S', cleanName: 'S' }]]),
      unions: [], rootId: 'p:s', excludedIds: [], excludedNames: [],
    };
    expect(buildPrintTree(solo)).toEqual({ kind: 'person', personId: 's' });
  });

  it('capsule is exported, floor-clamps past the tier table, and wraps names', () => {
    const c = capsule({ id: 'x', fullName: 'Xuân', cleanName: 'Xuân' }, 9, measure);
    expect(c.fontMm).toBe(6.5);
    expect(c.titleFace).toBe(false);
    expect(c.nameLines).toEqual(['Xuân']);
  });

  it('PrintNode.rotateDeg is optional — flow scenes never set it', () => {
    const scene = flowLayout(couple([{ id: 'c1' }]), measure);
    for (const n of scene.nodes) expect(n.rotateDeg).toBeUndefined();
  });

  it('union nodes carry the linkId that reached them (PR ③ partitioner contract)', () => {
    // root couple a+b, child c1 who married c1w and had g1
    const persons = new Map<string, Person>();
    for (const id of ['a', 'b', 'c1', 'c1w', 'g1']) persons.set(id, { id, fullName: id, cleanName: id });
    const m: FamilyModel = {
      persons,
      unions: [
        { id: 'u:a+b', partners: ['a', 'b'], childIds: ['c1'] },
        { id: 'u:c1+c1w', partners: ['c1', 'c1w'], childIds: ['g1'] },
      ],
      rootId: 'u:a+b', excludedIds: [], excludedNames: [],
    };
    const tree = buildPrintTree(m);
    expect(tree.kind).toBe('union');
    if (tree.kind === 'union') {
      expect(tree.linkId).toBeNull();
      const child = tree.children[0];
      expect(child.kind).toBe('union');
      if (child.kind === 'union') expect(child.linkId).toBe('c1');
    }
  });
});
