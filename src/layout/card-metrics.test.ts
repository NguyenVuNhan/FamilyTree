import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SPACING_BOUNDS, type LayoutSettings } from '../settings/settings';
import { cardMetrics, DEFAULT_METRICS, effectiveCardStyle, layoutMetrics, MIN_CARD_SIZE, nameTextWidth } from './card-metrics';

const s = (over: Partial<LayoutSettings> = {}): LayoutSettings => ({ ...DEFAULT_SETTINGS, ...over });

describe('effectiveCardStyle', () => {
  it('falls back to classic in name-only mode (matrix rule)', () => {
    expect(effectiveCardStyle(s({ cardStyle: 'circle', contentMode: 'name' }))).toBe('classic');
    expect(effectiveCardStyle(s({ cardStyle: 'archCard', contentMode: 'name' }))).toBe('classic');
  });
  it('keeps the chosen style otherwise', () => {
    expect(effectiveCardStyle(s({ cardStyle: 'circle', contentMode: 'full' }))).toBe('circle');
    expect(effectiveCardStyle(s({ cardStyle: 'photoLeft', contentMode: 'avatar' }))).toBe('photoLeft');
  });
});

describe('cardMetrics', () => {
  it('default settings produce the arch-full card (132x180)', () => {
    expect(cardMetrics(DEFAULT_SETTINGS)).toEqual({ cardW: 132, cardH: 180 });
  });

  it('padding grows the classic card symmetrically', () => {
    const base = cardMetrics(s({ cardStyle: 'classic', cardPadding: 14 }));
    const bigger = cardMetrics(s({ cardStyle: 'classic', cardPadding: 20 }));
    expect(bigger.cardW).toBe(base.cardW + 12);
    expect(bigger.cardH).toBe(base.cardH + 12);
  });

  it("circle avatar-only is a compact square slot", () => {
    const m = cardMetrics(s({ cardStyle: 'circle', contentMode: 'avatar' }));
    expect(m.cardW).toBe(m.cardH);
    expect(m.cardW).toBeLessThan(132);
  });

  it('photoLeft full is wide and short', () => {
    const m = cardMetrics(s({ cardStyle: 'photoLeft', contentMode: 'full' }));
    expect(m.cardW).toBeGreaterThan(m.cardH * 2);
  });

  it('archCard full is taller than wide', () => {
    const m = cardMetrics(s({ cardStyle: 'archCard', contentMode: 'full' }));
    expect(m.cardH).toBeGreaterThan(m.cardW);
  });

  it('44px floor holds for EVERY style×mode at minimum padding', () => {
    const styles = ['classic', 'circle', 'photoLeft', 'archCard'] as const;
    const modes = ['full', 'name', 'avatar'] as const;
    for (const cardStyle of styles) {
      for (const contentMode of modes) {
        const m = cardMetrics(s({ cardStyle, contentMode, cardPadding: SPACING_BOUNDS.cardPadding.min }));
        expect(m.cardW, `${cardStyle}/${contentMode} width`).toBeGreaterThanOrEqual(MIN_CARD_SIZE);
        expect(m.cardH, `${cardStyle}/${contentMode} height`).toBeGreaterThanOrEqual(MIN_CARD_SIZE);
      }
    }
  });
});

describe('layoutMetrics', () => {
  it('carries gaps, margin and connector style from settings', () => {
    const m = layoutMetrics(s({ coupleGap: 50, siblingGap: 60, genGap: 70, connectorStyle: 'curved' }));
    expect(m).toMatchObject({ coupleGap: 50, siblingGap: 60, genGap: 70, margin: 40, connectorStyle: 'curved' });
  });
  it('DEFAULT_METRICS equals layoutMetrics(DEFAULT_SETTINGS)', () => {
    expect(DEFAULT_METRICS).toEqual(layoutMetrics(DEFAULT_SETTINGS));
    expect(DEFAULT_METRICS).toMatchObject({ cardW: 132, cardH: 180, coupleGap: 28, siblingGap: 36, genGap: 90, margin: 40 });
  });
});

describe('nameTextWidth', () => {
  it('mirrors the CSS text box per style', () => {
    expect(nameTextWidth(s({ cardStyle: 'classic' }))).toBe(104);            // cardW − 2·padding
    expect(nameTextWidth(s({ cardStyle: 'archCard', cardPadding: 14 }))).toBe(112);  // cardW − 2·10px name padding
    expect(nameTextWidth(s({ cardStyle: 'circle', cardPadding: 14 }))).toBe(132);    // label floats full card width
    expect(nameTextWidth(s({ cardStyle: 'photoLeft' }))).toBe(118);          // 176 − photo 48 − gap 10
    expect(nameTextWidth(s({ cardStyle: 'circle', contentMode: 'name' }))).toBe(104); // name mode renders classic
  });
});

describe('cardMetrics with maxNameLines', () => {
  it('each style grows by NAME_H per extra line', () => {
    expect(cardMetrics(s({ cardStyle: 'archCard' }), 2).cardH).toBe(200);              // 180 + 20
    expect(cardMetrics(s({ cardStyle: 'classic' }), 2).cardH).toBe(170);               // 150 + 20
    expect(cardMetrics(s({ cardStyle: 'circle', contentMode: 'full' }), 2).cardH).toBe(126); // 72 + 14 + 40
  });
  it('photoLeft grows only once the name block outgrows the photo', () => {
    expect(cardMetrics(s({ cardStyle: 'photoLeft', contentMode: 'full' }), 2).cardH).toBe(76); // max(48, 40) + 28
    expect(cardMetrics(s({ cardStyle: 'photoLeft', contentMode: 'full' }), 3).cardH).toBe(88); // max(48, 60) + 28
  });
  it('avatar-only mode ignores name lines (no name is shown)', () => {
    expect(cardMetrics(s({ contentMode: 'avatar' }), 3)).toEqual(cardMetrics(s({ contentMode: 'avatar' }), 1));
  });
  it('width never changes with line count', () => {
    expect(cardMetrics(s(), 3).cardW).toBe(cardMetrics(s(), 1).cardW);
  });
});
