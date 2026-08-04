// Pure polar-math primitives for the Ancestral Fan arrangement. No DOM, no
// randomness — deterministic helpers unit-tested in isolation, composed by
// fan-layout.ts.

/** Point on a circle. SVG y grows downward and the fan opens upward, so polar
 *  angle θ (radians: 0 = right, π/2 = straight up, π = left) maps to −sin. */
export function polarPoint(cx: number, cy: number, r: number, thetaRad: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(thetaRad), y: cy - r * Math.sin(thetaRad) };
}

/** Auto-flip rule (spec Concept A: labels orient along the radius and
 *  auto-flip past vertical so nothing reads upside-down):
 *  - right half (θ ≤ 90°): text reads outward, rotation −θ ∈ [−90°, 0°]
 *  - left half (θ > 90°): flipped — text reads inward, rotation 180°−θ ∈ (0°, 90°)
 *  Either way |rotation| ≤ 90°. */
export function flipRotation(thetaRad: number): { rotateDeg: number; flipped: boolean } {
  const deg = (thetaRad * 180) / Math.PI;
  return deg > 90 ? { rotateDeg: 180 - deg, flipped: true } : { rotateDeg: -deg, flipped: false };
}

export interface SectorItem {
  /** Proportional-share driver (subtree person count). */
  weight: number;
  /** Minimum span this item must receive (its content need; root branches add the wedge floor). */
  floorRad: number;
}

/** Proportional allocation with per-item floors ("waterfilling"): items whose
 *  proportional share falls below their floor are pinned AT the floor and the
 *  remaining span is re-shared proportionally among the rest, repeating until
 *  stable (≤ items.length passes). Precondition — guaranteed by solveInflation
 *  at the call site: Σ floors ≤ span. Returns spans in item order, summing to
 *  span exactly. */
export function waterfill(spanRad: number, items: SectorItem[]): number[] {
  const spans = new Array<number>(items.length).fill(0);
  const pinned = new Array<boolean>(items.length).fill(false);
  for (;;) {
    const freeSpan = spanRad - items.reduce((s, it, i) => s + (pinned[i] ? it.floorRad : 0), 0);
    const freeWeight = items.reduce((s, it, i) => s + (pinned[i] ? 0 : it.weight), 0);
    const freeCount = pinned.filter((p) => !p).length;
    let changed = false;
    for (const [i, it] of items.entries()) {
      if (pinned[i]) { spans[i] = it.floorRad; continue; }
      spans[i] = freeWeight > 0 ? (freeSpan * it.weight) / freeWeight : freeSpan / freeCount;
      if (spans[i] < it.floorRad) { pinned[i] = true; changed = true; }
    }
    if (!changed) return spans;
  }
}

/** Smallest ring inflation Δ (mm, added to every ring radius) at which the
 *  whole tree's angular need fits the 180° fan. `needRad(delta)` must be
 *  monotonically non-increasing in delta (more radius ⇒ the same arc lengths
 *  subtend less angle). Fixed 48-iteration bisection — deterministic. */
export function solveInflation(needRad: (delta: number) => number, spanRad: number, maxDelta = 5000): number {
  if (needRad(0) <= spanRad) return 0;
  let lo = 0;
  let hi = maxDelta;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (needRad(mid) <= spanRad) hi = mid;
    else lo = mid;
  }
  return hi;
}
