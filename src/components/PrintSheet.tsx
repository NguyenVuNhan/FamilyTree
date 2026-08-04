import { useEffect, useRef } from 'react';
import { buildExportSvg } from '../print/export';

/** Print parity for SVG arrangements: on beforeprint, compose the same markup the
 *  export produces (fonts are already loaded in the page, so no embedding needed)
 *  and size the page to the chosen format. Print CSS shows ONLY this sheet. */
export function PrintSheet({ svgSelector, wMm, hMm, background }: {
  svgSelector: string; wMm: number; hMm: number; background: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const compose = () => {
      const svg = document.querySelector<SVGSVGElement>(svgSelector);
      if (!svg || !ref.current) return;
      ref.current.innerHTML = buildExportSvg(svg, { wMm, hMm, fontCss: '', background });
      let style = document.getElementById('print-page');
      if (!style) {
        style = document.createElement('style');
        style.id = 'print-page';
        document.head.appendChild(style);
      }
      style.textContent = `@media print { @page { size: ${wMm}mm ${hMm}mm; margin: 0 } .print-sheet svg { width: ${wMm}mm; height: ${hMm}mm; } }`;
    };
    window.addEventListener('beforeprint', compose);
    // The injected @page rule must not outlive this component: if the user switches
    // away from Scroll (unmounting PrintSheet) without printing again, a stale rule
    // would keep forcing the flow sheet's page size on the next print (e.g. Top-down).
    return () => {
      window.removeEventListener('beforeprint', compose);
      document.getElementById('print-page')?.remove();
    };
  }, [svgSelector, wMm, hMm, background]);
  return <div ref={ref} className="print-sheet" data-testid="print-sheet" aria-hidden="true" />;
}
