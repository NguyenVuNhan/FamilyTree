import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '../settings/settings';
import { useNameLines } from './use-name-lines';

// jsdom has no canvas 2D → canvasMeasurer falls back to 8px/char, deterministic here.
describe('useNameLines', () => {
  it('returns 1 for short names', () => {
    const { result } = renderHook(() => useNameLines(['Ann Lee'], DEFAULT_SETTINGS));
    expect(result.current).toBe(1); // 7 chars × 8 = 56 ≤ 112 (arch text width)
  });
  it('counts wrapped lines for long names', () => {
    const { result } = renderHook(() => useNameLines(['A'.repeat(30)], DEFAULT_SETTINGS));
    expect(result.current).toBe(3); // 240px unbroken word over 112px lines → 3
  });
  it('is 1 for an empty family', () => {
    const { result } = renderHook(() => useNameLines([], DEFAULT_SETTINGS));
    expect(result.current).toBe(1);
  });
});
