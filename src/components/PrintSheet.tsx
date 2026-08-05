import { useEffect, useRef } from 'react';
import { buildExportSvg, buildPanelExportSvg } from '../print/export';

/** Print parity for SVG arrangements: on beforeprint, compose the same markup the
 *  export produces (fonts are already loaded in the page, so no embedding needed)
 *  and size the page to the chosen format. Print CSS shows ONLY this sheet.
 *  With `panelLabels` (the panels arrangement) it composes one page per panel —
 *  the format is a page PER PANEL, and `break-after: page` separates them. */
export function PrintSheet({ svgSelector, wMm, hMm, background, panelLabels }: {
  svgSelector: string; wMm: number; hMm: number; background: string; panelLabels?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Effect key: arrays make unstable deps; the joined string is stable per content.
  // Labels are 'master' + ASCII Roman numerals — '|' can never appear in one.
  const labelsKey = panelLabels?.join('|') ?? '';
  useEffect(() => {
    const compose = () => {
      const svg = document.querySelector<SVGSVGElement>(svgSelector);
      if (!svg || !ref.current) return;
      const labels = labelsKey === '' ? null : labelsKey.split('|');
      ref.current.innerHTML = labels
        ? labels.map((l) =>
            `<div class="print-sheet-page">${buildPanelExportSvg(svg, l, { wMm, hMm, fontCss: '', background })}</div>`,
          ).join('')
        : buildExportSvg(svg, { wMm, hMm, fontCss: '', background });
      let style = document.getElementById('print-page');
      if (!style) {
        style = document.createElement('style');
        style.id = 'print-page';
        document.head.appendChild(style);
      }
      style.textContent = `@media print { @page { size: ${wMm}mm ${hMm}mm; margin: 0 } .print-sheet svg { width: ${wMm}mm; height: ${hMm}mm; display: block; } .print-sheet-page:not(:last-child) { break-after: page; } }`;
    };
    window.addEventListener('beforeprint', compose);
    // The injected @page rule must not outlive this component: if the user switches
    // away from a print arrangement (unmounting PrintSheet) without printing again,
    // a stale rule would keep forcing this sheet's page size on the next print.
    return () => {
      window.removeEventListener('beforeprint', compose);
      document.getElementById('print-page')?.remove();
    };
  }, [svgSelector, wMm, hMm, background, labelsKey]);
  return <div ref={ref} className="print-sheet" data-testid="print-sheet" aria-hidden="true" />;
}
