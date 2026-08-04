// tests/e2e/helpers/svg-mm.ts
// mm-geometry assertion helpers for print-export SVG markup. `parseDims` is pure
// string/regex work in Node; the rest need real SVG layout (getBBox/getCTM/
// getPointAtLength), so each loads the exported markup into a throwaway page via
// `page.setContent` and evaluates once.
import type { Page } from '@playwright/test';

export interface SvgDims {
  wMm: number;
  hMm: number;
  viewBox: number[];
  /** Physical mm per SVG user unit — buildExportSvg is meant to be isotropic (1:1),
   *  but callers multiply by this rather than assume it so a regression here surfaces
   *  as a wrong measurement instead of a silent unit mismatch. */
  mmPerUnit: number;
}

/** Parses width/height/viewBox off the serialized export markup (no DOM needed).
 *  Throws with the offending attribute values when width/height aren't in "mm" or
 *  when the viewBox aspect ratio doesn't match the physical (width/height) aspect —
 *  either would mean the export isn't the mm-true, non-distorted sheet the spec requires. */
export function parseDims(svg: string): SvgDims {
  const wMatch = /\bwidth="([\d.]+)mm"/.exec(svg);
  const hMatch = /\bheight="([\d.]+)mm"/.exec(svg);
  const vbMatch = /\bviewBox="([^"]*)"/.exec(svg);
  if (!wMatch) throw new Error(`parseDims: no width="<n>mm" attribute found on the export <svg>: ${svg.slice(0, 300)}`);
  if (!hMatch) throw new Error(`parseDims: no height="<n>mm" attribute found on the export <svg>: ${svg.slice(0, 300)}`);
  if (!vbMatch) throw new Error(`parseDims: no viewBox attribute found on the export <svg>: ${svg.slice(0, 300)}`);

  const wMm = Number(wMatch[1]);
  const hMm = Number(hMatch[1]);
  const viewBox = vbMatch[1].trim().split(/\s+/).map(Number);
  const [, , vbW, vbH] = viewBox;
  if (!(vbW > 0) || !(vbH > 0)) {
    throw new Error(`parseDims: degenerate viewBox "${vbMatch[1]}"`);
  }

  const physicalAspect = wMm / hMm;
  const viewBoxAspect = vbW / vbH;
  const relErr = Math.abs(physicalAspect - viewBoxAspect) / viewBoxAspect;
  if (relErr > 1e-3) {
    throw new Error(
      `parseDims: viewBox aspect ${viewBoxAspect.toFixed(4)} (viewBox="${vbMatch[1]}") does not match ` +
        `physical aspect ${physicalAspect.toFixed(4)} (${wMm}mm x ${hMm}mm) — export is distorted`,
    );
  }

  return { wMm, hMm, viewBox, mmPerUnit: wMm / vbW };
}

const SETUP = (svg: string) => `<!doctype html><html><body>${svg}</body></html>`;

/** Union of getBBox() (in the root <svg>'s own coordinate system, i.e. mm units)
 *  over every element that is NOT a descendant of a [data-print-role] element —
 *  buildExportSvg tags its background/calibration-bar/trim-mark scaffolding with
 *  data-print-role, so this isolates the actual tree content. */
export async function contentBBox(page: Page, svg: string): Promise<{ x: number; y: number; width: number; height: number }> {
  await page.setContent(SETUP(svg));
  return page.evaluate(() => {
    const root = document.querySelector('svg');
    if (!root) throw new Error('contentBBox: no <svg> in the provided markup');
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (el.closest('[data-print-role]')) continue;
      if (!('getBBox' in el)) continue;
      const g = el as SVGGraphicsElement;
      let bbox: DOMRect;
      try {
        bbox = g.getBBox();
      } catch {
        continue;
      }
      if (bbox.width === 0 && bbox.height === 0) continue;
      const ctm = g.getCTM();
      if (!ctm) continue;
      const corners = [
        [bbox.x, bbox.y],
        [bbox.x + bbox.width, bbox.y],
        [bbox.x, bbox.y + bbox.height],
        [bbox.x + bbox.width, bbox.y + bbox.height],
      ];
      for (const [x, y] of corners) {
        const pt = root.createSVGPoint();
        pt.x = x;
        pt.y = y;
        const p = pt.matrixTransform(ctm);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });
}

/** Reads the declared `font-size` (SVG user units, i.e. mm pre-mmPerUnit) off every
 *  element matching `selector`, paired with the owning person's id (nearest
 *  [data-person-id] ancestor — PrintTreeCanvas puts it on the person-node <g>).
 *  Reads the attribute directly rather than getComputedStyle: font-size is set as a
 *  literal numeric presentation attribute by PrintTreeCanvas, and CSSOM's treatment of
 *  unitless SVG lengths inside a scaled viewBox is not something to depend on here. */
export async function fontSizesMm(page: Page, svg: string, selector: string): Promise<{ id: string; mm: number }[]> {
  await page.setContent(SETUP(svg));
  return page.evaluate((sel) => {
    return Array.from(document.querySelectorAll(sel)).map((el) => {
      const owner = el.closest('[data-person-id]') as HTMLElement | SVGElement | null;
      const id = owner?.getAttribute('data-person-id') ?? '(unknown)';
      const raw = el.getAttribute('font-size');
      const mm = raw !== null ? Number(raw) : Number.parseFloat(getComputedStyle(el).fontSize);
      return { id, mm };
    });
  }, selector);
}

export interface Collision {
  from: string;
  to: string;
  hit: string;
  x: number;
  y: number;
}

/** For every `path.connector`, samples points along its length (every ~0.5mm-equivalent
 *  of arc length, capped at 512 samples) and tests each against every rendered `<text>`'s
 *  bounding box — inflated by half the connector's stroke width plus a 1mm clearance —
 *  in the shared root coordinate space. A connector never counts a hit against its own
 *  endpoints' text (data-from/data-to on the path vs. the nearest [data-person-id]
 *  ancestor of each text run), since a connector legitimately touches the capsules it links. */
export async function collide(page: Page, svg: string): Promise<Collision[]> {
  await page.setContent(SETUP(svg));
  return page.evaluate(() => {
    const root = document.querySelector('svg');
    if (!root) throw new Error('collide: no <svg> in the provided markup');
    const toRoot = (el: SVGGraphicsElement, x: number, y: number): { x: number; y: number } => {
      const ctm = el.getCTM();
      if (!ctm) return { x, y };
      const pt = root.createSVGPoint();
      pt.x = x;
      pt.y = y;
      const p = pt.matrixTransform(ctm);
      return { x: p.x, y: p.y };
    };

    interface Rect { id: string; x1: number; y1: number; x2: number; y2: number }
    const rects: Rect[] = [];
    for (const text of Array.from(root.querySelectorAll('text'))) {
      const owner = text.closest('[data-person-id]') as HTMLElement | SVGElement | null;
      const id = owner?.getAttribute('data-person-id');
      if (!id) continue;
      const g = text as unknown as SVGGraphicsElement;
      let bbox: DOMRect;
      try {
        bbox = g.getBBox();
      } catch {
        continue;
      }
      if (bbox.width === 0 && bbox.height === 0) continue;
      const a = toRoot(g, bbox.x, bbox.y);
      const b = toRoot(g, bbox.x + bbox.width, bbox.y + bbox.height);
      rects.push({ id, x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });
    }

    const hits: Array<{ from: string; to: string; hit: string; x: number; y: number }> = [];
    for (const path of Array.from(root.querySelectorAll('path.connector'))) {
      const p = path as SVGPathElement;
      const from = p.dataset.from ?? '';
      const to = p.dataset.to ?? '';
      const strokeWidthRaw = p.getAttribute('stroke-width') ?? getComputedStyle(p).strokeWidth;
      const strokeWidth = Number.parseFloat(strokeWidthRaw) || 0.35;
      const inflate = strokeWidth / 2 + 1; // mm clearance
      const total = p.getTotalLength();
      const samples = Math.min(512, Math.max(2, Math.ceil(total / 0.5)));
      for (let i = 0; i <= samples; i++) {
        const pt = p.getPointAtLength((i / samples) * total);
        const abs = toRoot(p, pt.x, pt.y);
        for (const r of rects) {
          if (r.id === from || r.id === to) continue;
          if (abs.x >= r.x1 - inflate && abs.x <= r.x2 + inflate && abs.y >= r.y1 - inflate && abs.y <= r.y2 + inflate) {
            hits.push({ from, to, hit: r.id, x: abs.x, y: abs.y });
          }
        }
      }
    }
    return hits;
  });
}
