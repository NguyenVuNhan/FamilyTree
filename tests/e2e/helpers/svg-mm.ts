// tests/e2e/helpers/svg-mm.ts
// mm-geometry assertion helpers for print-export SVG markup. `parseDims` is pure
// string/regex work in Node; the rest need real SVG layout (getBBox/getPointAtLength),
// so each loads the exported markup into a throwaway page via `page.setContent` and
// evaluates once.
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
    // An element's absolute position needs to land in the root <svg>'s OWN coordinate
    // system (viewBox units, i.e. mm-equivalent per parseDims's mmPerUnit) — NOT
    // `getCTM()`/`getScreenCTM()`, which resolve into the root's established *viewport*
    // space. Because this app's exports set width/height to physical "mm" values, that
    // viewport space is actual CSS px (1 viewBox unit ≈ 3.78px at 96dpi), not viewBox
    // units — confirmed empirically (getCTM-based coordinates came back ~3.78x too large
    // on a 1200x600mm export). PrintTreeCanvas/buildExportSvg only ever nest plain
    // `translate(x y)` transforms (no scale/rotate), so summing each ancestor's
    // consolidated translate up to (not including) `root` is an exact, CTM-free fix.
    const localOffset = (root: SVGSVGElement, el: Element): { x: number; y: number } => {
      let x = 0;
      let y = 0;
      let node: Element | null = el;
      while (node && node !== root) {
        const consolidated = (node as unknown as SVGGraphicsElement).transform?.baseVal?.consolidate();
        if (consolidated) {
          x += consolidated.matrix.e;
          y += consolidated.matrix.f;
        }
        node = node.parentElement;
      }
      return { x, y };
    };

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
      const off = localOffset(root, el);
      const x1 = off.x + bbox.x;
      const y1 = off.y + bbox.y;
      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x1 + bbox.width);
      maxY = Math.max(maxY, y1 + bbox.height);
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
    // See contentBBox's identical helper for why this is translate-summing rather than
    // getCTM()-based (getCTM lands in physical-px viewport space for these mm-sized
    // exports, not the viewBox/mm-equivalent space the stroke-width/1mm inflate below is
    // expressed in).
    const localOffset = (root: SVGSVGElement, el: Element): { x: number; y: number } => {
      let x = 0;
      let y = 0;
      let node: Element | null = el;
      while (node && node !== root) {
        const consolidated = (node as unknown as SVGGraphicsElement).transform?.baseVal?.consolidate();
        if (consolidated) {
          x += consolidated.matrix.e;
          y += consolidated.matrix.f;
        }
        node = node.parentElement;
      }
      return { x, y };
    };

    const root = document.querySelector('svg');
    if (!root) throw new Error('collide: no <svg> in the provided markup');

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
      const off = localOffset(root, g);
      const x1 = off.x + bbox.x;
      const y1 = off.y + bbox.y;
      rects.push({ id, x1, y1, x2: x1 + bbox.width, y2: y1 + bbox.height });
    }

    const hits: Array<{ from: string; to: string; hit: string; x: number; y: number }> = [];
    for (const path of Array.from(root.querySelectorAll('path.connector'))) {
      const p = path as SVGPathElement;
      const from = p.dataset.from ?? '';
      const to = p.dataset.to ?? '';
      // `from` is a UNION id (flow-layout.ts: `edges.push({ fromId: n.union.id, ... })`),
      // formatted "u:<personId>" (lone parent) or "u:<personId>+<personId>" (couple) — not
      // a person id itself. The connector's anchor point legitimately sits at one of these
      // partners' own capsule edge, so excluding only a literal `r.id === from` never
      // matched anything and let every edge falsely "collide" with its own start capsule's
      // text. Extract the actual partner ids to exclude instead.
      const fromPartners = from.replace(/^u:/, '').split('+').filter(Boolean);
      const strokeWidthRaw = p.getAttribute('stroke-width') ?? getComputedStyle(p).strokeWidth;
      const strokeWidth = Number.parseFloat(strokeWidthRaw) || 0.35;
      const inflate = strokeWidth / 2 + 1; // mm clearance
      const pathOff = localOffset(root, p);
      const total = p.getTotalLength();
      const samples = Math.min(512, Math.max(2, Math.ceil(total / 0.5)));
      for (let i = 0; i <= samples; i++) {
        const pt = p.getPointAtLength((i / samples) * total);
        const abs = { x: pathOff.x + pt.x, y: pathOff.y + pt.y };
        for (const r of rects) {
          if (fromPartners.includes(r.id) || r.id === to) continue;
          if (abs.x >= r.x1 - inflate && abs.x <= r.x2 + inflate && abs.y >= r.y1 - inflate && abs.y <= r.y2 + inflate) {
            hits.push({ from, to, hit: r.id, x: abs.x, y: abs.y });
          }
        }
      }
    }
    return hits;
  });
}
