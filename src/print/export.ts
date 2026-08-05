import type { ThemeTokens } from './themes';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Fetches every font file for the theme and emits deterministic base64 @font-face rules.
 *  `fetcher` is injectable so tests can supply a stub Response without hitting the network. */
export async function collectFontCss(theme: ThemeTokens, fetcher: typeof fetch = fetch): Promise<string> {
  const rules = await Promise.all(theme.fontFiles.map(async ({ family, weight, url }) => {
    const buf = new Uint8Array(await (await fetcher(url)).arrayBuffer());
    let bin = '';
    for (const b of buf) bin += String.fromCharCode(b);
    return `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2");}`;
  }));
  return rules.join('\n');
}

/** Builds a deterministic, mm-true, self-contained SVG print file from the live on-canvas
 *  `.print-canvas-svg` element: strips interactivity/guides, embeds fonts, centers the
 *  content in the sheet, and adds a calibration bar + corner trim marks. No timestamps or
 *  randomness — identical inputs always produce byte-identical output. */
export function buildExportSvg(svgEl: SVGSVGElement, opts: {
  wMm: number; hMm: number; fontCss: string; background: string;
}): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-print-role="guide"]').forEach((el) => el.remove());
  clone.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on') || attr.name === 'tabindex' || attr.name === 'role') el.removeAttribute(attr.name);
    }
  });
  const vb = (clone.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/).map(Number);
  const [cw, ch] = [vb[2], vb[3]];
  const sceneStyle = clone.querySelector('style')?.textContent ?? '';
  clone.querySelector('style')?.remove();
  clone.querySelector('[data-print-role="background"]')?.remove();

  const doc = document.implementation.createDocument(SVG_NS, 'svg');
  const root = doc.documentElement;
  root.setAttribute('width', `${opts.wMm}mm`);
  root.setAttribute('height', `${opts.hMm}mm`);
  root.setAttribute('viewBox', `0 0 ${opts.wMm} ${opts.hMm}`);

  const style = doc.createElementNS(SVG_NS, 'style');
  style.textContent = `${opts.fontCss}\n${sceneStyle}`;
  root.appendChild(style);

  const bg = doc.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('data-print-role', 'background');
  bg.setAttribute('width', String(opts.wMm));
  bg.setAttribute('height', String(opts.hMm));
  bg.setAttribute('fill', opts.background);
  root.appendChild(bg);

  const g = doc.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${(opts.wMm - cw) / 2} ${(opts.hMm - ch) / 2})`);
  for (const child of [...clone.childNodes]) g.appendChild(doc.importNode(child, true));
  root.appendChild(g);

  const cal = doc.createElementNS(SVG_NS, 'g');
  cal.setAttribute('data-print-role', 'calibration');
  const calPath = doc.createElementNS(SVG_NS, 'path');
  calPath.setAttribute('d', `M ${opts.wMm - 120} ${opts.hMm - 10} h 100`);
  calPath.setAttribute('stroke', '#000');
  calPath.setAttribute('stroke-width', '0.35');
  calPath.setAttribute('fill', 'none');
  const calText = doc.createElementNS(SVG_NS, 'text');
  calText.setAttribute('x', String(opts.wMm - 70));
  calText.setAttribute('y', String(opts.hMm - 12));
  calText.setAttribute('font-size', '3.2');
  calText.setAttribute('text-anchor', 'middle');
  calText.textContent = '100 mm';
  cal.appendChild(calPath);
  cal.appendChild(calText);
  root.appendChild(cal);

  const trim = doc.createElementNS(SVG_NS, 'g');
  trim.setAttribute('data-print-role', 'border');
  const L = (x: number, y: number, dx: number, dy: number): SVGPathElement => {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${x + dx * 8} ${y} L ${x} ${y} L ${x} ${y + dy * 8}`);
    path.setAttribute('stroke', '#999');
    path.setAttribute('stroke-width', '0.2');
    path.setAttribute('fill', 'none');
    return path;
  };
  trim.appendChild(L(0.2, 0.2, 1, 1));
  trim.appendChild(L(opts.wMm - 0.2, 0.2, -1, 1));
  trim.appendChild(L(0.2, opts.hMm - 0.2, 1, -1));
  trim.appendChild(L(opts.wMm - 0.2, opts.hMm - 0.2, -1, -1));
  root.appendChild(trim);

  return new XMLSerializer().serializeToString(root);
}

/** `<family>-<arrangement>-<theme>-<W>x<H>cm.svg`, dimensions in cm rounded from mm. */
export function exportFilename(family: string, arrangement: string, theme: string, wMm: number, hMm: number): string {
  return `${family}-${arrangement}-${theme}-${Math.round(wMm / 10)}x${Math.round(hMm / 10)}cm.svg`;
}

/** One panel of the panels arrangement → one self-contained mm-true SVG page.
 *  Extracts the `g.print-panel` with the given label from a clone of the live
 *  canvas, strips its side-by-side composition offset, wraps it in a temp <svg>
 *  whose viewBox is the panel's own physical box, and delegates to the
 *  unchanged buildExportSvg — fonts, background, calibration bar, trim marks
 *  and centering are byte-identical to a single-scene export. */
export function buildPanelExportSvg(svgEl: SVGSVGElement, panelLabel: string, opts: {
  wMm: number; hMm: number; fontCss: string; background: string;
}): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const panel = clone.querySelector(`g.print-panel[data-panel-label="${panelLabel}"]`);
  if (!panel) throw new Error(`buildPanelExportSvg: no panel labeled "${panelLabel}" in the canvas SVG`);
  const pw = Number(panel.getAttribute('data-panel-w'));
  const ph = Number(panel.getAttribute('data-panel-h'));
  if (!(pw > 0) || !(ph > 0)) throw new Error(`buildPanelExportSvg: panel "${panelLabel}" is missing data-panel-w/h`);
  const temp = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  temp.setAttribute('viewBox', `0 0 ${pw} ${ph}`);
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = clone.querySelector('style')?.textContent ?? '';
  temp.appendChild(style);
  panel.removeAttribute('transform'); // composition offset is screen-only
  temp.appendChild(panel);
  return buildExportSvg(temp, opts);
}

/** `<family>-panels-<theme>-<n>of<N>-<W>x<H>cm.svg`, dimensions in cm rounded from mm. */
export function exportPanelFilename(family: string, theme: string, n: number, total: number, wMm: number, hMm: number): string {
  return `${family}-panels-${theme}-${n}of${total}-${Math.round(wMm / 10)}x${Math.round(hMm / 10)}cm.svg`;
}

/** Triggers a browser download of the serialized markup via a Blob URL + synthetic anchor click. */
export function downloadSvg(markup: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking synchronously races the download: the browser reads the blob URL
  // asynchronously after the click, and on a slow machine the revoke wins — the
  // panels export (8 clicks in one pass) shipped only 2 of 8 files on CI. Defer
  // long enough for any download to begin; the blob itself is tiny and one-shot.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
