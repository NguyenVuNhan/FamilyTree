import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type LayoutSettings } from './settings';
import { decodeView, encodeView } from './view-param';

const s = (over: Partial<LayoutSettings>): LayoutSettings => ({ ...DEFAULT_SETTINGS, ...over });

describe('encodeView', () => {
  it('all-default settings encode to null (clean link)', () => {
    expect(encodeView(DEFAULT_SETTINGS)).toBeNull();
  });
  it('lists only non-default fields, with the arch alias', () => {
    expect(encodeView(s({ cardStyle: 'classic' }))).toBe('style:classic');
    expect(encodeView(s({ cardStyle: 'circle', contentMode: 'name', genGap: 120 })))
      .toBe('style:circle,show:name,gen:120');
  });
  it('a non-default archCard field never appears (it IS the default)', () => {
    expect(encodeView(s({ genGap: 120 }))).toBe('gen:120');
  });
});

describe('decodeView', () => {
  it('round-trips every field', () => {
    const custom = s({
      cardStyle: 'photoLeft', contentMode: 'name', namePosition: 'top', cardPadding: 20,
      coupleGap: 40, siblingGap: 50, genGap: 120, connectorStyle: 'curved', placeholderStyle: 'illustrated',
    });
    expect(decodeView(encodeView(custom)!)).toEqual(custom);
  });
  it('accepts arch as an alias for archCard', () => {
    expect(decodeView('style:arch').cardStyle).toBe('archCard');
  });
  it('unspecified fields come back as defaults (sender left them default)', () => {
    expect(decodeView('style:circle')).toEqual(s({ cardStyle: 'circle' }));
  });
  it('degrades garbage per-field, never throwing', () => {
    expect(decodeView('style:bogus,gen:120,junk,,pad:99999,:x,conn')).toEqual(s({ genGap: 120 }));
    expect(decodeView('')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('print view keys (UC-90..92)', () => {
  it('encodes only non-default print fields', () => {
    const settings = { ...DEFAULT_SETTINGS, arrangement: 'flow' as const, theme: 'inkwash' as const, marginMm: 50, frameGuide: true };
    expect(encodeView(settings)).toBe('arr:flow,theme:inkwash,mgn:50,guide:1');
  });
  it('custom format round-trips as WxH mm', () => {
    const settings = { ...DEFAULT_SETTINGS, format: 'custom' as const, customWmm: 1000, customHmm: 700 };
    const encoded = encodeView(settings)!;
    expect(encoded).toContain('fmt:1000x700');
    expect(decodeView(encoded)).toMatchObject({ format: 'custom', customWmm: 1000, customHmm: 700 });
  });
  it('decode: garbage degrades per-field (UC-92)', () => {
    expect(decodeView('arr:banana,theme:inkwash,fmt:9999x1,mgn:500,guide:2')).toMatchObject({
      arrangement: 'topDown', theme: 'inkwash', format: 'pano', marginMm: 60, frameGuide: false,
    });
  });
  it('full round-trip', () => {
    const settings = { ...DEFAULT_SETTINGS, arrangement: 'flow' as const, theme: 'botanical' as const, format: 'square' as const, frameGuide: true };
    expect(decodeView(encodeView(settings)!)).toEqual(settings);
  });
});
