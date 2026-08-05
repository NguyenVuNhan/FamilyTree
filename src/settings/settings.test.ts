import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, printControlsActive, sanitizeSettings, saveSettings, SPACING_BOUNDS } from './settings';

afterEach(() => localStorage.clear());

describe('sanitizeSettings', () => {
  it('returns defaults for junk input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and defaults invalid ones independently', () => {
    const s = sanitizeSettings({ cardStyle: 'circle', contentMode: 'bogus', genGap: 120, cardPadding: 999 });
    expect(s.cardStyle).toBe('circle');           // valid → kept
    expect(s.contentMode).toBe(DEFAULT_SETTINGS.contentMode); // invalid → default
    expect(s.genGap).toBe(120);                    // in range → kept
    expect(s.cardPadding).toBe(DEFAULT_SETTINGS.cardPadding); // out of range → default
  });

  it('rejects non-finite and non-number spacing values', () => {
    const s = sanitizeSettings({ coupleGap: '30', siblingGap: NaN, genGap: Infinity });
    expect(s.coupleGap).toBe(DEFAULT_SETTINGS.coupleGap);
    expect(s.siblingGap).toBe(DEFAULT_SETTINGS.siblingGap);
    expect(s.genGap).toBe(DEFAULT_SETTINGS.genGap);
  });

  it('bounds match the spec', () => {
    expect(SPACING_BOUNDS).toEqual({
      cardPadding: { min: 6, max: 28 },
      coupleGap: { min: 12, max: 80 },
      siblingGap: { min: 16, max: 100 },
      genGap: { min: 40, max: 200 },
    });
  });
});

describe('load/save round-trip', () => {
  it('save then load returns the same settings, scoped per family', () => {
    const custom = { ...DEFAULT_SETTINGS, cardStyle: 'photoLeft' as const, genGap: 60 };
    saveSettings('alpha', custom);
    expect(loadSettings('alpha')).toEqual(custom);
    expect(loadSettings('bravo')).toEqual(DEFAULT_SETTINGS); // other family untouched
  });

  it('uses the ft:layout:<familyKey> storage key', () => {
    saveSettings('alpha', DEFAULT_SETTINGS);
    expect(localStorage.getItem('ft:layout:alpha')).not.toBeNull();
  });

  it('load survives corrupt JSON', () => {
    localStorage.setItem('ft:layout:alpha', '{not json');
    expect(loadSettings('alpha')).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults match the spec', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      cardStyle: 'archCard', contentMode: 'full', namePosition: 'bottom',
      cardPadding: 14, coupleGap: 28, siblingGap: 36, genGap: 90,
      connectorStyle: 'elbow', placeholderStyle: 'initials',
      arrangement: 'topDown', theme: 'indochine', format: 'pano',
      customWmm: 1200, customHmm: 600, marginMm: 60, frameGuide: false,
    });
  });
});

describe('print settings fields', () => {
  it('defaults', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      arrangement: 'topDown', theme: 'indochine', format: 'pano',
      customWmm: 1200, customHmm: 600, marginMm: 60, frameGuide: false,
    });
  });
  it('sanitize: per-field fallback on junk', () => {
    const s = sanitizeSettings({ arrangement: 'banana', theme: 'inkwash', format: 'b5', marginMm: 500, frameGuide: 'yes' });
    expect(s).toMatchObject({
      arrangement: 'topDown', theme: 'inkwash', format: 'pano', marginMm: 60, frameGuide: false,
    });
  });
  it('sanitize: custom mm bounds (300 min side, 2000×1200 max)', () => {
    expect(sanitizeSettings({ customWmm: 299 }).customWmm).toBe(1200);
    expect(sanitizeSettings({ customWmm: 2000, customHmm: 1200 })).toMatchObject({ customWmm: 2000, customHmm: 1200 });
  });
  it('printControlsActive', () => {
    expect(printControlsActive(DEFAULT_SETTINGS)).toBe(false);
    expect(printControlsActive({ ...DEFAULT_SETTINGS, arrangement: 'flow' })).toBe(true);
  });
});

describe('fan arrangement (PR ②)', () => {
  it('sanitize accepts fan; junk still falls back', () => {
    expect(sanitizeSettings({ arrangement: 'fan' }).arrangement).toBe('fan');
    expect(sanitizeSettings({ arrangement: 'fans' }).arrangement).toBe('topDown');
  });
  it('printControlsActive is true for fan', () => {
    expect(printControlsActive({ ...DEFAULT_SETTINGS, arrangement: 'fan' })).toBe(true);
  });
});

describe('panels arrangement + trip cross-field (PR ③)', () => {
  it('sanitize accepts panels; junk still falls back', () => {
    expect(sanitizeSettings({ arrangement: 'panels' }).arrangement).toBe('panels');
    expect(sanitizeSettings({ arrangement: 'panel' }).arrangement).toBe('topDown');
  });
  it('printControlsActive is true for panels', () => {
    expect(printControlsActive({ ...DEFAULT_SETTINGS, arrangement: 'panels' })).toBe(true);
  });
  it('trip survives only with panels; any other arrangement degrades it to the default format per-field', () => {
    expect(sanitizeSettings({ arrangement: 'panels', format: 'trip' }).format).toBe('trip');
    expect(sanitizeSettings({ arrangement: 'flow', format: 'trip' }).format).toBe(DEFAULT_SETTINGS.format);
    expect(sanitizeSettings({ format: 'trip' }).format).toBe(DEFAULT_SETTINGS.format); // topDown default
    // the degrade never touches the arrangement itself
    expect(sanitizeSettings({ arrangement: 'flow', format: 'trip' }).arrangement).toBe('flow');
  });
});
