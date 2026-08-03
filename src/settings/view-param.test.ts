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
