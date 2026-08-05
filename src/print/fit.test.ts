import { describe, expect, it } from 'vitest';
import { checkFit, checkPanelsFit } from './fit';

describe('checkFit (legibility beats fit — spec §Error handling 2)', () => {
  it('fits when content + 2·margin ≤ format on both axes', () => {
    expect(checkFit(1000, 400, { wMm: 1200, hMm: 600 }, 60)).toEqual({ ok: true });
    expect(checkFit(1081, 400, { wMm: 1200, hMm: 600 }, 60).ok).toBe(false); // 1081+120 > 1200
  });
  it('refusal carries required size in mm and an actionable cm message', () => {
    const r = checkFit(1000, 900, { wMm: 900, hMm: 900 }, 50);
    expect(r).toMatchObject({ ok: false, requiredWmm: 1100, requiredHmm: 1000 });
    if (!r.ok) expect(r.message).toContain('110×100 cm');
  });
});

describe('refusal copy suggests panels only for the single-scene arrangements (PR ③)', () => {
  it('plain checkFit keeps the old copy; suggestPanels appends the panels guidance', () => {
    const plain = checkFit(1000, 900, { wMm: 900, hMm: 900 }, 50);
    if (!plain.ok) expect(plain.message).not.toContain('Panels');
    const suggested = checkFit(1000, 900, { wMm: 900, hMm: 900 }, 50, { suggestPanels: true });
    if (!suggested.ok) expect(suggested.message).toContain('or switch to the Panels arrangement');
  });
});

describe('checkPanelsFit (PR ③)', () => {
  // DEVIATION from the task-8 brief: PrintPanel/PrintPanels (src/layout/panels-layout.ts)
  // now carry a required `overCap: boolean` the brief's {label, headName, wMm, hMm} shape
  // can't see. Widened here so checkPanelsFit can honestly refuse a branch that could not
  // be subdivided further, instead of silently emitting an unbounded panel.
  const panel = (label: string | null, headName: string | null, wMm: number, hMm: number, overCap = false) =>
    ({ label, headName, wMm, hMm, overCap });
  const size = { wMm: 1200, hMm: 600 };

  it('ok when every panel fits the per-panel format', () => {
    expect(checkPanelsFit({ panels: [panel(null, null, 500, 400), panel('II', 'Trần Văn Đức', 900, 420)] },
      size, 60, 'pano')).toEqual({ ok: true });
  });

  it('names the offending sub-panel by branch-head display name, never an id', () => {
    const r = checkPanelsFit({ panels: [panel(null, null, 500, 400), panel('II', 'Trần Văn Đức', 1100, 420)] },
      size, 60, 'pano');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('Panel II (Trần Văn Đức)');
      expect(r.message).toContain('cm');
      expect(r.message).not.toMatch(/\br\d+p?\b/);
    }
  });

  it('names the master panel as such', () => {
    const r = checkPanelsFit({ panels: [panel(null, null, 1200, 400)] }, size, 60, 'pano');
    if (!r.ok) expect(r.message).toContain('The master panel needs');
  });

  it('trip demands exactly 3 panels, with actionable guidance', () => {
    const two = checkPanelsFit({ panels: [panel(null, null, 200, 300), panel('I', 'A', 200, 300)] },
      { wMm: 400, hMm: 600 }, 50, 'trip');
    expect(two.ok).toBe(false);
    if (!two.ok) {
      expect(two.message).toContain('triptych');
      expect(two.message).toContain('2');
    }
    const three = checkPanelsFit(
      { panels: [panel(null, null, 200, 300), panel('I', 'A', 200, 300), panel('II', 'B', 200, 300)] },
      { wMm: 400, hMm: 600 }, 50, 'trip');
    expect(three).toEqual({ ok: true });
  });

  it('all panels overCap=false leaves the dimensional refusal logic unchanged', () => {
    const r = checkPanelsFit({ panels: [panel(null, null, 500, 400), panel('II', 'Trần Văn Đức', 1100, 420)] },
      size, 60, 'pano');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('Panel II (Trần Văn Đức) needs at least');
  });

  it('an over-cap panel refuses honestly, naming the branch head, even when it dimensionally fits', () => {
    const r = checkPanelsFit(
      { panels: [panel(null, null, 500, 400), panel('II', 'Trần Văn Đức', 500, 400, true)] },
      size, 60, 'pano');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('Panel II (Trần Văn Đức)');
      expect(r.message).toMatch(/could not be subdivided|capacity/);
      expect(r.message).not.toMatch(/\br\d+p?\b/);
    }
  });
});
