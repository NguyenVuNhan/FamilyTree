import type { FamilyModel, Union } from '../data/types';
import { CARD_H, CARD_W, COUPLE_GAP, GEN_GAP, MARGIN, SIBLING_GAP } from './constants';
import { elbowDrop, marriageLine } from './elbow-paths';

export interface PlacedCard {
  personId: string;
  x: number;
  y: number;
}
export interface LayoutResult {
  cards: PlacedCard[];
  connectors: string[];
  width: number;
  height: number;
}

type Node = { kind: 'union'; union: Union; children: Node[] } | { kind: 'person'; personId: string };

export function layoutTree(model: FamilyModel): LayoutResult {
  const unionOfPartner = new Map<string, Union>();
  for (const u of model.unions) for (const p of u.partners) unionOfPartner.set(p, u);

  const toNode = (personId: string): Node => {
    const u = unionOfPartner.get(personId);
    return u ? unionNode(u) : { kind: 'person', personId };
  };
  const unionNode = (u: Union): Node => ({ kind: 'union', union: u, children: u.childIds.map(toNode) });

  const root: Node = model.rootId.startsWith('p:')
    ? { kind: 'person', personId: model.rootId.slice(2) }
    : unionNode(model.unions.find((u) => u.id === model.rootId)!);

  const ownWidth = (n: Node) =>
    n.kind === 'person' ? CARD_W : n.union.partners.length * CARD_W + (n.union.partners.length - 1) * COUPLE_GAP;
  const widths = new Map<Node, number>();
  const measure = (n: Node): number => {
    let w = ownWidth(n);
    if (n.kind === 'union' && n.children.length > 0) {
      const kids = n.children.reduce((sum, c) => sum + measure(c), 0) + SIBLING_GAP * (n.children.length - 1);
      w = Math.max(w, kids);
    }
    widths.set(n, w);
    return w;
  };
  measure(root);

  const cards: PlacedCard[] = [];
  const connectors: string[] = [];
  const place = (n: Node, left: number, depth: number) => {
    const y = MARGIN + depth * (CARD_H + GEN_GAP);
    const slot = widths.get(n)!;
    const own = ownWidth(n);
    const ownLeft = left + (slot - own) / 2;

    if (n.kind === 'person') {
      cards.push({ personId: n.personId, x: ownLeft, y });
      return;
    }
    n.union.partners.forEach((p, i) => cards.push({ personId: p, x: ownLeft + i * (CARD_W + COUPLE_GAP), y }));

    const midY = y + CARD_H / 2;
    const anchor =
      n.union.partners.length === 2
        ? { x: ownLeft + CARD_W + COUPLE_GAP / 2, y: midY }
        : { x: ownLeft + CARD_W / 2, y: y + CARD_H };
    if (n.union.partners.length === 2) {
      connectors.push(marriageLine(ownLeft + CARD_W, ownLeft + CARD_W + COUPLE_GAP, midY));
    }

    const childrenWidth =
      n.children.reduce((s, c) => s + widths.get(c)!, 0) + SIBLING_GAP * Math.max(0, n.children.length - 1);
    let childLeft = left + (slot - childrenWidth) / 2;
    const busY = y + CARD_H + GEN_GAP / 2;
    for (const child of n.children) {
      const cw = widths.get(child)!;
      const childOwnW = ownWidth(child);
      const childCardX = childLeft + (cw - childOwnW) / 2 + CARD_W / 2; // first card center = child anchor
      connectors.push(elbowDrop(anchor, { x: childCardX, y: MARGIN + (depth + 1) * (CARD_H + GEN_GAP) }, busY));
      place(child, childLeft, depth + 1);
      childLeft += cw + SIBLING_GAP;
    }
  };
  place(root, MARGIN, 0);

  const depthMax = Math.max(...cards.map((c) => c.y));
  return {
    cards,
    connectors,
    width: widths.get(root)! + 2 * MARGIN,
    height: depthMax + CARD_H + MARGIN,
  };
}
