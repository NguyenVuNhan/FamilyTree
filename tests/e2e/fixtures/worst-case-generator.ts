// Deterministic (mulberry32, seed 20260803) staircase CSV generator: exactly
// 200 people across 5 generation columns (Gen 1..Gen 5), with a dense gen-2
// branch carrying the bulk of the descendants, sprinkled year shapes,
// partnerless rows, a 1-person leaf branch, spacing rows, and long
// fully-diacritic names at gens 4-5 inside the dense branch.
//
// Restructured vs. the original brief sketch (see task-16-report.md for the
// full iteration log):
//   1. The brief's reference code evaluated `rnd() < 0.7` twice per gen-4 row
//      — once to build the cell text, once to compute the `people` count
//      passed to `row()` — which could desync the running `count` from the
//      actual number of PersonRow objects the parser would produce. Fixed by
//      computing `hasPartner` once and reusing it for both.
//   2. The brief's loops only bounded the innermost gen-4/gen-5 iterations
//      (`count < 190` / `count < 198`) while the outer per-branch and
//      per-k-index "couple" rows were emitted unconditionally — so once the
//      dense branch's inner loops saturated those thresholds, the remaining
//      outer iterations could keep adding rows past 200 with nothing to stop
//      them, and could also overshoot mid-loop when a 2-person "couple" row
//      was the only thing that fit in a 1-person slot. Fixed by checking
//      `count + cost <= TARGET` immediately before every single row
//      emission in the dense branch (breaking the loop, not skipping-and
//      continuing, so the depth chain on the parser's stack is never left
//      dangling) and by keeping every other branch's size fully fixed and
//      small enough that it can never approach the budget on its own.
//   3. The brief's top-up loop ran after ALL branches, including a
//      1-person leaf branch processed last — which would have left the
//      parser stack at a shallow gen-2 row, so a gen-5 top-up row would be
//      rejected as a depth jump. Fixed by processing the dense branch LAST,
//      so the row immediately above the top-up loop is always a gen-4 (or
//      deeper) row still on the stack.
const GIVEN = ['Thị Phương Thảo', 'Văn Đức', 'Thị Kim Cúc', 'Hoàng Bảo Ngọc', 'Thị Quỳnh Anh', 'Văn Trường', 'Thị Hồng Gấm', 'Ngọc Trâm Anh', 'Văn Hiệp', 'Thị Bích Ngọc'];
const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Võ', 'Ngô'];

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `target` defaults to 200 (the deliberately unfittable stress fixture — see
 *  stair-worst-200.csv's own header comment for why that one is never meant to
 *  export). Passing a smaller `target` (same seed, same skew/degenerate-shape
 *  mix, just less of the dense branch) produces a fixture that CAN actually be
 *  exported — see generateDense()/stair-dense-*.csv. */
export function generateWorstCase(target = 200): string {
  const TARGET = target;
  const rnd = mulberry32(20260803);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  let year = 1900;
  const person = (long = false): string => {
    const name = long
      ? `${pick(FAMILY)} ${pick(GIVEN)} ${pick(GIVEN)}`
      : `${pick(FAMILY)} ${pick(GIVEN)}`;
    const r = rnd();
    year = Math.min(1995, year + Math.floor(rnd() * 3));
    if (r < 0.4) return `${name} (${year}–${year + 60})`;
    if (r < 0.6) return `${name} (${year})`;
    if (r < 0.7) return `${name} (–${year + 60})`;
    return name;
  };

  const lines: string[] = ['Image,Gen 1,Gen 2,Gen 3,Gen 4,Gen 5'];
  let count = 0;
  // Tracks the depth of the most recently emitted row, so the top-up loop
  // below can attach at a depth the parser's stack actually supports instead
  // of a hardcoded 4 — at TARGET=200 the dense loop always reaches gen-5
  // (depth 4) before its budget runs out, but at a much smaller TARGET the
  // dense loop can exhaust the budget after only a gen-3 (or gen-4) row,
  // and an unconditional depth-4 top-up would then be a depth jump the
  // parser rejects (surfaced while tuning stair-dense-*.csv).
  let lastDepth = 0;
  // Every call site checks affordability against TARGET before calling
  // row(), so `count` always equals the true number of PersonRow objects
  // the parser will produce from `lines` — the guard test's byte/row-count
  // equality depends on this invariant holding exactly.
  const row = (depth: number, cell: string, people: number) => {
    lines.push(',' + ','.repeat(depth) + `"${cell}"` + ','.repeat(4 - depth));
    count += people;
    lastDepth = depth;
  };

  // Exactly one gen-1 root couple (a second root would fragment the tree
  // into multiple components, which buildModel would then exclude).
  row(0, `${person()} + ${person()}`, 2);

  // Two small, fully fixed-size branches (~31 people each — never close
  // enough to TARGET to risk overshoot) plus a 1-person leaf branch, then
  // the dense branch last (see restructuring note above).
  const smallBranch = () => {
    row(1, `${person()} + ${person()}`, 2); // gen-2 head couple
    const kids = 3;
    for (let k = 0; k < kids; k++) {
      const hasPartner = k !== 0; // k===0 is the partnerless trailing-separator row
      row(2, hasPartner ? `${person()} + ${person()}` : `${person()} –`, hasPartner ? 2 : 1);
      for (let i = 0; i < 2; i++) {
        row(3, `${person()} + ${person()}`, 2); // gen-4 couple
        for (let j = 0; j < 2; j++) row(4, person(), 1); // gen-5 leaves
      }
    }
  };
  smallBranch(); // branch A: contributes one of the two required partnerless rows
  lines.push(',,,,,'); // spacing row after branch A
  smallBranch(); // branch B: contributes the second partnerless row

  row(1, person(), 1); // branch C: 1-person leaf branch — no partner, no kids
  lines.push(',,,,,'); // second spacing row, after the leaf branch

  // Dense branch: absorbs the rest of the 200-person budget. Every level
  // (gen-3 couple, gen-4 row, gen-5 row) checks affordability immediately
  // before emitting and BREAKS (never skip-and-continue) the moment a row
  // wouldn't fit, so the parser's depth stack is never left in a state that
  // can't support the next emission, and the running count can never
  // exceed TARGET.
  row(1, `${person()} + ${person()}`, 2); // gen-2 dense head (budget is always ample here)
  const denseKids = 5;
  for (let k = 0; k < denseKids; k++) {
    if (count + 2 > TARGET) break;
    row(2, `${person()} + ${person()}`, 2); // gen-3 couple (always paired in the dense branch)
    for (let i = 0; i < 8; i++) {
      const hasPartner = rnd() < 0.7;
      const cost = hasPartner ? 2 : 1;
      if (count + cost > TARGET) break;
      row(3, hasPartner ? `${person(true)} + ${person()}` : `${person(true)} –`, cost);
      for (let j = 0; j < 3; j++) {
        if (count + 1 > TARGET) break;
        row(4, person(j === 0), 1); // long fully-diacritic name for the first gen-5 child
      }
    }
  }

  // Top up to exactly TARGET as siblings under whatever the dense loop last
  // established (one level deeper than `lastDepth`, capped at gen-5) — each
  // addition is a single person, so this can never overshoot the target,
  // and reusing the same depth for every top-up row keeps them all siblings
  // under that same parent (see `lastDepth` comment above).
  const topUpDepth = Math.min(4, lastDepth + 1);
  while (count < TARGET) row(topUpDepth, person(), 1);

  return lines.join('\n') + '\n';
}

/** A *structurally different* shape from generateWorstCase, not just a smaller
 *  `target` on the same one — empirically, generateWorstCase's fixed skeleton
 *  (its two ~31-person smallBranch()es alone) already renders at ~725mm tall,
 *  well past what even panorama (1200×600mm) at a 60mm margin can hold
 *  (~480mm of content height), regardless of how small `target` is. Every
 *  union in that skeleton has ≤3 direct children, so flow-layout's leaf-run
 *  wrap (only kicks in for a union with >6 direct, non-nested leaf children)
 *  never engages anywhere in it.
 *
 *  generateDense() is built the opposite way on purpose: a short spine down
 *  to one single-partner "union" that fans out into `target` DIRECT leaf
 *  children — the one shape leaf-run actually compacts (into 2 mini-columns,
 *  ceil(n/2) rows instead of n). Even so, at the floor-adjacent font sizes
 *  flow-layout uses this deep, the 2× compaction still caps out well under
 *  100 people for panorama+60mm — see stair-dense-*.csv's header for the
 *  exact measured ceiling this file's `target` was picked against. */
export function generateDense(target: number): string {
  const rnd = mulberry32(20260803);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  let year = 1900;
  const person = (long = false): string => {
    const name = long
      ? `${pick(FAMILY)} ${pick(GIVEN)} ${pick(GIVEN)}`
      : `${pick(FAMILY)} ${pick(GIVEN)}`;
    const r = rnd();
    year = Math.min(1995, year + Math.floor(rnd() * 3));
    if (r < 0.4) return `${name} (${year}–${year + 60})`;
    if (r < 0.6) return `${name} (${year})`;
    if (r < 0.7) return `${name} (–${year + 60})`;
    return name;
  };

  const lines: string[] = ['Image,Gen 1,Gen 2,Gen 3,Gen 4,Gen 5'];
  const row = (depth: number, cell: string) => lines.push(',' + ','.repeat(depth) + `"${cell}"` + ','.repeat(4 - depth));

  row(0, `${person()} + ${person()}`); // gen-1 root couple

  // A tiny side branch preserving the "partnerless row with descendants"
  // degenerate shape (the trailing " –" separator) — cheap in height (2
  // people, no fan-out) so it doesn't compete with the dense branch's budget.
  row(1, `${person()} –`);
  row(2, person());
  lines.push(',,,,,'); // spacing row

  // The dense/skewed branch: a couple, then a single-partner spine person
  // whose `target` direct children (the leaf-run-eligible fan) carry almost
  // all of this fixture's people — the "skew" generateWorstCase's dense
  // branch also has, just shallow enough to actually fit.
  row(1, `${person()} + ${person()}`); // gen-2 dense head couple
  row(2, person()); // gen-3 spine single — parent of the fan
  for (let i = 0; i < target; i++) {
    row(3, person(i < 5)); // first 5 get a long, fully-diacritic name
  }

  return lines.join('\n') + '\n';
}
