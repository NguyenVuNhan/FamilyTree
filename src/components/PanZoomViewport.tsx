import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { fitToView, isDrag, pan, zoomAt, type Viewport } from '../viewport/viewport';

export interface ViewportApi { zoomIn(): void; zoomOut(): void; fit(): void; scalePct: number }

export function PanZoomViewport({ contentSize, children, onBackgroundClick, viewportRef }: {
  contentSize: { width: number; height: number };
  children: React.ReactNode;
  onBackgroundClick: () => void;
  viewportRef?: React.RefObject<ViewportApi | null>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const gesture = useRef<{ startX: number; startY: number; lastX: number; lastY: number; dragged: boolean } | null>(null);
  const suppressClick = useRef(false);

  // Inlined (rather than delegated to a helper closure) so the ref read is
  // directly visible to the effect that calls it — this is what lets
  // react-hooks recognize the resulting setState call as ref-derived.
  const fit = () => {
    const r = container.current!.getBoundingClientRect();
    setView(fitToView(contentSize, { width: r.width, height: r.height }));
  };

  useEffect(fit, [contentSize.width, contentSize.height]); // fit on mount and when the tree changes

  const center = () => {
    const r = container.current!.getBoundingClientRect();
    return { x: r.width / 2, y: r.height / 2 };
  };

  useImperativeHandle(viewportRef, (): ViewportApi => ({
    zoomIn: () => flushSync(() => setView((v) => zoomAt(v, center(), 1.1))),
    zoomOut: () => flushSync(() => setView((v) => zoomAt(v, center(), 1 / 1.1))),
    fit: () => flushSync(fit),
    scalePct: Math.round(view.scale * 100),
  }));

  return (
    <div
      ref={container}
      className="viewport"
      data-testid="viewport"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        gesture.current = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, dragged: false };
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g) return;
        if (isDrag({ x: g.startX, y: g.startY }, { x: e.clientX, y: e.clientY })) g.dragged = true;
        if (g.dragged) {
          const dx = e.clientX - g.lastX;
          const dy = e.clientY - g.lastY;
          g.lastX = e.clientX;
          g.lastY = e.clientY;
          setView((v) => pan(v, dx, dy));
        }
      }}
      onPointerUp={(e) => {
        const g = gesture.current;
        gesture.current = null;
        if (!g) return;
        if (g.dragged) {
          suppressClick.current = true; // swallow the click this gesture would synthesize
        } else if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.person-card') === null) {
          onBackgroundClick();
        }
      }}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onWheel={(e) => {
        const rect = container.current!.getBoundingClientRect();
        const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setView((v) => zoomAt(v, cursor, e.deltaY < 0 ? 1.1 : 1 / 1.1));
      }}
    >
      <div
        className="viewport-transform"
        data-testid="viewport-transform"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
