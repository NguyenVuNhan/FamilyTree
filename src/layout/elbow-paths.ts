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
