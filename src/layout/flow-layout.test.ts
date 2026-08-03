import { describe, expect, it } from 'vitest';
import type { FamilyModel } from '../data/types';
import { NAME_FONT_MM, flowLayout, printUnplacedIds, yearFontMm, type PrintMeasurer } from './flow-layout';

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
    excludedIds: [],
  };
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
    const scene = flowLayout(couple(Array.from({ length: 9 }, (_, i) => ({ id: `c${i}` }))), measure);
    for (const a of scene.nodes) for (const b of scene.nodes) {
      if (a === b) continue;
      const apart = a.xMm + a.wMm <= b.xMm || b.xMm + b.wMm <= a.xMm ||
                    a.yMm + a.hMm <= b.yMm || b.yMm + b.hMm <= a.yMm;
      expect(apart, `${a.personId} vs ${b.personId}`).toBe(true);
    }
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
    const persons = new Map<string, { id: string; fullName: string; cleanName: string }>();
    persons.set('a', { id: 'a', fullName: 'A', cleanName: 'A' });
    persons.set('b', { id: 'b', fullName: 'B', cleanName: 'B' });
    for (let i = 0; i < 8; i++) {
      persons.set(`k${i}`, { id: `k${i}`, fullName: 'Alexanderoo', cleanName: 'Alexanderoo' });
    }
    const model: FamilyModel = {
      persons,
      unions: [{ id: 'u:a+b', partners: ['a', 'b'], childIds: Array.from({ length: 8 }, (_, i) => `k${i}`) }],
      rootId: 'u:a+b',
      excludedIds: [],
    };
    const scene = flowLayout(model, measure);
    for (const n of scene.nodes) {
      expect(n.xMm + n.wMm).toBeLessThanOrEqual(scene.wMm);
      expect(n.yMm + n.hMm).toBeLessThanOrEqual(scene.hMm);
    }
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
