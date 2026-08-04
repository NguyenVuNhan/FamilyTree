import { describe, expect, it } from 'vitest';
import type { FamilyModel, Person, Union } from '../data/types';
import { printUnplacedIds, type PrintMeasurer, type PrintNode } from './flow-layout';
import {
  COUPLE_ARC_GAP_MM, MIN_WEDGE_DEG, fanGeometry, fanLayout, nodeCorners,
} from './fan-layout';

const measure: PrintMeasurer = (text, fontMm) => text.length * fontMm * 0.5; // deterministic fake

function model(unions: Union[], ids: string[], rootId?: string): FamilyModel {
  const persons = new Map<string, Person>();
  for (const id of ids) persons.set(id, { id, fullName: id, cleanName: id });
  return { persons, unions, rootId: rootId ?? unions[0].id, excludedIds: [], excludedNames: [] };
}
const kids = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** root couple + one dense couple-branch (8 leaves, one long name), one leaf
 *  branch, one deep branch (couple → couple → leaf) — the shared stress shape. */
function mixedModel(): FamilyModel {
  const dense = kids(8, 'd');
  const m = model(
    [
      { id: 'u:a+b', partners: ['a', 'b'], childIds: ['p', 'solo', 'q'] },
      { id: 'u:p+pw', partners: ['p', 'pw'], childIds: dense },
      { id: 'u:q+qw', partners: ['q', 'qw'], childIds: ['r'] },
      { id: 'u:r+rw', partners: ['r', 'rw'], childIds: ['leaf'] },
    ],
    ['a', 'b', 'p', 'pw', 'solo', 'q', 'qw', 'r', 'rw', 'leaf', ...dense],
  );
  m.persons.set('d0', { id: 'd0', fullName: 'Nguyễn Thị Phương Thảo Nguyên', cleanName: 'Nguyễn Thị Phương Thảo Nguyên' });
  return m;
}

// — geometry helpers for the assertions (SAT + point-in-rotated-rect) —
function project(pts: { x: number; y: number }[], ax: { x: number; y: number }): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const p of pts) {
    const d = p.x * ax.x + p.y * ax.y;
    min = Math.min(min, d); max = Math.max(max, d);
  }
  return [min, max];
}
function overlapOBB(a: { x: number; y: number }[], b: { x: number; y: number }[]): boolean {
  for (const quad of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const p1 = quad[i], p2 = quad[(i + 1) % 4];
      const ax = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      const [minA, maxA] = project(a, ax);
      const [minB, maxB] = project(b, ax);
      if (maxA <= minB + 1e-6 || maxB <= minA + 1e-6) return false; // separating axis found
    }
  }
  return true;
}
function insideNode(n: PrintNode, px: number, py: number): boolean {
  const rot = (-(n.rotateDeg ?? 0) * Math.PI) / 180; // inverse rotation
  const dx = px - n.xMm, dy = py - n.yMm;
  const lx = dx * Math.cos(rot) - dy * Math.sin(rot);
  const ly = dx * Math.sin(rot) + dy * Math.cos(rot);
  return lx >= 0 && lx <= n.wMm && ly >= 0 && ly <= n.hMm;
}

describe('fanLayout — hub and rings', () => {
  it('founding couple at the hub: generation 0, unrotated, partners stacked; rings sit above', () => {
    const m = model([{ id: 'u:a+b', partners: ['a', 'b'], childIds: ['c0', 'c1'] }], ['a', 'b', 'c0', 'c1']);
    const scene = fanLayout(m, measure);
    const at = (id: string) => scene.nodes.find((n) => n.personId === id)!;
    expect(at('a').generation).toBe(0);
    expect(at('a').rotateDeg).toBeUndefined();
    expect(at('b').rotateDeg).toBeUndefined();
    expect(at('b').yMm).toBeGreaterThan(at('a').yMm);            // stacked (flow couple semantics at the hub)
    expect(Math.abs(at('a').xMm + at('a').wMm / 2 - scene.wMm / 2)).toBeLessThan(1); // bottom-CENTER
    expect(at('c0').rotateDeg).toBeDefined();
    expect(at('c0').generation).toBe(1);
  });

  it('every person gets exactly one node; deterministic; nothing silently dropped', () => {
    const m = mixedModel();
    const s1 = fanLayout(m, measure);
    const s2 = fanLayout(m, measure);
    expect(s1).toEqual(s2);
    expect(s1.nodes.map((n) => n.personId).sort()).toEqual([...m.persons.keys()].sort());
    expect(printUnplacedIds(m, s1)).toEqual([]);
  });

  it("a 'p:' lone-root model places exactly one unrotated node and zero edges", () => {
    const persons = new Map<string, Person>([['solo', { id: 'solo', fullName: 'Solo', cleanName: 'Solo' }]]);
    const scene = fanLayout({ persons, unions: [], rootId: 'p:solo', excludedIds: [], excludedNames: [] }, measure);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0].rotateDeg).toBeUndefined();
    expect(scene.edges).toHaveLength(0);
  });

  it('generation size tiers hold: floor 6.5 persists past the table (monotonic tiers)', () => {
    const persons = new Map<string, Person>();
    const ids = ['p0a', 'p0b', 'p1a', 'p1b', 'p2a', 'p2b', 'p3a', 'p3b', 'p4a', 'p4b', 'p5'];
    for (const id of ids) persons.set(id, { id, fullName: id, cleanName: id });
    const m: FamilyModel = {
      persons,
      unions: [
        { id: 'u0', partners: ['p0a', 'p0b'], childIds: ['p1a'] },
        { id: 'u1', partners: ['p1a', 'p1b'], childIds: ['p2a'] },
        { id: 'u2', partners: ['p2a', 'p2b'], childIds: ['p3a'] },
        { id: 'u3', partners: ['p3a', 'p3b'], childIds: ['p4a'] },
        { id: 'u4', partners: ['p4a', 'p4b'], childIds: ['p5'] },
      ],
      rootId: 'u0', excludedIds: [], excludedNames: [],
    };
    const scene = fanLayout(m, measure);
    const at = (id: string) => scene.nodes.find((n) => n.personId === id)!;
    expect(at('p1a').fontMm).toBeGreaterThan(at('p2a').fontMm); // tiers step down
    expect(at('p4a').fontMm).toBe(6.5);
    expect(at('p5').fontMm).toBe(6.5); // still floored past the table's last index
  });

  it('years line renders from person fields', () => {
    const m = model([{ id: 'u:a+b', partners: ['a', 'b'], childIds: ['c0'] }], ['a', 'b', 'c0']);
    m.persons.set('a', { id: 'a', fullName: 'A', cleanName: 'A', birthYear: 1930 });
    const scene = fanLayout(m, measure);
    expect(scene.nodes.find((n) => n.personId === 'a')!.years).toBe('b. 1930');
    expect(scene.nodes.find((n) => n.personId === 'b')!.years).toBeNull();
  });
});

describe('fanLayout — sectors', () => {
  it(`a 1-person branch keeps the ${MIN_WEDGE_DEG}° wedge floor; a 40-person branch just gets a wide slice`, () => {
    const dense = kids(40, 'k');
    const m = model(
      [
        { id: 'u:a+b', partners: ['a', 'b'], childIds: ['big', 'solo'] },
        { id: 'u:big+bw', partners: ['big', 'bw'], childIds: dense },
      ],
      ['a', 'b', 'big', 'bw', 'solo', ...dense],
    );
    const geo = fanGeometry(m, measure);
    const span = (key: string) => {
      const s = geo.rootSectors.find((x) => x.key === key)!;
      return s.startRad - s.endRad;
    };
    const floorRad = (MIN_WEDGE_DEG * Math.PI) / 180;
    expect(span('solo')).toBeGreaterThanOrEqual(floorRad - 1e-9);
    expect(span('big')).toBeGreaterThan(span('solo') * 5);
    expect(span('big') + span('solo')).toBeCloseTo(Math.PI, 9); // wedges tile the semicircle exactly
  });

  it('sector spans are proportional to subtree person count when floors don’t bind (8 vs 5 → ratio 8/5)', () => {
    const a6 = kids(6, 'x');
    const b3 = kids(3, 'y');
    const m = model(
      [
        { id: 'u:r1+r2', partners: ['r1', 'r2'], childIds: ['pa', 'pb'] },
        { id: 'u:pa+qa', partners: ['pa', 'qa'], childIds: a6 },
        { id: 'u:pb+qb', partners: ['pb', 'qb'], childIds: b3 },
      ],
      ['r1', 'r2', 'pa', 'qa', 'pb', 'qb', ...a6, ...b3],
    );
    const geo = fanGeometry(m, measure);
    const span = (key: string) => {
      const s = geo.rootSectors.find((x) => x.key === key)!;
      return s.startRad - s.endRad;
    };
    expect(span('pa') / span('pb')).toBeCloseTo(8 / 5, 5);
  });

  it('angular overflow inflates the rings instead of shrinking text (Δ inflation)', () => {
    const dense = kids(40, 'k');
    const m = model(
      [
        { id: 'u:a+b', partners: ['a', 'b'], childIds: ['big', 'solo'] },
        { id: 'u:big+bw', partners: ['big', 'bw'], childIds: dense },
      ],
      ['a', 'b', 'big', 'bw', 'solo', ...dense],
    );
    const geo = fanGeometry(m, measure);
    // 40 leaf capsules cannot share ring 2 at the base radius — Δ must have pushed ring 1 well out.
    expect(geo.ringInnerMm[1]).toBeGreaterThan(100);
    // and every node still uses the tier font (never shrunk):
    const scene = fanLayout(m, measure);
    for (const n of scene.nodes.filter((x) => x.generation === 2)) expect(n.fontMm).toBe(8.7);
  });

  it('ring couples sit tangentially adjacent with the couple arc gap, partners[0] on the left', () => {
    const m = model(
      [
        { id: 'u:a+b', partners: ['a', 'b'], childIds: ['big'] },
        { id: 'u:big+bw', partners: ['big', 'bw'], childIds: ['gc'] },
      ],
      ['a', 'b', 'big', 'bw', 'gc'],
    );
    const geo = fanGeometry(m, measure);
    const big = geo.placements.find((p) => p.personId === 'big')!;
    const bw = geo.placements.find((p) => p.personId === 'bw')!;
    expect(big.rInnerMm).toBe(bw.rInnerMm);
    expect(big.thetaRad).toBeGreaterThan(bw.thetaRad); // partners[0] takes the higher-θ (left) slot
    const arcSep = (big.thetaRad - bw.thetaRad) * big.rInnerMm;
    const h = (id: string) => geo.capsById.get(id)!.hMm;
    expect(arcSep).toBeCloseTo(h('big') / 2 + h('bw') / 2 + COUPLE_ARC_GAP_MM, 6);
  });
});

describe('fanLayout — collision and bounds invariants', () => {
  it('auto-flip: left-half labels flip (positive rotation), right-half don’t; |rotation| ≤ 90 everywhere', () => {
    const m = model([{ id: 'u:a+b', partners: ['a', 'b'], childIds: ['c0', 'c1', 'c2'] }], ['a', 'b', 'c0', 'c1', 'c2']);
    const scene = fanLayout(m, measure);
    const rot = (id: string) => scene.nodes.find((n) => n.personId === id)!.rotateDeg!;
    // equal weights ⇒ wedge mids at 150° / 90° / 30°
    expect(rot('c0')).toBeCloseTo(30, 5);           // 150°: flipped ⇒ 180−150
    expect(Math.abs(rot('c1'))).toBeCloseTo(90, 5); // 90°: vertical — wedge-mid float noise may land
    // a hair past 90° and legitimately flip (−90 vs +90−ε); the magnitude is the invariant
    expect(rot('c2')).toBeCloseTo(-30, 5);          // 30°
    for (const n of scene.nodes) expect(Math.abs(n.rotateDeg ?? 0)).toBeLessThanOrEqual(90);
  });

  it('no rotated capsule boxes overlap anywhere (SAT over corner quads)', () => {
    const scene = fanLayout(mixedModel(), measure);
    for (const a of scene.nodes) for (const b of scene.nodes) {
      if (a === b) continue;
      expect(overlapOBB(nodeCorners(a), nodeCorners(b)), `${a.personId} vs ${b.personId}`).toBe(false);
    }
  });

  it('scene bounds contain every rotated corner (canvas/export never crops the fan)', () => {
    const scene = fanLayout(mixedModel(), measure);
    for (const n of scene.nodes) for (const c of nodeCorners(n)) {
      expect(c.x).toBeGreaterThanOrEqual(-1e-9);
      expect(c.y).toBeGreaterThanOrEqual(-1e-9);
      expect(c.x).toBeLessThanOrEqual(scene.wMm + 1e-9);
      expect(c.y).toBeLessThanOrEqual(scene.hMm + 1e-9);
    }
  });

  it('connectors never enter a non-endpoint capsule (65-sample bézier sweep vs rotated rects)', () => {
    const m = mixedModel();
    const scene = fanLayout(m, measure);
    const partnersOf = new Map(m.unions.map((u) => [u.id, u.partners as readonly string[]]));
    for (const e of scene.edges) {
      const nums = e.d.match(/-?\d+(\.\d+)?(e[+-]?\d+)?/gi)!.map(Number);
      expect(nums).toHaveLength(8); // M x y C x1 y1 x2 y2 x y
      const P = [nums[0], nums[1]], c1 = [nums[2], nums[3]], c2 = [nums[4], nums[5]], T = [nums[6], nums[7]];
      const skip = new Set([...(partnersOf.get(e.fromId) ?? []), e.toId]);
      for (let s = 0; s <= 64; s++) {
        const t = s / 64, u = 1 - t;
        const px = u * u * u * P[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * T[0];
        const py = u * u * u * P[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * T[1];
        for (const n of scene.nodes) {
          if (skip.has(n.personId)) continue;
          expect(insideNode(n, px, py), `edge ${e.fromId}→${e.toId} enters ${n.personId} at t=${t.toFixed(3)}`).toBe(false);
        }
      }
    }
  });

  it('edges carry union→first-partner ids and a single cubic', () => {
    const m = model([{ id: 'u:a+b', partners: ['a', 'b'], childIds: ['c0'] }], ['a', 'b', 'c0']);
    const scene = fanLayout(m, measure);
    expect(scene.edges).toHaveLength(1);
    expect(scene.edges[0]).toMatchObject({ fromId: 'u:a+b', toId: 'c0' });
    expect(scene.edges[0].d).toMatch(/^M -?[\d.eE+-]+ -?[\d.eE+-]+ C /);
  });
});
