import type { FamilyModel } from '../data/types';
import {
  CANVAS_MARGIN_MM, COUPLE_GAP_MM, buildPrintTree, capsule,
  type PrintCapsule, type PrintEdge, type PrintMeasurer, type PrintNode, type PrintScene, type TreeNode,
} from './flow-layout';
import { flipRotation, polarPoint, solveInflation, waterfill, type SectorItem } from './fan-geometry';

export const RING_GAP_MM = 12;      // radial breathing room between rings
export const NODE_ARC_GAP_MM = 4;   // tangential gap between neighboring capsules on a ring
export const COUPLE_ARC_GAP_MM = 2; // tangential gap inside a couple (mirrors flow's COUPLE_GAP_MM)
export const MIN_WEDGE_DEG = 10;    // spec Concept A: minimum angular floor per root branch
export const MIN_ROOT_RING_MM = 40; // ring 1 never starts closer to the hub than this

const PI = Math.PI;
const MIN_WEDGE_RAD = (MIN_WEDGE_DEG * PI) / 180;

export interface FanPlacement {
  personId: string;
  generation: number;
  /** Capsule center angle (radians, D1 convention). */
  thetaRad: number;
  /** Inner-edge radius — the capsule spans [rInner, rInner + wMm] radially. */
  rInnerMm: number;
  flipped: boolean;
}

export interface FanGeometry {
  placements: FanPlacement[];
  /** Root-branch wedges in child order (left→right, i.e. decreasing θ); key =
   *  the branch's first person id (person, or union.partners[0]). */
  rootSectors: { key: string; startRad: number; endRad: number }[];
  /** Inner radius per generation index (index 0 unused — the root couple sits at the hub). */
  ringInnerMm: number[];
  /** Root-couple block, centered coords: block top-center at (0,0) on the diameter. */
  rootNodes: { personId: string; xMm: number; yMm: number }[];
  /** Cubic control points [P, c1, c2, T] per parent→child edge, centered coords. */
  edges: { fromId: string; toId: string; pts: { x: number; y: number }[] }[];
  capsById: Map<string, PrintCapsule>;
}

/** Polar truth of the fan: capsule metrics, ring radii (with Δ inflation),
 *  proportional-with-floor sectors, per-person (θ, r) placements, and radial
 *  bézier control points — everything in hub-centered coordinates. Pure and
 *  deterministic (the bisection runs a fixed iteration count). */
export function fanGeometry(model: FamilyModel, measure: PrintMeasurer): FanGeometry {
  const root = buildPrintTree(model);

  // 1 — capsules per person + max radial thickness (capsule WIDTH, D2) per generation
  const caps = new Map<string, PrintCapsule>();
  const thickness: number[] = [];
  const measureCaps = (n: TreeNode, gen: number) => {
    const ids = n.kind === 'person' ? [n.personId] : n.union.partners;
    for (const id of ids) {
      const c = capsule(model.persons.get(id)!, gen, measure);
      caps.set(id, c);
      thickness[gen] = Math.max(thickness[gen] ?? 0, c.wMm);
    }
    if (n.kind === 'union') for (const child of n.children) measureCaps(child, gen + 1);
  };
  measureCaps(root, 0);

  // 2 — root block (vertically stacked couple at the hub, D5) and base ring radii (D6)
  const rootIds = root.kind === 'person' ? [root.personId] : root.union.partners;
  const rootNodes: FanGeometry['rootNodes'] = [];
  let ry = 0;
  let blockW = 0;
  for (const id of rootIds) {
    const c = caps.get(id)!;
    rootNodes.push({ personId: id, xMm: -c.wMm / 2, yMm: ry });
    ry += c.hMm + COUPLE_GAP_MM;
    blockW = Math.max(blockW, c.wMm);
  }
  const maxGen = thickness.length - 1;
  const baseRing: number[] = [0];
  if (maxGen >= 1) baseRing[1] = Math.max(blockW / 2, MIN_ROOT_RING_MM) + RING_GAP_MM;
  for (let g = 2; g <= maxGen; g++) baseRing[g] = baseRing[g - 1] + thickness[g - 1] + RING_GAP_MM;

  // 3 — angular need per subtree at inflation Δ (D8)
  const rEff = (gen: number, delta: number) => baseRing[gen] + delta;
  const tangential = (n: TreeNode): number =>
    n.kind === 'person'
      ? caps.get(n.personId)!.hMm
      : n.union.partners.reduce((s, p) => s + caps.get(p)!.hMm, 0) +
        COUPLE_ARC_GAP_MM * (n.union.partners.length - 1);
  const need = (n: TreeNode, gen: number, delta: number): number => {
    const own = (tangential(n) + NODE_ARC_GAP_MM) / rEff(gen, delta);
    if (n.kind === 'person' || n.children.length === 0) return own;
    return Math.max(own, n.children.reduce((s, c) => s + need(c, gen + 1, delta), 0));
  };
  const rootChildren = root.kind === 'union' ? root.children : [];
  // A pathological root (> 18 branches at the 10° floor) can't honor the full
  // wedge — degrade to an equal share so floors stay feasible (never blocking).
  // Shave a relative 1e-9 off π: at n>=19, n*(π/n) can land a hair ABOVE π after
  // float round-off (verified empirically at n=19..30), which without this
  // epsilon made `rootNeed(delta) <= π` false for every δ — solveInflation then
  // fell through to its unchecked maxDelta and ring 1 exploded (~5000mm, F2).
  const effWedge = rootChildren.length > 0
    ? Math.min(MIN_WEDGE_RAD, (PI * (1 - 1e-9)) / rootChildren.length)
    : 0;
  const rootNeed = (delta: number) =>
    rootChildren.reduce((s, c) => s + Math.max(need(c, 1, delta), effWedge), 0);
  let delta = rootChildren.length > 0 ? solveInflation(rootNeed, PI) : 0;
  // Genuine overflow: Σ content need still exceeds π even at solveInflation's
  // default maxDelta (too much tangential content for a 180° arc). The root's
  // floors must degrade to equal shares (feasibleFloors, below) so waterfill
  // stays solvable — but an equal share is a FIXED, delta-independent value;
  // by itself it doesn't guarantee any branch's actual angular need fits it.
  // Re-solve δ against that equal share directly (with a far larger ceiling,
  // since this simpler per-branch target converges at a different — often
  // larger — δ than the aggregate one just tried): that keeps every branch's
  // own content honestly inside the wedge it's actually given, instead of
  // silently overlapping neighbors while still LOOKING like a huge, sane-ish
  // canvas. Round 1 instead reset δ to 0 outright here — collapsing every
  // ring back to base radius and hiding the overlaps behind an even MORE
  // plausible canvas (the reviewed regression: 500 leaves × 30-char names,
  // ring1 3053→82mm, 4933 overlapping pairs).
  const rootFloorsOverflow = rootChildren.length > 0 && rootNeed(delta) > PI;
  if (rootFloorsOverflow) {
    const equalShare = (PI * (1 - 1e-9)) / rootChildren.length;
    const maxChildNeed = (d: number) => Math.max(...rootChildren.map((c) => need(c, 1, d)));
    delta = solveInflation(maxChildNeed, equalShare, 1_000_000);
  }
  const ringInnerMm = baseRing.map((r) => r + delta);

  // Guards a waterfill call's precondition (Σ floors <= span). This normally
  // holds by construction: need() is recursively >= the sum of its own
  // children's needs, so once a branch's assigned span covers its own
  // need(), that automatically covers its children's needs too, propagating
  // down through the whole recursion. But when even δ's solved (possibly
  // maxDelta-capped) value can't bring the ROOT'S total need under π, the
  // root itself must degrade its floors to equal shares — and once a
  // branch's actual span no longer matches its own need(), that guarantee no
  // longer propagates to ITS children either, so a nested waterfill can
  // receive an infeasible Σ floor > span too (spans that don't sum to span,
  // spilling wedges into siblings). Re-apply the same degrade-to-equal-shares
  // strategy at whichever level the invariant actually breaks — root or any
  // nested call — so no waterfill call is ever handed an infeasible set.
  const feasibleFloors = (span: number, items: SectorItem[]): SectorItem[] => {
    const totalFloor = items.reduce((s, it) => s + it.floorRad, 0);
    if (totalFloor <= span) return items;
    const equalShare = (span * (1 - 1e-9)) / items.length;
    return items.map((it) => ({ ...it, floorRad: equalShare }));
  };

  // 4 — recursive sector assignment + placement (hub-centered; sectors run
  // left→right: startRad > endRad, both in [0, π])
  const personCount = (n: TreeNode): number =>
    n.kind === 'person' ? 1 : n.union.partners.length + n.children.reduce((s, c) => s + personCount(c), 0);
  const placements: FanPlacement[] = [];
  const edges: FanGeometry['edges'] = [];
  const rootSectors: FanGeometry['rootSectors'] = [];

  const place = (
    n: TreeNode, gen: number, startRad: number, endRad: number,
    parentAnchor: { x: number; y: number }, parentFromId: string,
  ) => {
    const mid = (startRad + endRad) / 2;
    const r = ringInnerMm[gen];
    const ids = n.kind === 'person' ? [n.personId] : n.union.partners;
    // partners tangentially adjacent around the wedge mid (D10); partners[0] left (higher θ)
    const thetas: number[] = [];
    let arc = tangential(n) / 2;
    for (const id of ids) {
      const h = caps.get(id)!.hMm;
      const theta = mid + (arc - h / 2) / r;
      thetas.push(theta);
      placements.push({
        personId: id, generation: gen, thetaRad: theta, rInnerMm: r,
        flipped: flipRotation(theta).flipped,
      });
      arc -= h + COUPLE_ARC_GAP_MM;
    }
    // parent → this node: radial-in/radial-out cubic (D11), target = first partner's inner-mid
    const target = polarPoint(0, 0, r, thetas[0]);
    const rP = Math.hypot(parentAnchor.x, parentAnchor.y);
    const thetaP = rP > 0 ? Math.atan2(-parentAnchor.y, parentAnchor.x) : thetas[0];
    const dTheta = thetas[0] - thetaP;
    let c1: { x: number; y: number };
    let c2: { x: number; y: number };
    if (rP <= 0 || Math.abs(dTheta) < 1e-6) {
      // No real angular sweep (root edges spring from the hub at rP=0; a lone
      // child inheriting its parent's full wedge keeps the same mid) — a
      // plain radial-blend cubic is both correct and trivially safe.
      c1 = polarPoint(0, 0, rP + (r - rP) / 3, thetaP);
      c2 = polarPoint(0, 0, r - (r - rP) / 3, thetas[0]);
    } else {
      // F1 fix: putting c1/c2 on their own rays with a LINEARLY blended
      // radius draws a chord across the wedge that dips inside rP whenever Δθ
      // is non-trivial — re-entering the parent's own capsule (the critical
      // finding). Model the transition as a logarithmic spiral
      // r(θ) = rP·e^{k(θ−θP)} — the IDEAL spiral's radius is strictly
      // monotonic in θ, never dipping below rP or overshooting r — and
      // convert it to a cubic via Hermite matching (endpoint positions + the
      // spiral's own tangent at each end). The cubic is only an
      // APPROXIMATION of that spiral, not the spiral itself: it DOES dip
      // below rP away from θP (measured −20 to −65mm at extreme fanout/depth)
      // — but by the time it does, the curve has swept well clear of the
      // parent's own angular position, so there's no capsule there to
      // re-enter. This tracks the spiral closely enough for the sub-90°
      // sweeps this tree can ever produce (a child's own sub-wedge mid is at
      // most half of its parent's wedge, and a wedge is at most π wide — see
      // rootChildren below) — unlike the old same-ray chord, whose dip
      // (rP·(1−cos(Δθ/2))) happens RIGHT AT θP, squarely inside the parent's
      // own capsule, and grows to tens of mm for a wide sweep.
      const k = Math.log(r / rP) / dTheta;
      const tangentAt = (theta: number, radius: number) => ({
        x: radius * (k * Math.cos(theta) - Math.sin(theta)),
        y: -radius * (k * Math.sin(theta) + Math.cos(theta)),
      });
      const tP = tangentAt(thetaP, rP);
      const tT = tangentAt(thetas[0], r);
      c1 = { x: parentAnchor.x + (dTheta / 3) * tP.x, y: parentAnchor.y + (dTheta / 3) * tP.y };
      c2 = { x: target.x - (dTheta / 3) * tT.x, y: target.y - (dTheta / 3) * tT.y };
    }
    edges.push({ fromId: parentFromId, toId: ids[0], pts: [parentAnchor, c1, c2, target] });

    if (n.kind !== 'union' || n.children.length === 0) return;
    const items: SectorItem[] = feasibleFloors(startRad - endRad, n.children.map((c) => ({
      weight: personCount(c),
      floorRad: need(c, gen + 1, delta),
    })));
    const spans = waterfill(startRad - endRad, items);
    // F1 fix: give the anchor real clearance over the widest partner instead
    // of sitting exactly on its outer edge (zero clearance was the other half
    // of the parent-capsule intrusion — even a purely radial curve starting
    // ON the capsule boundary offers no margin against float noise).
    const rOuter = r + Math.max(...ids.map((id) => caps.get(id)!.wMm)) + NODE_ARC_GAP_MM / 2;
    const anchor = polarPoint(0, 0, rOuter, mid);
    let cursor = startRad;
    for (const [i, child] of n.children.entries()) {
      place(child, gen + 1, cursor, cursor - spans[i], anchor, n.union.id);
      cursor -= spans[i];
    }
  };

  if (root.kind === 'union' && rootChildren.length > 0) {
    const items: SectorItem[] = feasibleFloors(PI, rootChildren.map((c) => ({
      weight: personCount(c),
      floorRad: Math.max(need(c, 1, delta), effWedge),
    })));
    const spans = waterfill(PI, items);
    let cursor = PI;
    for (const [i, child] of rootChildren.entries()) {
      const key = child.kind === 'person' ? child.personId : child.union.partners[0];
      rootSectors.push({ key, startRad: cursor, endRad: cursor - spans[i] });
      // root edges spring from the couple block's top-center (the hub) — rP = 0
      place(child, 1, cursor, cursor - spans[i], { x: 0, y: 0 }, root.union.id);
      cursor -= spans[i];
    }
  }

  return { placements, rootSectors, ringInnerMm, rootNodes, edges, capsById: caps };
}

/** The 4 corners of a node's capsule after translate(x y) rotate(rotateDeg) —
 *  used for scene bounds and by overlap tests (rotated rects need SAT, not AABB). */
export function nodeCorners(n: PrintNode): { x: number; y: number }[] {
  const rot = ((n.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return ([[0, 0], [n.wMm, 0], [n.wMm, n.hMm], [0, n.hMm]] as const).map(([px, py]) => ({
    x: n.xMm + px * cos - py * sin,
    y: n.yMm + px * sin + py * cos,
  }));
}

/** Ancestral Fan (spec Concept A): 180° semicircle, founding couple at
 *  bottom-center, generations as concentric rings, descendant-proportional
 *  sectors with a minimum-angle floor, radial auto-flipping labels. Same
 *  contract as flowLayout: pure, deterministic, mm units, floor-first sizing
 *  (fit is checked downstream by checkFit), printUnplacedIds-compatible. */
export function fanLayout(model: FamilyModel, measure: PrintMeasurer): PrintScene {
  const geo = fanGeometry(model, measure);
  const nodes: PrintNode[] = [];

  for (const rn of geo.rootNodes) {
    nodes.push({ personId: rn.personId, xMm: rn.xMm, yMm: rn.yMm, generation: 0, ...geo.capsById.get(rn.personId)! });
  }
  for (const p of geo.placements) {
    const cap = geo.capsById.get(p.personId)!;
    const { rotateDeg } = flipRotation(p.thetaRad);
    // flipped capsules anchor at their OUTER edge so text still runs from the
    // anchor toward the hub (D3); either way the capsule spans [rInner, rInner+w]
    const anchorR = p.flipped ? p.rInnerMm + cap.wMm : p.rInnerMm;
    const a = polarPoint(0, 0, anchorR, p.thetaRad);
    const rot = (rotateDeg * Math.PI) / 180;
    nodes.push({
      personId: p.personId,
      // put the LOCAL rect's left-middle (0, h/2) exactly on the ring anchor (D4)
      xMm: a.x + (cap.hMm / 2) * Math.sin(rot),
      yMm: a.y - (cap.hMm / 2) * Math.cos(rot),
      generation: p.generation,
      rotateDeg,
      ...cap,
    });
  }

  // shift so the rotated-corner bounding box starts at the canvas margin
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) for (const c of nodeCorners(n)) {
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
  }
  const dx = CANVAS_MARGIN_MM - minX;
  const dy = CANVAS_MARGIN_MM - minY;
  for (const n of nodes) { n.xMm += dx; n.yMm += dy; }
  const edges: PrintEdge[] = geo.edges.map((e) => {
    const [p0, c1, c2, t] = e.pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
    return { fromId: e.fromId, toId: e.toId, d: `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${t.x} ${t.y}` };
  });
  return { nodes, edges, wMm: maxX - minX + 2 * CANVAS_MARGIN_MM, hMm: maxY - minY + 2 * CANVAS_MARGIN_MM };
}
