// Pure partitioner for the Botanical Atlas (panels) arrangement — a composition
// layer, not an engine (spec Concept D). It slices the family into panel plans:
// truncated sub-models the flow engine lays out verbatim. Cut unions get a
// synthetic `m:<label>` marker child, so the connector that would cross panels
// is REPLACED by a layout-reserved continuation chip. Deterministic: pure tree
// walk, BFS label order, no randomness.
import type { FamilyModel, Person, Union } from '../data/types';
import { buildPrintTree, type TreeNode } from './flow-layout';

/** A frontier subtree smaller than this renders in full inside its parent panel
 *  (the tiny-branch fallback) instead of earning a lonely panel. */
export const MAJOR_BRANCH_MIN = 12;
/** A panel whose F0–F2 window would render more people than this narrows to a
 *  hub (F0–F1) — near the flow engine's measured ~35-person panorama capacity.
 *  Set to 32 (not the spec sketch's 30) so the D14 capacity walk's whole-branch
 *  panels of ~31 people (all-tiny frontier subtrees, D1 fallback) stay single
 *  panels instead of narrowing to a hub one person short of the boundary —
 *  the walk's panel counts are the load-bearing invariant, the cap is a tuning
 *  knob (D14: "Tuning knobs … MAJOR_BRANCH_MIN, PANEL_SOFT_CAP"). */
export const PANEL_SOFT_CAP = 32;
/** Default panel window: root + 2 local generations (the spec's F0–F2 master). */
export const PANEL_WINDOW_GENS = 2;

export function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let v = n;
  for (const [k, s] of table) while (v >= k) { out += s; v -= k; }
  return out;
}

export interface PanelPlan {
  /** null = the master panel; child panels get ASCII Roman numerals in BFS creation order. */
  label: string | null;
  /** Label of the panel carrying this panel's out-chip; null when that panel is the master. */
  parentLabel: string | null;
  /** What the panel's layout roots at: a union id, or 'p:<id>' for a lone-person master. */
  rootId: string;
  /** partners[0] of the root union — the display-name person for titles/refusals; null for the master. */
  headId: string | null;
  /** Truncated sub-model (includes synthetic `m:<label>` marker persons at cut unions). */
  model: FamilyModel;
  /** Labels of the out-chips inside this panel, in cut (left→right) order. */
  cutLabels: string[];
}

export function partitionPanels(model: FamilyModel): PanelPlan[] {
  const root = buildPrintTree(model);
  const countOf = new Map<TreeNode, number>();
  const count = (n: TreeNode): number => {
    const cached = countOf.get(n);
    if (cached !== undefined) return cached;
    const v = n.kind === 'person' ? 1 : n.union.partners.length + n.children.reduce((s, c) => s + count(c), 0);
    countOf.set(n, v);
    return v;
  };

  let nextLabel = 1;
  const plans: PanelPlan[] = [];
  const queue: { node: TreeNode; label: string | null; parentLabel: string | null }[] = [
    { node: root, label: null, parentLabel: null },
  ];

  while (queue.length > 0) {
    const { node, label, parentLabel } = queue.shift()!;

    if (node.kind === 'person') {
      // lone-root master: one panel, no cuts
      const persons = new Map<string, Person>([[node.personId, model.persons.get(node.personId)!]]);
      plans.push({
        label, parentLabel, rootId: `p:${node.personId}`, headId: null, cutLabels: [],
        model: { persons, unions: [], rootId: `p:${node.personId}`, excludedIds: [], excludedNames: [] },
      });
      continue;
    }

    // People the panel would render with the frontier at local generation W
    // (cut branches contribute their couple; tiny frontier subtrees their whole count).
    const renderedCount = (n: TreeNode, gen: number, W: number): number => {
      if (n.kind === 'person') return 1;
      const own = n.union.partners.length;
      if (n.children.length === 0) return own;
      if (gen === W) return count(n) >= MAJOR_BRANCH_MIN ? own : count(n);
      return own + n.children.reduce((s, c) => s + renderedCount(c, gen + 1, W), 0);
    };
    // D2 — soft-cap hub narrowing: F0–F2 by default, F0–F1 when the window is too crowded.
    const W = renderedCount(node, 0, PANEL_WINDOW_GENS) <= PANEL_SOFT_CAP ? PANEL_WINDOW_GENS : 1;

    const persons = new Map<string, Person>();
    const unions: Union[] = [];
    const cutLabels: string[] = [];

    const include = (n: TreeNode, gen: number, full: boolean): void => {
      if (n.kind === 'person') {
        persons.set(n.personId, model.persons.get(n.personId)!);
        return;
      }
      for (const id of n.union.partners) persons.set(id, model.persons.get(id)!);
      if (n.children.length === 0) {
        unions.push({ id: n.union.id, partners: n.union.partners, childIds: [] });
        return;
      }
      if (!full && gen === W && count(n) >= MAJOR_BRANCH_MIN) {
        // CUT: the children continue on their own panel; the cross-panel
        // connector is replaced by a paired continuation marker (D3).
        const chip = toRoman(nextLabel++);
        cutLabels.push(chip);
        const mid = `m:${chip}`;
        persons.set(mid, { id: mid, fullName: chip, cleanName: chip });
        unions.push({ id: n.union.id, partners: n.union.partners, childIds: [mid] });
        queue.push({ node: n, label: chip, parentLabel: label });
        return;
      }
      // Tiny frontier subtree ⇒ everything below renders in this panel (D1 fallback).
      const deepNow = full || gen === W;
      unions.push({
        id: n.union.id,
        partners: n.union.partners,
        childIds: n.children.map((c) => (c.kind === 'person' ? c.personId : c.linkId!)),
      });
      for (const c of n.children) include(c, gen + 1, deepNow);
    };
    include(node, 0, false);

    plans.push({
      label,
      parentLabel,
      rootId: node.union.id,
      headId: label === null ? null : node.union.partners[0],
      cutLabels,
      model: { persons, unions, rootId: node.union.id, excludedIds: [], excludedNames: [] },
    });
  }
  return plans;
}
