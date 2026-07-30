import type { ConnectorStyle } from '../settings/settings';

// Straight horizontal marriage line
export function marriageLine(x1: number, x2: number, y: number): string {
  return `M ${x1} ${y} L ${x2} ${y}`;
}

// Rounded elbow: vertical drop from `from`, corner onto bus at busY, horizontal run,
// corner down to `to`. Degenerates to a straight V-line when |from.x - to.x| < 2*radius.
export function elbowDrop(
  from: { x: number; y: number },
  to: { x: number; y: number },
  busY: number,
  radius = 12,
): string {
  if (Math.abs(from.x - to.x) < 2 * radius) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const dir = to.x > from.x ? 1 : -1;
  return [
    `M ${from.x} ${from.y}`,
    `L ${from.x} ${busY - radius}`,
    `Q ${from.x} ${busY} ${from.x + dir * radius} ${busY}`,
    `L ${to.x - dir * radius} ${busY}`,
    `Q ${to.x} ${busY} ${to.x} ${busY + radius}`,
    `L ${to.x} ${to.y}`,
  ].join(' ');
}

// Direct line from parent anchor to child top.
export function straightDrop(from: { x: number; y: number }, to: { x: number; y: number }): string {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

// One smooth cubic bezier whose control points sit on the bus level.
export function curvedDrop(
  from: { x: number; y: number },
  to: { x: number; y: number },
  busY: number,
): string {
  return `M ${from.x} ${from.y} C ${from.x} ${busY} ${to.x} ${busY} ${to.x} ${to.y}`;
}

// Style dispatcher used by the layout engine.
export function childDrop(
  style: ConnectorStyle,
  from: { x: number; y: number },
  to: { x: number; y: number },
  busY: number,
): string {
  if (style === 'straight') return straightDrop(from, to);
  if (style === 'curved') return curvedDrop(from, to, busY);
  return elbowDrop(from, to, busY);
}
