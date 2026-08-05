import { describe, expect, it } from 'vitest';
import { differenceCiede2000, converter, formatHex } from 'culori';
import { THEMES, contrastRatio, themeCss } from './themes';

const themes = Object.values(THEMES);

describe('theme token contrast (spec §Shared visual rules)', () => {
  it.each(themes.map((t) => [t.id, t]))('%s: text ≥ 4.5:1 vs background', (_, t) => {
    expect(contrastRatio(t.text, t.background)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(themes.map((t) => [t.id, t]))('%s: connector inside the 1.5–3.0:1 band', (_, t) => {
    const r = contrastRatio(t.connector, t.background);
    expect(r).toBeGreaterThanOrEqual(1.5);
    expect(r).toBeLessThanOrEqual(3.0);
  });
});

describe('CMYK gamut proxy (risk R4 — warning-level, committed allowlist)', () => {
  // naive sRGB→CMYK→sRGB round trip; ΔE2000 > 5 flags gamut risk.
  const rgb = converter('rgb');
  const roundTrip = (hex: string): string => {
    const { r, g, b } = rgb(hex)!;
    const k = 1 - Math.max(r, g, b);
    const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
    const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
    const y = k === 1 ? 0 : (1 - b - k) / (1 - k);
    return formatHex({ mode: 'rgb', r: (1 - c) * (1 - k), g: (1 - m) * (1 - k), b: (1 - y) * (1 - k) });
  };
  const ALLOWLIST: string[] = []; // add "themeId:token" here only with a written justification
  it('every large-fill token survives the round trip (ΔE2000 ≤ 5)', () => {
    const dE = differenceCiede2000();
    for (const t of themes) {
      for (const [token, hex] of Object.entries({ background: t.background, accent: t.accent })) {
        if (ALLOWLIST.includes(`${t.id}:${token}`)) continue;
        expect(dE(hex, roundTrip(hex)), `${t.id} ${token} ${hex}`).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('themeCss', () => {
  it('emits the token values into the scene classes', () => {
    const css = themeCss(THEMES.indochine);
    expect(css).toContain('.pn-name');
    expect(css).toContain('#3B2F2A');
    expect(css).toContain('.connector');
    expect(css).toContain('#B9A48C');
  });

  // Rendered/exported text must request the exact weight embedded in fontFiles — an
  // implicit 400 against faces at 500-700 risks pre-press faux-bold substitution that
  // silently invalidates legibility/collision measurements (see themeCss's doc comment).
  it.each(themes.map((t) => [t.id, t]))('%s: title and name classes request the embedded weights', (_, t) => {
    const css = themeCss(t);
    const titleWeight = t.fontFiles.find((f) => t.titleFamily.includes(f.family))!.weight;
    const nameWeight = t.fontFiles.find((f) => t.nameFamily.includes(f.family))!.weight;
    expect(css).toMatch(new RegExp(`\\.pt-title\\{[^}]*font-weight:${titleWeight};`));
    expect(css).toMatch(new RegExp(`\\.pn-name-title\\{[^}]*font-weight:${titleWeight};`));
    expect(css).toMatch(new RegExp(`\\.pn-name\\{[^}]*font-weight:${nameWeight};`));
    expect(css).toMatch(new RegExp(`\\.pn-years\\{[^}]*font-weight:${nameWeight};`));
  });
});

describe('panel + marker theme classes (PR ③)', () => {
  it('themeCss emits frame, subtitle and chip classes wired to the theme tokens', () => {
    for (const t of Object.values(THEMES)) {
      const css = themeCss(t);
      expect(css).toContain(`.pp-frame{stroke:${t.accent};fill:none;}`);
      expect(css).toContain(`.pm-chip{fill:${t.nodeFill};stroke:${t.accent};stroke-width:0.5;}`);
      expect(css).toContain(`.pm-label{font-family:${t.titleFamily};`);
      expect(css).toContain(`.pt-subtitle{font-family:${t.nameFamily};`);
    }
  });
  it('chip label (accent on nodeFill) keeps ≥ 2:1 contrast — wayfinding furniture, names stay in text color', () => {
    for (const t of Object.values(THEMES)) {
      expect(contrastRatio(t.accent, t.nodeFill), t.id).toBeGreaterThanOrEqual(2);
    }
  });
});
