import type { PrintPanels } from '../layout/panels-layout';
import { TITLE_BLOCK_MM } from '../print/fit';
import { themeCss, type ThemeTokens } from '../print/themes';
import { PrintSceneGroup } from './PrintSceneGroup';

const FRAME_OUTER_MM = 0.7; // double rule: heavy outer line at the panel edge…
const FRAME_INSET_MM = 2;   // …thin inner line inset 2mm (Royal Botanical's gilt
                            // double-rule generalized to every theme's accent)

/** Botanical Atlas canvas: all panels in ONE on-screen SVG (side-by-side, spec
 *  Concept D), each panel a self-contained `g.print-panel` group that export
 *  and PrintSheet extract into its own page/file. Same screen=print source of
 *  truth as PrintTreeCanvas — this component only composes, never lays out. */
export function PrintPanelsCanvas({ composition, theme, title, guide, expandedId, onToggle }: {
  composition: PrintPanels; theme: ThemeTokens; title: string;
  guide: { wMm: number; hMm: number; marginMm: number } | null;
  expandedId: string | null; onToggle: (id: string) => void;
}) {
  const totalW = composition.wMm;
  const totalH = composition.hMm;
  const expandedAt = (() => {
    if (!expandedId) return null;
    for (const p of composition.panels) {
      const n = p.scene.nodes.find((x) => x.personId === expandedId);
      if (n) return { n, p };
    }
    return null;
  })();
  return (
    <div className="tree-canvas print-canvas" style={{ width: totalW, height: totalH, position: 'relative' }}>
      <svg className="print-canvas-svg" data-arrangement="panels" width={totalW} height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}>
        <style>{themeCss(theme)}</style>
        <rect className="pt-bg" data-print-role="background" x={0} y={0} width={totalW} height={totalH} />
        {composition.panels.map((p) => (
          <g key={p.label ?? 'master'} className="print-panel"
            data-panel-label={p.label ?? 'master'} data-panel-w={p.wMm} data-panel-h={p.hMm}
            transform={`translate(${p.xMm} 0)`}>
            <g data-print-role="border">
              <rect className="pp-frame" x={FRAME_OUTER_MM / 2} y={FRAME_OUTER_MM / 2}
                width={p.wMm - FRAME_OUTER_MM} height={p.hMm - FRAME_OUTER_MM} strokeWidth={FRAME_OUTER_MM} />
              <rect className="pp-frame" x={FRAME_INSET_MM} y={FRAME_INSET_MM}
                width={p.wMm - 2 * FRAME_INSET_MM} height={p.hMm - 2 * FRAME_INSET_MM} strokeWidth={0.35} />
            </g>
            <text className="pt-title" x={p.wMm / 2} y={TITLE_BLOCK_MM * (p.label ? 0.5 : 0.62)}
              textAnchor="middle" fontSize={p.label ? 9 : 13}>
              {p.label ? `${p.label} · ${p.headName ?? ''}` : title}
            </text>
            {p.label && (
              <>
                <g className="print-marker" data-marker={p.label} data-marker-side="in"
                  transform={`translate(6 ${TITLE_BLOCK_MM * 0.5 - 5})`}>
                  <rect className="pm-chip" width={12} height={8} rx={2} />
                  <text className="pm-label" x={6} y={5.9} textAnchor="middle" fontSize={4.5}>{p.label}</text>
                </g>
                <text className="pt-subtitle" x={p.wMm / 2} y={TITLE_BLOCK_MM * 0.82}
                  textAnchor="middle" fontSize={4}>
                  {`continued from ${p.parentLabel ? `panel ${p.parentLabel}` : 'the master panel'}`}
                </text>
              </>
            )}
            {guide && (
              <g data-print-role="guide">
                <rect className="pt-guide" x={(p.wMm - guide.wMm) / 2} y={(p.hMm - guide.hMm) / 2}
                  width={guide.wMm} height={guide.hMm} />
                <rect className="pt-guide" x={(p.wMm - guide.wMm) / 2 + guide.marginMm}
                  y={(p.hMm - guide.hMm) / 2 + guide.marginMm}
                  width={guide.wMm - 2 * guide.marginMm} height={guide.hMm - 2 * guide.marginMm} />
              </g>
            )}
            <g transform={`translate(0 ${TITLE_BLOCK_MM})`}>
              <PrintSceneGroup scene={p.scene} onToggle={onToggle} />
            </g>
          </g>
        ))}
      </svg>
      {expandedAt && (
        <div className="pn-expanded" data-testid="print-expanded"
          style={{
            position: 'absolute',
            left: expandedAt.p.xMm + expandedAt.n.xMm,
            top: expandedAt.n.yMm + TITLE_BLOCK_MM + expandedAt.n.hMm + 4,
          }}>
          <strong>{expandedAt.n.nameLines.join(' ')}</strong>
          {expandedAt.n.years && <div>{expandedAt.n.years}</div>}
        </div>
      )}
    </div>
  );
}
