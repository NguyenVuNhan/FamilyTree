import { describe, expect, it } from 'vitest';
import { flipRotation, polarPoint, solveInflation, waterfill } from './fan-geometry';

describe('polarPoint (SVG y-down, fan opens upward)', () => {
  it('θ=0 → right end of the diameter; θ=π/2 → straight up; θ=π → left end', () => {
    expect(polarPoint(0, 0, 10, 0).x).toBeCloseTo(10, 9);
    expect(polarPoint(0, 0, 10, 0).y).toBeCloseTo(0, 9);
    expect(polarPoint(0, 0, 10, Math.PI / 2).x).toBeCloseTo(0, 9);
    expect(polarPoint(0, 0, 10, Math.PI / 2).y).toBeCloseTo(-10, 9);
    expect(polarPoint(5, 3, 10, Math.PI).x).toBeCloseTo(-5, 9);
    expect(polarPoint(5, 3, 10, Math.PI).y).toBeCloseTo(3, 9);
  });
});

describe('flipRotation (auto-flip past vertical — nothing reads upside-down)', () => {
  it.each([
    [0, 0, false],
    [Math.PI / 4, -45, false],
    [Math.PI / 2, -90, false],       // straight up reads bottom-to-top, like a y-axis label
    [(2 * Math.PI) / 3, 60, true],   // past vertical: flipped, reads inward
    [Math.PI, 0, true],
  ])('θ=%f → rotate %f°, flipped=%s', (theta, deg, flipped) => {
    const r = flipRotation(theta);
    expect(r.rotateDeg).toBeCloseTo(deg, 9);
    expect(r.flipped).toBe(flipped);
  });
  it('rotation magnitude never exceeds 90° anywhere on the semicircle', () => {
    for (let i = 0; i <= 180; i++) {
      expect(Math.abs(flipRotation((i * Math.PI) / 180).rotateDeg)).toBeLessThanOrEqual(90);
    }
  });
});

describe('waterfill (proportional sectors with per-item floors)', () => {
  it('is purely proportional when no floor binds', () => {
    const [a, b] = waterfill(Math.PI, [{ weight: 3, floorRad: 0 }, { weight: 1, floorRad: 0 }]);
    expect(a).toBeCloseTo((Math.PI * 3) / 4, 9);
    expect(b).toBeCloseTo(Math.PI / 4, 9);
  });
  it('pins a starved item at its floor and re-shares the rest', () => {
    const [big, small] = waterfill(1, [{ weight: 99, floorRad: 0 }, { weight: 1, floorRad: 0.2 }]);
    expect(small).toBeCloseTo(0.2, 9);
    expect(big).toBeCloseTo(0.8, 9);
  });
  it('honors every floor, preserves order, and sums to the span exactly', () => {
    const spans = waterfill(2, [
      { weight: 1, floorRad: 0.5 }, { weight: 5, floorRad: 0 }, { weight: 1, floorRad: 0.6 },
    ]);
    expect(spans.reduce((s, v) => s + v, 0)).toBeCloseTo(2, 9);
    expect(spans[0]).toBeGreaterThanOrEqual(0.5 - 1e-12);
    expect(spans[2]).toBeGreaterThanOrEqual(0.6 - 1e-12);
  });
});

describe('solveInflation', () => {
  it('returns 0 when the need already fits', () => {
    expect(solveInflation(() => 1, Math.PI)).toBe(0);
  });
  it('bisects to the smallest sufficient Δ: need 100/(50+Δ) ≤ 1 ⇒ Δ = 50', () => {
    expect(solveInflation((d) => 100 / (50 + d), 1)).toBeCloseTo(50, 6);
  });
  it('is deterministic (fixed iteration count, no randomness)', () => {
    const f = (d: number) => 10 / (1 + d);
    expect(solveInflation(f, 0.5)).toBe(solveInflation(f, 0.5));
  });
});
