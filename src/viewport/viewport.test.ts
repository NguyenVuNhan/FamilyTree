import { describe, expect, it } from 'vitest';
import { clampScale, DRAG_THRESHOLD_PX, fitToView, isDrag, MAX_SCALE, MIN_SCALE, pan, zoomAt } from './viewport';

describe('viewport math', () => {
  it('clampScale enforces 0.4–2.5', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE);
    expect(clampScale(9)).toBe(MAX_SCALE);
    expect(clampScale(1)).toBe(1);
  });

  it('pan shifts translation', () => {
    expect(pan({ x: 10, y: 20, scale: 1 }, 5, -5)).toEqual({ x: 15, y: 15, scale: 1 });
  });

  it('zoomAt keeps the point under the cursor stationary', () => {
    const v = { x: 0, y: 0, scale: 1 };
    const cursor = { x: 100, y: 50 };
    const z = zoomAt(v, cursor, 2);
    // content point under cursor before: (100,50); after: content*2 + t = cursor
    expect(z.scale).toBe(2);
    expect(100 * 2 + z.x).toBeCloseTo(100);
    expect(50 * 2 + z.y).toBeCloseTo(50);
  });

  it('zoomAt clamps at the limits', () => {
    expect(zoomAt({ x: 0, y: 0, scale: 2.4 }, { x: 0, y: 0 }, 2).scale).toBe(MAX_SCALE);
    expect(zoomAt({ x: 0, y: 0, scale: 0.5 }, { x: 0, y: 0 }, 0.1).scale).toBe(MIN_SCALE);
  });

  it('fitToView centers content at the largest fitting scale (never above 1)', () => {
    const v = fitToView({ width: 2000, height: 1000 }, { width: 1000, height: 800 });
    expect(v.scale).toBeCloseTo(0.5);
    expect(v.x).toBeCloseTo(0);                      // 2000*0.5 = 1000 wide, flush
    expect(v.y).toBeCloseTo((800 - 500) / 2);        // vertically centered
    const small = fitToView({ width: 100, height: 100 }, { width: 1000, height: 800 });
    expect(small.scale).toBe(1);                     // don't blow up small trees
    expect(small.x).toBeCloseTo(450);
  });

  it('fitToView respects the MIN_SCALE floor for huge trees', () => {
    expect(fitToView({ width: 100000, height: 100 }, { width: 1000, height: 800 }).scale).toBe(MIN_SCALE);
  });

  it('isDrag uses the 5px threshold', () => {
    expect(isDrag({ x: 0, y: 0 }, { x: DRAG_THRESHOLD_PX, y: 0 })).toBe(false);
    expect(isDrag({ x: 0, y: 0 }, { x: DRAG_THRESHOLD_PX + 1, y: 0 })).toBe(true);
    expect(isDrag({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true); // euclidean
  });
});
