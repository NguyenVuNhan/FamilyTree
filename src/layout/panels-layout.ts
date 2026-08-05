// Botanical Atlas composition: run the flow engine verbatim on each partition
// plan's sub-model and place the resulting scenes side-by-side. One engine,
// one rendering path — panels is a composition layer, not an engine (spec
// Concept D). Pure and deterministic.
import type { FamilyModel } from '../data/types';
import { TITLE_BLOCK_MM } from '../print/fit';
import { flowLayout, type PrintMeasurer, type PrintScene } from './flow-layout';
import { partitionPanels } from './panels-partition';

export const PANEL_GAP_MM = 24;

export interface PrintPanel {
  label: string | null;
  parentLabel: string | null;
  headId: string | null;
  /** Branch head's display name (cleanName ?? fullName) — titles and refusal copy. */
  headName: string | null;
  cutLabels: string[];
  scene: PrintScene;
  /** Canvas composition offset (screen only — export strips it). */
  xMm: number;
  /** Full panel box including its title strip. */
  wMm: number;
  hMm: number;
  /** Carried from PanelPlan.overCap: narrowing bottomed out at F0–F1 (W=1) and this
   *  panel's rendered occupancy still exceeds PANEL_SOFT_CAP (see panels-partition.ts).
   *  Lets a downstream consumer (checkPanelsFit) turn it into an honest refusal
   *  instead of silently emitting an unbounded panel. */
  overCap: boolean;
}

export interface PrintPanels {
  kind: 'panels';
  panels: PrintPanel[];
  wMm: number;
  hMm: number;
  /** True when ANY panel is overCap — the composition-level signal checkPanelsFit acts on. */
  overCap: boolean;
}

export function panelsLayout(model: FamilyModel, measure: PrintMeasurer): PrintPanels {
  const plans = partitionPanels(model);
  let x = 0;
  const panels = plans.map((p) => {
    const scene = flowLayout(p.model, measure);
    const head = p.headId !== null ? model.persons.get(p.headId) : undefined;
    const panel: PrintPanel = {
      label: p.label,
      parentLabel: p.parentLabel,
      headId: p.headId,
      headName: head ? head.cleanName ?? head.fullName : null,
      cutLabels: p.cutLabels,
      scene,
      xMm: x,
      wMm: scene.wMm,
      hMm: scene.hMm + TITLE_BLOCK_MM,
      overCap: p.overCap,
    };
    x += panel.wMm + PANEL_GAP_MM;
    return panel;
  });
  return {
    kind: 'panels',
    panels,
    wMm: x - PANEL_GAP_MM,
    hMm: Math.max(...panels.map((p) => p.hMm)),
    overCap: panels.some((p) => p.overCap),
  };
}

/** Global no-silent-drop across the whole composition (spec §Error handling 1):
 *  a person is placed iff SOME panel renders them; `m:*` marker chips don't count.
 *  Computed against the ORIGINAL model's person set (never a panel sub-model's) —
 *  panel sub-models drop excludedIds/excludedNames and share partners arrays by
 *  reference with the source model, so they must never be treated as the source
 *  of truth for who exists. */
export function panelsUnplacedIds(model: FamilyModel, comp: PrintPanels): string[] {
  const placed = new Set<string>();
  for (const p of comp.panels) {
    for (const n of p.scene.nodes) if (!n.personId.startsWith('m:')) placed.add(n.personId);
  }
  return [...model.persons.keys()].filter((id) => !placed.has(id) && !model.excludedIds.includes(id));
}
