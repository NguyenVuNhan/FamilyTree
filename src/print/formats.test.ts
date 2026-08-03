import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS, PRINT_BOUNDS, formatSizeMm, parseCustomFmt } from './formats';

describe('formats', () => {
  it('preset table (mm, landscape)', () => {
    expect(FORMAT_PRESETS.a4).toMatchObject({ wMm: 297, hMm: 210 });
    expect(FORMAT_PRESETS.a3).toMatchObject({ wMm: 420, hMm: 297 });
    expect(FORMAT_PRESETS.a1).toMatchObject({ wMm: 841, hMm: 594 });
    expect(FORMAT_PRESETS.a0).toMatchObject({ wMm: 1189, hMm: 841 });
    expect(FORMAT_PRESETS.pano).toMatchObject({ wMm: 1200, hMm: 600 });
    expect(FORMAT_PRESETS.square).toMatchObject({ wMm: 900, hMm: 900 });
  });
  it('formatSizeMm resolves presets and custom', () => {
    expect(formatSizeMm({ format: 'pano', customWmm: 0, customHmm: 0 })).toEqual({ wMm: 1200, hMm: 600 });
    expect(formatSizeMm({ format: 'custom', customWmm: 1000, customHmm: 700 })).toEqual({ wMm: 1000, hMm: 700 });
  });
  it('parseCustomFmt: shape and bounds', () => {
    expect(parseCustomFmt('1200x600')).toEqual({ wMm: 1200, hMm: 600 });
    expect(parseCustomFmt('299x400')).toBeNull();   // below min side 300
    expect(parseCustomFmt('2001x600')).toBeNull();  // above max width
    expect(parseCustomFmt('1200x1201')).toBeNull(); // above max height
    expect(parseCustomFmt('banana')).toBeNull();
  });
  it('bounds constants', () => {
    expect(PRINT_BOUNDS.marginMm).toEqual({ min: 50, max: 70 });
    expect(PRINT_BOUNDS.customMm).toEqual({ min: 300, maxW: 2000, maxH: 1200 });
  });
});
