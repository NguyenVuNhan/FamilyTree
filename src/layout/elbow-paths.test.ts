import { describe, expect, it } from 'vitest';
import { elbowDrop, marriageLine } from './elbow-paths';

describe('elbow paths', () => {
  it('marriage line is a horizontal segment', () => {
    expect(marriageLine(10, 50, 20)).toBe('M 10 20 L 50 20');
  });

  it('straight drop when aligned', () => {
    expect(elbowDrop({ x: 100, y: 10 }, { x: 100, y: 90 }, 50)).toBe('M 100 10 L 100 90');
  });

  it('rounded elbow going left contains two quadratic corners', () => {
    const d = elbowDrop({ x: 200, y: 10 }, { x: 100, y: 90 }, 50, 12);
    expect(d).toBe('M 200 10 L 200 38 Q 200 50 188 50 L 112 50 Q 100 50 100 62 L 100 90');
  });

  it('rounded elbow going right mirrors the corners', () => {
    const d = elbowDrop({ x: 100, y: 10 }, { x: 200, y: 90 }, 50, 12);
    expect(d).toBe('M 100 10 L 100 38 Q 100 50 112 50 L 188 50 Q 200 50 200 62 L 200 90');
  });
});
