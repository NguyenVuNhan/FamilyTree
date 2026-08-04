import type { PrintScene } from '../layout/flow-layout';
import { yearFontMm } from '../layout/flow-layout';
import { TITLE_BLOCK_MM } from '../print/fit';
import { themeCss, type ThemeTokens } from '../print/themes';

const PAD_X = 4;
const PAD_Y = 2.5;

export function PrintTreeCanvas({ scene, theme, title, guide, expandedId, onToggle }: {
  scene: PrintScene; theme: ThemeTokens; title: string;
  guide: { wMm: number; hMm: number; marginMm: number } | null;
  expandedId: string | null; onToggle: (id: string) => void;
}) {
  const totalW = scene.wMm;
  const totalH = scene.hMm + TITLE_BLOCK_MM;
  const expanded = expandedId ? scene.nodes.find((n) => n.personId === expandedId) : undefined;
  return (
    <div className="tree-canvas print-canvas" style={{ width: totalW, height: totalH, position: 'relative' }}>
      <svg className="print-canvas-svg" data-arrangement="flow" width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
        <style>{themeCss(theme)}</style>
        <rect className="pt-bg" data-print-role="background" x={0} y={0} width={totalW} height={totalH} />
        <text className="pt-title" x={totalW / 2} y={TITLE_BLOCK_MM * 0.62} textAnchor="middle" fontSize={13}>{title}</text>
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
        <g transform={`translate(0 ${TITLE_BLOCK_MM})`}>
          {scene.edges.map((e, i) => (
            <path key={i} className="connector" data-from={e.fromId} data-to={e.toId} d={e.d} />
          ))}
          {scene.nodes.map((n) => (
            <g key={n.personId} className="person-node" role="button" tabIndex={0}
              aria-label={n.nameLines.join(' ')}
              data-person-id={n.personId} data-generation={n.generation}
              transform={`translate(${n.xMm} ${n.yMm})`}
              onClick={() => onToggle(n.personId)}
              onKeyDown={(e) => { if (e.key === 'Enter') onToggle(n.personId); }}>
              <rect className="pn-capsule" width={n.wMm} height={n.hMm} rx={Math.min(n.hMm / 2, 6)}
                strokeWidth={n.generation <= 1 ? 0.6 : 0.35} />
              {n.nameLines.map((line, i) => (
                <text key={i} className={n.titleFace ? 'pn-name-title' : 'pn-name'} fontSize={n.fontMm}
                  x={PAD_X} y={PAD_Y + (i + 0.8) * 1.4 * n.fontMm}>{line}</text>
              ))}
              {n.years && (
                <text className="pn-years" fontSize={yearFontMm(n.fontMm)}
                  x={PAD_X} y={PAD_Y + (n.nameLines.length + 0.7) * 1.4 * n.fontMm}>{n.years}</text>
              )}
            </g>
          ))}
        </g>
      </svg>
      {expanded && (
        <div className="pn-expanded" data-testid="print-expanded"
          style={{ position: 'absolute', left: expanded.xMm, top: expanded.yMm + TITLE_BLOCK_MM + expanded.hMm + 4 }}>
          <strong>{expanded.nameLines.join(' ')}</strong>
          {expanded.years && <div>{expanded.years}</div>}
        </div>
      )}
    </div>
  );
}
