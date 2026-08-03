import type { FamilyModel, Person, Union } from '../data/types';
import { formatYears } from '../data/years';
import { wrapName } from '../print/wrap';

export const NAME_FONT_MM: readonly number[] = [12, 10.2, 8.7, 7.4, 6.5];
export const yearFontMm = (nameMm: number): number => Math.max(3.2, 0.55 * nameMm);
const fontFor = (gen: number) => NAME_FONT_MM[Math.min(gen, NAME_FONT_MM.length - 1)];

export const GEN_GAP_MM = 16;
export const SIBLING_GAP_MM = 5;
export const COUPLE_GAP_MM = 2;
export const CANVAS_MARGIN_MM = 8;
const PAD_X = 4;
const PAD_Y = 2.5;
const LINE_H = 1.4;
const WRAP_EM = 11;
const LEAF_WRAP_THRESHOLD = 6;

export interface PrintNode {
  personId: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  generation: number;
  nameLines: string[];
  years: string | null;
  fontMm: number;
  titleFace: boolean;
}
export interface PrintEdge {
  d: string;
  fromId: string;
  toId: string;
}
export interface PrintScene {
  nodes: PrintNode[];
  edges: PrintEdge[];
  wMm: number;
  hMm: number;
}
export type PrintMeasurer = (text: string, fontMm: number, titleFace: boolean) => number;

type TreeNode = { kind: 'union'; union: Union; children: TreeNode[] } | { kind: 'person'; personId: string };

/** Capsule box + text content for one person at a given generation. */
function capsule(p: Person, gen: number, measure: PrintMeasurer) {
  const fontMm = fontFor(gen);
  const titleFace = gen <= 1;
  const name = p.cleanName ?? p.fullName;
  const nameLines = wrapName(name, WRAP_EM * fontMm, (t) => measure(t, fontMm, titleFace));
  const years = formatYears(p.birthYear, p.deathYear);
  const yMmFont = yearFontMm(fontMm);
  const textW = Math.max(
    ...nameLines.map((l) => measure(l, fontMm, titleFace)),
    years ? measure(years, yMmFont, false) : 0,
  );
  const hMm = 2 * PAD_Y + nameLines.length * LINE_H * fontMm + (years ? LINE_H * yMmFont : 0);
  return { wMm: 2 * PAD_X + textW, hMm, nameLines, years, fontMm, titleFace };
}

export function flowLayout(model: FamilyModel, measure: PrintMeasurer): PrintScene {
  // — identical tree construction to layoutTree (transposed placement below) —
  const unionOfPartner = new Map<string, Union>();
  for (const u of model.unions) for (const p of u.partners) unionOfPartner.set(p, u);
  const visited = new Set<string>();
  const toNode = (personId: string): TreeNode | null => {
    const u = unionOfPartner.get(personId);
    if (!u) return { kind: 'person', personId };
    if (visited.has(u.id)) return null;
    return unionNode(u);
  };
  const unionNode = (u: Union): TreeNode => {
    visited.add(u.id);
    return { kind: 'union', union: u, children: u.childIds.map(toNode).filter((n): n is TreeNode => n !== null) };
  };
  const root: TreeNode = model.rootId.startsWith('p:')
    ? { kind: 'person', personId: model.rootId.slice(2) }
    : unionNode(model.unions.find((u) => u.id === model.rootId)!);

  // capsule cache + per-generation column widths
  const caps = new Map<string, ReturnType<typeof capsule>>();
  const colW: number[] = [];
  const measureCaps = (n: TreeNode, gen: number) => {
    const ids = n.kind === 'person' ? [n.personId] : n.union.partners;
    for (const id of ids) {
      const c = capsule(model.persons.get(id)!, gen, measure);
      caps.set(id, c);
      colW[gen] = Math.max(colW[gen] ?? 0, c.wMm);
    }
    if (n.kind === 'union') for (const child of n.children) measureCaps(child, gen + 1);
  };
  measureCaps(root, 0);
  const colX: number[] = [];
  colW.reduce((x, w, g) => {
    colX[g] = x;
    return x + w + GEN_GAP_MM;
  }, CANVAS_MARGIN_MM);

  const isLeafPerson = (n: TreeNode) => n.kind === 'person';
  const ownHeight = (n: TreeNode): number =>
    n.kind === 'person'
      ? caps.get(n.personId)!.hMm
      : n.union.partners.reduce((s, p) => s + caps.get(p)!.hMm, 0) + (n.union.partners.length - 1) * COUPLE_GAP_MM;

  // slot heights (transpose of layoutTree's widths), with leaf-run wrap
  const heights = new Map<TreeNode, number>();
  const wrapsAsLeafRun = (n: TreeNode) =>
    n.kind === 'union' && n.children.length > LEAF_WRAP_THRESHOLD && n.children.every(isLeafPerson);
  const measureH = (n: TreeNode): number => {
    let h = ownHeight(n);
    if (n.kind === 'union' && n.children.length > 0) {
      let kids: number;
      if (wrapsAsLeafRun(n)) {
        const rows = Math.ceil(n.children.length / 2);
        const rowH = (i: number) =>
          Math.max(...[n.children[i], n.children[i + rows]].filter(Boolean).map((c) => measureH(c!)));
        kids =
          Array.from({ length: rows }, (_, i) => rowH(i)).reduce((s, v) => s + v, 0) + SIBLING_GAP_MM * (rows - 1);
      } else {
        kids = n.children.reduce((s, c) => s + measureH(c), 0) + SIBLING_GAP_MM * (n.children.length - 1);
      }
      h = Math.max(h, kids);
    }
    heights.set(n, h);
    return h;
  };
  measureH(root);

  const nodes: PrintNode[] = [];
  const edges: PrintEdge[] = [];
  const pushPerson = (id: string, gen: number, x: number, y: number) => {
    const c = caps.get(id)!;
    nodes.push({ personId: id, xMm: x, yMm: y, generation: gen, ...c });
  };

  const place = (n: TreeNode, top: number, gen: number) => {
    const x = colX[gen];
    const slot = heights.get(n)!;
    const own = ownHeight(n);
    const ownTop = top + (slot - own) / 2;

    if (n.kind === 'person') {
      pushPerson(n.personId, gen, x, ownTop);
      return;
    }

    let py = ownTop;
    for (const p of n.union.partners) {
      pushPerson(p, gen, x, py);
      py += caps.get(p)!.hMm + COUPLE_GAP_MM;
    }
    const anchor = { x: x + Math.max(...n.union.partners.map((p) => caps.get(p)!.wMm)), y: ownTop + own / 2 };
    const busX = colX[gen] + colW[gen] + GEN_GAP_MM / 2;

    if (wrapsAsLeafRun(n)) {
      const rows = Math.ceil(n.children.length / 2);
      const runW = Math.max(...n.children.map((c) => caps.get((c as { personId: string }).personId)!.wMm));
      const kidsH =
        Array.from({ length: rows }, (_, i) =>
          Math.max(...[n.children[i], n.children[i + rows]].filter(Boolean).map((c) => heights.get(c!)!)),
        ).reduce((s, v) => s + v, 0) + SIBLING_GAP_MM * (rows - 1);
      let rowTop = top + (slot - kidsH) / 2;
      for (let i = 0; i < rows; i++) {
        const rowH = Math.max(...[n.children[i], n.children[i + rows]].filter(Boolean).map((c) => heights.get(c!)!));
        for (const [j, child] of [n.children[i], n.children[i + rows]].entries()) {
          if (!child) continue;
          const cx = colX[gen + 1] + j * (runW + SIBLING_GAP_MM);
          const id = (child as { personId: string }).personId;
          const c = caps.get(id)!;
          nodes.push({ personId: id, xMm: cx, yMm: rowTop + (rowH - c.hMm) / 2, generation: gen + 1, ...c });
          edges.push({
            fromId: n.union.id,
            toId: id,
            d: `M ${anchor.x} ${anchor.y} C ${busX} ${anchor.y} ${busX} ${rowTop + rowH / 2} ${cx} ${rowTop + rowH / 2}`,
          });
        }
        rowTop += rowH + SIBLING_GAP_MM;
      }
      return;
    }

    const placeChildEdge = (child: TreeNode, childTop: number, childSlot: number, cx: number) => {
      const targetId = child.kind === 'person' ? child.personId : child.union.partners[0];
      const childOwn = ownHeight(child);
      const ty = childTop + (childSlot - childOwn) / 2 + caps.get(targetId)!.hMm / 2;
      edges.push({
        fromId: n.union.id,
        toId: targetId,
        d: `M ${anchor.x} ${anchor.y} C ${busX} ${anchor.y} ${busX} ${ty} ${cx} ${ty}`,
      });
    };

    const kidsH = n.children.reduce((s, c) => s + heights.get(c)!, 0) + SIBLING_GAP_MM * Math.max(0, n.children.length - 1);
    let childTop = top + (slot - kidsH) / 2;
    for (const child of n.children) {
      const ch = heights.get(child)!;
      placeChildEdge(child, childTop, ch, colX[gen + 1]);
      place(child, childTop, gen + 1);
      childTop += ch + SIBLING_GAP_MM;
    }
  };
  place(root, CANVAS_MARGIN_MM, 0);

  // Derived from actual node extents, not colX/colW bookkeeping: a leaf-run's second
  // mini-column (Concept C) can render past the nominal last-generation column edge,
  // so sizing the canvas off colX/colW alone would crop it.
  const wMm = Math.max(...nodes.map((n) => n.xMm + n.wMm)) + CANVAS_MARGIN_MM;
  const hMm = Math.max(...nodes.map((n) => n.yMm + n.hMm)) + CANVAS_MARGIN_MM;
  return { nodes, edges, wMm, hMm };
}

/** Same no-silent-drop contract as layout-engine.unplacedIds (spec §Error handling 1). */
export function printUnplacedIds(model: FamilyModel, scene: PrintScene): string[] {
  const placed = new Set(scene.nodes.map((n) => n.personId));
  return [...model.persons.keys()].filter((id) => !placed.has(id) && !model.excludedIds.includes(id));
}
