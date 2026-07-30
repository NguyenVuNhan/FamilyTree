import { FitIcon, GearIcon, PrinterIcon } from './icons';

export function Toolbar({ title, scalePct, onZoomIn, onZoomOut, onFit, onPrint, settingsOpen, onToggleSettings }: {
  title: string; scalePct: number;
  onZoomIn: () => void; onZoomOut: () => void; onFit: () => void; onPrint: () => void;
  settingsOpen: boolean; onToggleSettings: () => void;
}) {
  return (
    <header className="toolbar">
      <h1>{title}</h1>
      <div className="zoom-controls">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut}>−</button>
        <span data-testid="zoom-pct">{scalePct}%</span>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn}>+</button>
        <button type="button" aria-label="Fit to view" onClick={onFit}><FitIcon /></button>
        <button type="button" aria-label="Print" onClick={onPrint}><PrinterIcon /></button>
        <button type="button" aria-label="Layout settings" aria-pressed={settingsOpen} onClick={onToggleSettings}><GearIcon /></button>
      </div>
    </header>
  );
}
