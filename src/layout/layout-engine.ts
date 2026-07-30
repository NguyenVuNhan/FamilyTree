import type { FamilyModel, Union } from '../data/types';
import type { LayoutMetrics } from './card-metrics';
import { childDrop, marriageLine } from './elbow-paths';

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

export function layoutTree(model: FamilyModel, m: LayoutMetrics): LayoutResult {
  const unionOfPartner = new Map<string, Union>();
  for (const u of model.unions) for (const p of u.partners) unionOfPartner.set(p, u);

  // A union can be reachable from more than one branch — e.g. two people who each
  // render as a child elsewhere later marry each other (cousins marrying). Walk each
  // union at most once: whichever branch reaches it first renders it (and its
  // descendants) in full; a later branch that would reach the same union again drops
  // that child slot entirely instead of re-walking (and duplicating) it — the shared
  // person already has a card from the first branch.
  const visitedUnions = new Set<string>();

  const toNode = (personId: string): Node | null => {
    const u = unionOfPartner.get(personId);
    if (!u) return { kind: 'person', personId };
    if (visitedUnions.has(u.id)) return null;
    return unionNode(u);
  };
  const unionNode = (u: Union): Node => {
    visitedUnions.add(u.id);
    return { kind: 'union', union: u, children: u.childIds.map(toNode).filter((n): n is Node => n !== null) };
  };

  const root: Node = model.rootId.startsWith('p:')
    ? { kind: 'person', personId: model.rootId.slice(2) }
    : unionNode(model.unions.find((u) => u.id === model.rootId)!);

  const ownWidth = (n: Node) =>
    n.kind === 'person' ? m.cardW : n.union.partners.length * m.cardW + (n.union.partners.length - 1) * m.coupleGap;
  const widths = new Map<Node, number>();
  const measure = (n: Node): number => {
    let w = ownWidth(n);
    if (n.kind === 'union' && n.children.length > 0) {
      const kids = n.children.reduce((sum, c) => sum + measure(c), 0) + m.siblingGap * (n.children.length - 1);
      w = Math.max(w, kids);
    }
    widths.set(n, w);
    return w;
  };
  measure(root);

  const cards: PlacedCard[] = [];
  const connectors: string[] = [];
  const place = (n: Node, left: number, depth: number) => {
    const y = m.margin + depth * (m.cardH + m.genGap);
    const slot = widths.get(n)!;
    const own = ownWidth(n);
    const ownLeft = left + (slot - own) / 2;

    if (n.kind === 'person') {
      cards.push({ personId: n.personId, x: ownLeft, y });
      return;
    }
    n.union.partners.forEach((p, i) => cards.push({ personId: p, x: ownLeft + i * (m.cardW + m.coupleGap), y }));

    const midY = y + m.cardH / 2;
    const anchor =
      n.union.partners.length === 2
        ? { x: ownLeft + m.cardW + m.coupleGap / 2, y: midY }
        : { x: ownLeft + m.cardW / 2, y: y + m.cardH };
    if (n.union.partners.length === 2) {
      connectors.push(marriageLine(ownLeft + m.cardW, ownLeft + m.cardW + m.coupleGap, midY));
    }

    const childrenWidth =
      n.children.reduce((s, c) => s + widths.get(c)!, 0) + m.siblingGap * Math.max(0, n.children.length - 1);
    let childLeft = left + (slot - childrenWidth) / 2;
    const busY = y + m.cardH + m.genGap / 2;
    for (const child of n.children) {
      const cw = widths.get(child)!;
      const childOwnW = ownWidth(child);
      const childCardX = childLeft + (cw - childOwnW) / 2 + m.cardW / 2; // first card center = child anchor
      connectors.push(
        childDrop(
          m.connectorStyle,
          anchor,
          { x: childCardX, y: m.margin + (depth + 1) * (m.cardH + m.genGap) },
          busY,
        ),
      );
      place(child, childLeft, depth + 1);
      childLeft += cw + m.siblingGap;
    }
  };
  place(root, m.margin, 0);

  const depthMax = Math.max(...cards.map((c) => c.y));
  return {
    cards,
    connectors,
    width: widths.get(root)! + 2 * m.margin,
    height: depthMax + m.cardH + m.margin,
  };
}

/**
 * Persons present in the model (single connected component) that never received a card —
 * e.g. a rendered child's spouse's parents form a second root-candidate union that the
 * single-root tree walk in layoutTree never reaches. Never a silent drop: callers should
 * surface this as a warning (spec §6).
 */
export function unplacedIds(model: FamilyModel, layout: LayoutResult): string[] {
  const placed = new Set(layout.cards.map((c) => c.personId));
  return [...model.persons.keys()].filter((id) => !placed.has(id)).sort();
}
