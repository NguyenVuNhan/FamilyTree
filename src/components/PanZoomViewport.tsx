import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { fitToView, isDrag, pan, zoomAt, type Viewport } from '../viewport/viewport';

export interface ViewportApi { zoomIn(): void; zoomOut(): void; fit(): void; scalePct: number }

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PanZoomViewport({ contentSize, children, onBackgroundClick, viewportRef, onScaleChange }: {
  contentSize: { width: number; height: number };
  children: React.ReactNode;
  onBackgroundClick: () => void;
  viewportRef?: React.RefObject<ViewportApi | null>;
  onScaleChange?: (pct: number) => void;
}) {
  const { width, height } = contentSize;
  const container = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const gesture = useRef<{
    startX: number; startY: number; lastX: number; lastY: number; dragged: boolean; startedOnCard: boolean;
    pointerId: number;
  } | null>(null);
  const suppressClick = useRef(false);
  // Active pointers for two-finger pinch (id -> last known client coords), and the
  // distance between the two pointers as of the previous move (the pinch's zoom
  // baseline; recomputed every move so each step applies its own incremental factor).
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);

  // Inlined (rather than delegated to a helper closure) so the ref read is
  // directly visible to the effect that calls it — this is what lets
  // react-hooks recognize the resulting setState call as ref-derived.
  const fit = () => {
    const r = container.current!.getBoundingClientRect();
    setView(fitToView({ width, height }, { width: r.width, height: r.height }));
  };

  useEffect(fit, [width, height]); // fit on mount and when the tree changes

  useEffect(() => {
    onScaleChange?.(Math.round(view.scale * 100));
  }, [view.scale, onScaleChange]);

  // React's onWheel is passive at the root, so preventDefault() there can't stop the
  // page from also scrolling (and, on ctrl+wheel, the browser's own page-zoom kicking
  // in alongside ours). A native, non-passive listener lets us actually suppress it.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setView((v) => zoomAt(v, cursor, e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

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
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          // Second finger down: this becomes a pinch. Mark any in-progress single-pointer
          // gesture as "dragged" so its eventual pointerup suppresses the synthesized click
          // instead of treating it as a background click.
          if (gesture.current) gesture.current.dragged = true;
          const [a, b] = [...pointers.current.values()];
          pinchDist.current = distance(a, b);
          return;
        }
        if (pointers.current.size > 2) return; // ignore a third+ pointer
        // Capture whether the gesture STARTED on a card. Deliberately do NOT call
        // setPointerCapture here: per the Pointer Events spec, once a pointer is
        // captured, the resulting click (and mousedown/mouseup) is retargeted to
        // the capturing element — a plain click on a card would never reach the
        // card's own onClick. We only engage capture once we know it's a real
        // drag (see onPointerMove), so a simple click dispatches natively.
        const startedOnCard = (e.target as HTMLElement).closest('.person-card') !== null;
        gesture.current = {
          startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, dragged: false, startedOnCard,
          pointerId: e.pointerId,
        };
      }}
      onPointerMove={(e) => {
        if (pointers.current.has(e.pointerId)) {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          const currDist = distance(a, b);
          if (pinchDist.current) {
            const rect = container.current!.getBoundingClientRect();
            const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
            flushSync(() => setView((v) => zoomAt(v, mid, currDist / pinchDist.current!)));
          }
          pinchDist.current = currDist;
          return; // pinch handled; single-pointer pan/click logic does not apply
        }
        const g = gesture.current;
        if (!g) return;
        if (!g.dragged && isDrag({ x: g.startX, y: g.startY }, { x: e.clientX, y: e.clientY })) {
          g.dragged = true;
          // Engage capture only now, so panning continues even if the pointer
          // leaves the viewport bounds mid-drag. Best-effort: synthetic/untrusted
          // pointer events (e.g. dispatchEvent-driven touch simulation in tests)
          // have no real "active pointer" session, so the browser may reject
          // capture — that's fine, pan still works via normal event delegation.
          try { e.currentTarget.setPointerCapture(g.pointerId); } catch { /* no active pointer to capture */ }
        }
        if (g.dragged) {
          const dx = e.clientX - g.lastX;
          const dy = e.clientY - g.lastY;
          g.lastX = e.clientX;
          g.lastY = e.clientY;
          setView((v) => pan(v, dx, dy));
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinchDist.current = null;
        const g = gesture.current;
        gesture.current = null;
        if (!g) return;
        if (g.dragged) {
          // Capture was engaged in onPointerMove once dragged (best-effort — see there).
          try { e.currentTarget.releasePointerCapture(g.pointerId); } catch { /* was never captured */ }
          suppressClick.current = true; // swallow the click this gesture would synthesize
        } else if (!g.startedOnCard) {
          onBackgroundClick();
        }
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinchDist.current = null;
        gesture.current = null;
      }}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
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
