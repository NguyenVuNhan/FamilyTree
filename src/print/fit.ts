import type { FormatId } from './formats';

export const TITLE_BLOCK_MM = 26;

export type FitResult =
  | { ok: true }
  | { ok: false; requiredWmm: number; requiredHmm: number; message: string };

const cm = (mm: number) => Math.ceil(mm / 10);

/** Text never shrinks to fit — the format must grow instead. `suggestPanels`
 *  adds the composition escape hatch to the guidance (flow/fan callers; the
 *  panels arrangement composes its own per-panel copy in checkPanelsFit). */
export function checkFit(
  contentWmm: number, contentHmm: number,
  size: { wMm: number; hMm: number }, marginMm: number,
  opts?: { suggestPanels?: boolean },
): FitResult {
  const requiredWmm = contentWmm + 2 * marginMm;
  const requiredHmm = contentHmm + 2 * marginMm;
  if (requiredWmm <= size.wMm && requiredHmm <= size.hMm) return { ok: true };
  return {
    ok: false, requiredWmm, requiredHmm,
    message: `This tree needs at least ${cm(requiredWmm)}×${cm(requiredHmm)} cm at this text size — choose a larger format or custom size${
      opts?.suggestPanels ? ', or switch to the Panels arrangement' : ''}.`,
  };
}

/** Per-panel fit for the panels arrangement: the chosen format is a page/frame
 *  PER PANEL, each with its own full safe margin; refusals name the offending
 *  panel by branch-head display name (spec §Error handling 2/6). Triptych is
 *  exactly 3 panels (D6). Structural panel type avoids a fit↔panels-layout cycle.
 *
 *  DEVIATION from the task-8 brief: the brief's panel shape was
 *  {label, headName, wMm, hMm}, which can't see PrintPanel's required `overCap`
 *  flag (src/layout/panels-layout.ts — carried from PanelPlan.overCap, set when
 *  a branch bottomed out at F0–F1 narrowing and still exceeds PANEL_SOFT_CAP).
 *  Widened here to consume it: an over-cap panel refuses honestly (the branch
 *  could not be subdivided further and exceeds this panel's capacity) instead
 *  of silently emitting an unbounded panel, in addition to the dimensional
 *  refusal below. Checked ahead of the dimensional check per panel, since an
 *  over-cap branch may still happen to satisfy the mm arithmetic. */
export function checkPanelsFit(
  comp: { panels: { label: string | null; headName: string | null; wMm: number; hMm: number; overCap: boolean }[] },
  size: { wMm: number; hMm: number }, marginMm: number, format: FormatId,
): FitResult {
  if (format === 'trip' && comp.panels.length !== 3) {
    return {
      ok: false, requiredWmm: size.wMm, requiredHmm: size.hMm,
      message: `A triptych is exactly 3 panels — this family splits into ${comp.panels.length}. Choose another format, or use Triptych with a family that has two major branches.`,
    };
  }
  for (const p of comp.panels) {
    const who = p.label ? `Panel ${p.label} (${p.headName ?? ''})` : 'The master panel';
    if (p.overCap) {
      return {
        ok: false, requiredWmm: p.wMm, requiredHmm: p.hMm,
        message: `${who} could not be subdivided further and exceeds this panel's capacity — choose a larger per-panel format, or restructure the tree (exclude branches, or split the family earlier).`,
      };
    }
    const f = checkFit(p.wMm, p.hMm, size, marginMm);
    if (!f.ok) {
      return {
        ...f,
        message: `${who} needs at least ${cm(f.requiredWmm)}×${cm(f.requiredHmm)} cm at this text size — choose a larger format or custom size.`,
      };
    }
  }
  return { ok: true };
}
