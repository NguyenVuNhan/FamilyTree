export interface Viewport { x: number; y: number; scale: number }

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 2.5;
export const DRAG_THRESHOLD_PX = 5;

export function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

export function pan(v: Viewport, dx: number, dy: number): Viewport {
  return { ...v, x: v.x + dx, y: v.y + dy };
}

export function zoomAt(v: Viewport, cursor: { x: number; y: number }, factor: number): Viewport {
  const scale = clampScale(v.scale * factor);
  const k = scale / v.scale;
  return { scale, x: cursor.x - (cursor.x - v.x) * k, y: cursor.y - (cursor.y - v.y) * k };
}

export function fitToView(
  content: { width: number; height: number },
  container: { width: number; height: number },
): Viewport {
  const scale = clampScale(Math.min(1, container.width / content.width, container.height / content.height));
  return {
    scale,
    x: (container.width - content.width * scale) / 2,
    y: (container.height - content.height * scale) / 2,
  };
}

export function isDrag(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) > DRAG_THRESHOLD_PX;
}
