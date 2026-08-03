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
const TARGET = 200;

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateWorstCase(): string {
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
  // Every call site checks affordability against TARGET before calling
  // row(), so `count` always equals the true number of PersonRow objects
  // the parser will produce from `lines` — the guard test's byte/row-count
  // equality depends on this invariant holding exactly.
  const row = (depth: number, cell: string, people: number) => {
    lines.push(',' + ','.repeat(depth) + `"${cell}"` + ','.repeat(4 - depth));
    count += people;
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

  // Top up to exactly TARGET under the last gen-4 (or deeper) couple still
  // on the stack — each addition is a single person, so this can never
  // overshoot.
  while (count < TARGET) row(4, person(), 1);

  return lines.join('\n') + '\n';
}
