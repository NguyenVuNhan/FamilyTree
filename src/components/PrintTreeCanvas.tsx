import type { PrintScene } from '../layout/flow-layout';
import { TITLE_BLOCK_MM } from '../print/fit';
import { themeCss, type ThemeTokens } from '../print/themes';
import { PrintSceneGroup } from './PrintSceneGroup';

export function PrintTreeCanvas({ scene, theme, title, guide, expandedId, onToggle, arrangement = 'flow' }: {
  scene: PrintScene; theme: ThemeTokens; title: string;
  guide: { wMm: number; hMm: number; marginMm: number } | null;
  expandedId: string | null; onToggle: (id: string) => void;
  arrangement?: 'flow' | 'fan';
}) {
  const totalW = scene.wMm;
  const totalH = scene.hMm + TITLE_BLOCK_MM;
  // Fan: the ornament zone is BELOW the root (spec Concept A — "title cartouche
  // below the root"), so the title strip moves to the bottom and the scene
  // renders from y=0. Flow keeps its top strip byte-identical.
  const titleAtBottom = arrangement === 'fan';
  const contentY = titleAtBottom ? 0 : TITLE_BLOCK_MM;
  const titleY = titleAtBottom ? scene.hMm + TITLE_BLOCK_MM * 0.62 : TITLE_BLOCK_MM * 0.62;
  const expanded = expandedId ? scene.nodes.find((n) => n.personId === expandedId) : undefined;
  return (
    <div className="tree-canvas print-canvas" style={{ width: totalW, height: totalH, position: 'relative' }}>
      <svg className="print-canvas-svg" data-arrangement={arrangement} width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
        <style>{themeCss(theme)}</style>
        <rect className="pt-bg" data-print-role="background" x={0} y={0} width={totalW} height={totalH} />
        <text className="pt-title" x={totalW / 2} y={titleY} textAnchor="middle" fontSize={13}>{title}</text>
        {guide && (() => {
          const gx = (scene.wMm - guide.wMm) / 2;
          const gy = (totalH - guide.hMm) / 2;
          return (
            <g data-print-role="guide">
              <rect className="pt-guide" x={gx} y={gy} width={guide.wMm} height={guide.hMm} />
              <rect className="pt-guide" x={gx + guide.marginMm} y={gy + guide.marginMm}
                width={guide.wMm - 2 * guide.marginMm} height={guide.hMm - 2 * guide.marginMm} />
            </g>
          );
        })()}
        <g transform={`translate(0 ${contentY})`}>
          <PrintSceneGroup scene={scene} onToggle={onToggle} />
        </g>
      </svg>
      {expanded && (
        <div className="pn-expanded" data-testid="print-expanded"
          style={{ position: 'absolute', left: expanded.xMm, top: expanded.yMm + contentY + expanded.hMm + 4 }}>
          <strong>{expanded.nameLines.join(' ')}</strong>
          {expanded.years && <div>{expanded.years}</div>}
        </div>
      )}
    </div>
  );
}
