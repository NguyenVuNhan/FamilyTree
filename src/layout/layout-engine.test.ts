import { describe, expect, it } from 'vitest';
import { parseCsv } from '../data/csv-parser';
import { buildModel } from '../data/build-model';
import { layoutTree, unplacedIds } from './layout-engine';
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

describe('multi-root sheets (a rendered child\'s spouse\'s parents are also present)', () => {
  // ra+rb is the root union (son's parents). son marries wife; wife's own parents
  // (fa+mo) are a second root-candidate union in the same connected component, but
  // the single-root tree walk never reaches them from ra+rb's side.
  const CSV = `${H}
ra,Ra,,rb,
rb,Rb,,,
son,Son,,wife,ra;rb
fa,Fa,,mo,
mo,Mo,,,
wife,Wife,,,fa;mo`;

  it('the orphaned in-laws never get a card', () => {
    const model = buildModel(parseCsv(CSV));
    const layout = layoutTree(model);
    const ids = layout.cards.map((c) => c.personId);
    expect(ids).not.toContain('fa');
    expect(ids).not.toContain('mo');
  });

  it('unplacedIds reports exactly the orphaned in-laws', () => {
    const model = buildModel(parseCsv(CSV));
    const layout = layoutTree(model);
    expect(unplacedIds(model, layout)).toEqual(['fa', 'mo']);
  });

  it('unplacedIds is empty for an ordinary well-formed tree', () => {
    const model = buildModel(parseCsv(`${H}\nma,Ma,,pa,\npa,Pa,,,\nk1,K1,,,ma;pa`));
    const layout = layoutTree(model);
    expect(unplacedIds(model, layout)).toEqual([]);
  });
});

describe('two rendered children marrying each other (dedupes the shared union)', () => {
  // g1+g2 is root, with children m and f. m marries x (child: a); f marries y (child:
  // b). a and b — each a rendered grandchild from a different branch — marry each other.
  const CSV = `${H}
g1,G1,,g2,
g2,G2,,,
m,M,,x,g1;g2
f,F,,y,g1;g2
x,X,,,
y,Y,,,
a,A,,b,m;x
b,B,,,f;y`;

  it('every person appears exactly once in layout.cards (no duplicate keys)', () => {
    const model = buildModel(parseCsv(CSV));
    const layout = layoutTree(model);
    const ids = layout.cards.map((c) => c.personId);
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) expect(count, `${id} appeared ${count} times`).toBe(1);
    expect(new Set(ids)).toEqual(new Set(['g1', 'g2', 'm', 'x', 'f', 'y', 'a', 'b']));
  });

  it('nothing is left unplaced — the shared union is rendered once, not dropped', () => {
    const model = buildModel(parseCsv(CSV));
    const layout = layoutTree(model);
    expect(unplacedIds(model, layout)).toEqual([]);
  });
});
