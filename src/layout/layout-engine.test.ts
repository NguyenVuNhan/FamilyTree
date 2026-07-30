import { describe, expect, it } from 'vitest';
import type { PersonRow } from '../data/types';
import { buildModel } from '../data/build-model';
import { layoutTree, unplacedIds } from './layout-engine';
import { CARD_H, CARD_W, COUPLE_GAP, GEN_GAP, MARGIN, SIBLING_GAP } from './constants';

// Layout is format-agnostic: build PersonRow[] directly. (Some shapes below —
// multi-root in-laws, cousins marrying — are deliberately inexpressible in the
// staircase sheet format but must keep working at the model/layout level.)
const P = (rowNumber: number, id: string, o: Partial<PersonRow> = {}): PersonRow => ({
  rowNumber, id, fullName: id.toUpperCase(), image: '', partnerId: '', parentIds: [], ...o,
});
const lay = (rows: PersonRow[]) => layoutTree(buildModel(rows));
const card = (r: ReturnType<typeof lay>, id: string) => r.cards.find((c) => c.personId === id)!;

describe('layoutTree', () => {
  it('single person: one centered card, no connectors', () => {
    const r = lay([P(2, 'a')]);
    expect(r.cards).toEqual([{ personId: 'a', x: MARGIN, y: MARGIN }]);
    expect(r.connectors).toEqual([]);
    expect(r.width).toBe(CARD_W + 2 * MARGIN);
    expect(r.height).toBe(CARD_H + 2 * MARGIN);
  });

  it('couple: partners side by side with one marriage line', () => {
    const r = lay([P(2, 'a', { partnerId: 'b' }), P(3, 'b')]);
    expect(card(r, 'a').x).toBe(MARGIN);
    expect(card(r, 'b').x).toBe(MARGIN + CARD_W + COUPLE_GAP);
    expect(card(r, 'a').y).toBe(card(r, 'b').y);
    expect(r.connectors).toHaveLength(1); // marriage line only
  });

  it('parents are centered above their children span', () => {
    const r = lay([
      P(2, 'ma', { partnerId: 'pa' }), P(3, 'pa'),
      P(4, 'k1', { parentIds: ['ma', 'pa'] }), P(5, 'k2', { parentIds: ['ma', 'pa'] }),
    ]);
    const coupleCenter = (card(r, 'ma').x + card(r, 'pa').x + CARD_W) / 2;
    const childrenCenter = (card(r, 'k1').x + card(r, 'k2').x + CARD_W) / 2;
    expect(coupleCenter).toBeCloseTo(childrenCenter);
    expect(card(r, 'k1').y).toBe(card(r, 'ma').y + CARD_H + GEN_GAP);
  });

  it('sibling subtrees do not overlap (9 children)', () => {
    const kids = Array.from({ length: 9 }, (_, i) => P(4 + i, `k${i}`, { parentIds: ['ma', 'pa'] }));
    const r = lay([P(2, 'ma', { partnerId: 'pa' }), P(3, 'pa'), ...kids]);
    const xs = r.cards.filter((c) => c.personId.startsWith('k')).map((c) => c.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(CARD_W + SIBLING_GAP);
  });

  it('married child brings the in-law into the same generation row', () => {
    const r = lay([
      P(2, 'ma', { partnerId: 'pa' }), P(3, 'pa'),
      P(4, 'son', { partnerId: 'wife', parentIds: ['ma', 'pa'] }), P(5, 'wife'),
    ]);
    expect(card(r, 'wife').y).toBe(card(r, 'son').y);
  });

  it('4-generation chain stacks generations', () => {
    const r = lay([
      P(2, 'g1'), P(3, 'g2', { parentIds: ['g1'] }),
      P(4, 'g3', { parentIds: ['g2'] }), P(5, 'g4', { parentIds: ['g3'] }),
    ]);
    expect(card(r, 'g4').y - card(r, 'g1').y).toBe(3 * (CARD_H + GEN_GAP));
  });

  it('connector count: couple with 2 children = marriage + 2 drops', () => {
    const r = lay([
      P(2, 'ma', { partnerId: 'pa' }), P(3, 'pa'),
      P(4, 'k1', { parentIds: ['ma', 'pa'] }), P(5, 'k2', { parentIds: ['ma', 'pa'] }),
    ]);
    expect(r.connectors).toHaveLength(3);
  });

  it('all coordinates are inside the reported canvas', () => {
    const r = lay([P(2, 'ma', { partnerId: 'pa' }), P(3, 'pa'), P(4, 'k1', { parentIds: ['ma', 'pa'] })]);
    for (const c of r.cards) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + CARD_W).toBeLessThanOrEqual(r.width);
      expect(c.y + CARD_H).toBeLessThanOrEqual(r.height);
    }
  });
});

describe('multi-root sheets (a rendered child\'s spouse\'s parents are also present)', () => {
  // ra+rb is the root union (son's parents). son marries wife; wife's own parents
  // (fa+mo) are a second root-candidate union in the same connected component, but
  // the single-root tree walk never reaches them from ra+rb's side.
  const ROWS = [
    P(2, 'ra', { partnerId: 'rb' }), P(3, 'rb'),
    P(4, 'son', { partnerId: 'wife', parentIds: ['ra', 'rb'] }),
    P(5, 'fa', { partnerId: 'mo' }), P(6, 'mo'),
    P(7, 'wife', { parentIds: ['fa', 'mo'] }),
  ];

  it('the orphaned in-laws never get a card', () => {
    const model = buildModel(ROWS);
    const layout = layoutTree(model);
    const ids = layout.cards.map((c) => c.personId);
    expect(ids).not.toContain('fa');
    expect(ids).not.toContain('mo');
  });

  it('unplacedIds reports exactly the orphaned in-laws', () => {
    const model = buildModel(ROWS);
    const layout = layoutTree(model);
    expect(unplacedIds(model, layout)).toEqual(['fa', 'mo']);
  });

  it('unplacedIds is empty for an ordinary well-formed tree', () => {
    const model = buildModel([P(2, 'ma', { partnerId: 'pa' }), P(3, 'pa'), P(4, 'k1', { parentIds: ['ma', 'pa'] })]);
    const layout = layoutTree(model);
    expect(unplacedIds(model, layout)).toEqual([]);
  });
});

describe('two rendered children marrying each other (dedupes the shared union)', () => {
  const ROWS = [
    P(2, 'g1', { partnerId: 'g2' }), P(3, 'g2'),
    P(4, 'm', { partnerId: 'x', parentIds: ['g1', 'g2'] }),
    P(5, 'f', { partnerId: 'y', parentIds: ['g1', 'g2'] }),
    P(6, 'x'), P(7, 'y'),
    P(8, 'a', { partnerId: 'b', parentIds: ['m', 'x'] }),
    P(9, 'b', { parentIds: ['f', 'y'] }),
  ];

  it('every person appears exactly once in layout.cards (no duplicate keys)', () => {
    const model = buildModel(ROWS);
    const layout = layoutTree(model);
    const ids = layout.cards.map((c) => c.personId);
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) expect(count, `${id} appeared ${count} times`).toBe(1);
    expect(new Set(ids)).toEqual(new Set(['g1', 'g2', 'm', 'x', 'f', 'y', 'a', 'b']));
  });

  it('nothing is left unplaced — the shared union is rendered once, not dropped', () => {
    const model = buildModel(ROWS);
    const layout = layoutTree(model);
    expect(unplacedIds(model, layout)).toEqual([]);
  });
});
