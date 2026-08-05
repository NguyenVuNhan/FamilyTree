import { yearFontMm, type PrintScene } from '../layout/flow-layout';

const PAD_X = 4;
const PAD_Y = 2.5;

/** The edges+nodes markup shared by PrintTreeCanvas (flow/fan) and
 *  PrintPanelsCanvas — extracted verbatim so node/connector DOM stays identical
 *  across arrangements. Synthetic `m:<label>` marker persons (the panels
 *  arrangement's continuation chips, spec Concept D) render as non-interactive
 *  theme chips instead of person nodes. */
export function PrintSceneGroup({ scene, onToggle }: {
  scene: PrintScene; onToggle: (id: string) => void;
}) {
  return (
    <>
      {scene.edges.map((e, i) => (
        <path key={i} className="connector" data-from={e.fromId} data-to={e.toId} d={e.d} />
      ))}
      {scene.nodes.map((n) =>
        n.personId.startsWith('m:') ? (
          <g key={n.personId} className="print-marker" data-marker={n.personId.slice(2)}
            data-marker-side="out" transform={`translate(${n.xMm} ${n.yMm})`}>
            <rect className="pm-chip" width={n.wMm} height={n.hMm} rx={2} />
            <text className="pm-label" fontSize={n.fontMm} x={n.wMm / 2}
              y={PAD_Y + 0.8 * 1.4 * n.fontMm} textAnchor="middle">{n.nameLines[0]}</text>
          </g>
        ) : (
          <g key={n.personId} className="person-node" role="button" tabIndex={0}
            aria-label={n.nameLines.join(' ')}
            data-person-id={n.personId} data-generation={n.generation}
            transform={`translate(${n.xMm} ${n.yMm})${n.rotateDeg ? ` rotate(${n.rotateDeg})` : ''}`}
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
        ),
      )}
    </>
  );
}
