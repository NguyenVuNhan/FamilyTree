import { describe, expect, it } from 'vitest';
import { parseCsv } from '../data/csv-parser';
import { buildModel } from '../data/build-model';
import { layoutTree } from './layout-engine';
import { CARD_H, CARD_W, COUPLE_GAP, GEN_GAP, MARGIN, SIBLING_GAP } from './constants';

const H = 'ID,FullName,Image,PartnerID,ParentIDs';
const lay = (csv: string) => layoutTree(buildModel(parseCsv(csv)));
const card = (r: ReturnType<typeof lay>, id: string) => r.cards.find((c) => c.personId === id)!;

describe('layoutTree', () => {
  it('single person: one centered card, no connectors', () => {
    const r = lay(`${H}\na,Ann,,,`);
    expect(r.cards).toEqual([{ personId: 'a', x: MARGIN, y: MARGIN }]);
    expect(r.connectors).toEqual([]);
    expect(r.width).toBe(CARD_W + 2 * MARGIN);
    expect(r.height).toBe(CARD_H + 2 * MARGIN);
  });

  it('couple: partners side by side with one marriage line', () => {
    const r = lay(`${H}\na,Ann,,b,\nb,Bob,,,`);
    expect(card(r, 'a').x).toBe(MARGIN);
    expect(card(r, 'b').x).toBe(MARGIN + CARD_W + COUPLE_GAP);
    expect(card(r, 'a').y).toBe(card(r, 'b').y);
    expect(r.connectors).toHaveLength(1); // marriage line only
  });

  it('parents are centered above their children span', () => {
    const r = lay(`${H}\nma,Ma,,pa,\npa,Pa,,,\nk1,K1,,,ma;pa\nk2,K2,,,ma;pa`);
    const coupleCenter = (card(r, 'ma').x + card(r, 'pa').x + CARD_W) / 2;
    const childrenCenter = (card(r, 'k1').x + card(r, 'k2').x + CARD_W) / 2;
    expect(coupleCenter).toBeCloseTo(childrenCenter);
    expect(card(r, 'k1').y).toBe(card(r, 'ma').y + CARD_H + GEN_GAP);
  });

  it('sibling subtrees do not overlap (9 children)', () => {
    const kids = Array.from({ length: 9 }, (_, i) => `k${i},Kid ${i},,,ma;pa`).join('\n');
    const r = lay(`${H}\nma,Ma,,pa,\npa,Pa,,,\n${kids}`);
    const xs = r.cards.filter((c) => c.personId.startsWith('k')).map((c) => c.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(CARD_W + SIBLING_GAP);
  });

  it('married child brings the in-law into the same generation row', () => {
    const r = lay(`${H}\nma,Ma,,pa,\npa,Pa,,,\nson,Son,,wife,ma;pa\nwife,Wife,,,`);
    expect(card(r, 'wife').y).toBe(card(r, 'son').y);
  });

  it('4-generation chain stacks generations', () => {
    const r = lay(`${H}\ng1,G1,,,\ng2,G2,,,g1\ng3,G3,,,g2\ng4,G4,,,g3`);
    expect(card(r, 'g4').y - card(r, 'g1').y).toBe(3 * (CARD_H + GEN_GAP));
  });

  it('connector count: couple with 2 children = marriage + 2 drops', () => {
    const r = lay(`${H}\nma,Ma,,pa,\npa,Pa,,,\nk1,K1,,,ma;pa\nk2,K2,,,ma;pa`);
    expect(r.connectors).toHaveLength(3);
  });

  it('all coordinates are inside the reported canvas', () => {
    const r = lay(`${H}\nma,Ma,,pa,\npa,Pa,,,\nk1,K1,,,ma;pa`);
    for (const c of r.cards) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + CARD_W).toBeLessThanOrEqual(r.width);
      expect(c.y + CARD_H).toBeLessThanOrEqual(r.height);
    }
  });
});
