import type { DisplayMode } from '../data/types';

export function Toolbar({ title, mode, onMode, scalePct, onZoomIn, onZoomOut, onFit, onPrint }: {
  title: string; mode: DisplayMode; onMode: (m: DisplayMode) => void; scalePct: number;
  onZoomIn: () => void; onZoomOut: () => void; onFit: () => void; onPrint: () => void;
}) {
  return (
    <header className="toolbar">
      <h1>{title}</h1>
      <div className="segmented" role="group" aria-label="Card display mode">
        <button type="button" aria-pressed={mode === 'photo'} onClick={() => onMode('photo')}>Photo</button>
        <button type="button" aria-pressed={mode === 'name'} onClick={() => onMode('name')}>Name</button>
      </div>
      <div className="zoom-controls">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut}>−</button>
        <span data-testid="zoom-pct">{scalePct}%</span>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn}>+</button>
        <button type="button" aria-label="Fit to view" onClick={onFit}>⤢</button>
        <button type="button" aria-label="Print" onClick={onPrint}>🖨</button>
      </div>
    </header>
  );
}
