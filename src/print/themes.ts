export type ThemeId = 'indochine' | 'nordic' | 'inkwash' | 'botanical';

export interface ThemeTokens {
  id: ThemeId;
  label: string;
  background: string;
  text: string;
  connector: string;
  accent: string;
  nodeFill: string;
  nodeBorder: string;
  titleFamily: string;
  nameFamily: string;
  /** @fontsource css ids imported by main.tsx (latin + vietnamese, weights used). */
  fontCssImports: string[];
  /** woff2 files embedded into exports (latin + vietnamese per family/weight). */
  fontFiles: { family: string; weight: number; url: string }[];
}

// Vite turns `?url` imports into hashed asset URLs; fetched + base64'd at export time.
import pfdLatin from '@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2?url';
import pfdViet from '@fontsource/playfair-display/files/playfair-display-vietnamese-600-normal.woff2?url';
import bvpLatin from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-500-normal.woff2?url';
import bvpViet from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-500-normal.woff2?url';
import sgLatin from '@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2?url';
import sgViet from '@fontsource/space-grotesk/files/space-grotesk-vietnamese-600-normal.woff2?url';
import interLatin from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
import interViet from '@fontsource/inter/files/inter-vietnamese-500-normal.woff2?url';
import charmLatin from '@fontsource/charm/files/charm-latin-700-normal.woff2?url';
import charmViet from '@fontsource/charm/files/charm-vietnamese-700-normal.woff2?url';
import cgLatin from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2?url';
import cgViet from '@fontsource/cormorant-garamond/files/cormorant-garamond-vietnamese-600-normal.woff2?url';
import ss3Latin from '@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff2?url';
import ss3Viet from '@fontsource/source-sans-3/files/source-sans-3-vietnamese-600-normal.woff2?url';

const files = (family: string, weight: number, ...urls: string[]) =>
  urls.map((url) => ({ family, weight, url }));

export const THEMES: Record<ThemeId, ThemeTokens> = {
  indochine: {
    id: 'indochine', label: 'Indochine Vintage',
    background: '#F5EBDC', text: '#3B2F2A', connector: '#B9A48C', accent: '#9E2B25',
    nodeFill: '#F5EBDC', nodeBorder: '#9E2B25',
    titleFamily: '"Playfair Display", serif', nameFamily: '"Be Vietnam Pro", sans-serif',
    fontCssImports: ['@fontsource/playfair-display/600.css', '@fontsource/playfair-display/vietnamese-600.css',
      '@fontsource/be-vietnam-pro/500.css', '@fontsource/be-vietnam-pro/vietnamese-500.css'],
    fontFiles: [...files('Playfair Display', 600, pfdLatin, pfdViet), ...files('Be Vietnam Pro', 500, bvpLatin, bvpViet)],
  },
  nordic: {
    id: 'nordic', label: 'Nordic Minimalist',
    background: '#FAFAF7', text: '#2E2E2E', connector: '#C9CFD3', accent: '#6B8E9F',
    nodeFill: '#FAFAF7', nodeBorder: '#6B8E9F',
    titleFamily: '"Space Grotesk", sans-serif', nameFamily: '"Inter", sans-serif',
    fontCssImports: ['@fontsource/space-grotesk/600.css', '@fontsource/space-grotesk/vietnamese-600.css',
      '@fontsource/inter/500.css', '@fontsource/inter/vietnamese-500.css'],
    fontFiles: [...files('Space Grotesk', 600, sgLatin, sgViet), ...files('Inter', 500, interLatin, interViet)],
  },
  inkwash: {
    id: 'inkwash', label: 'Traditional Ink Wash',
    background: '#FBFAF7', text: '#1C1C1C', connector: '#969696', accent: '#B03A2E',
    nodeFill: '#FBFAF7', nodeBorder: '#1C1C1C',
    titleFamily: '"Charm", cursive', nameFamily: '"Be Vietnam Pro", sans-serif',
    fontCssImports: ['@fontsource/charm/700.css', '@fontsource/charm/vietnamese-700.css',
      '@fontsource/be-vietnam-pro/500.css', '@fontsource/be-vietnam-pro/vietnamese-500.css'],
    fontFiles: [...files('Charm', 700, charmLatin, charmViet), ...files('Be Vietnam Pro', 500, bvpLatin, bvpViet)],
  },
  botanical: {
    id: 'botanical', label: 'Royal Botanical',
    background: '#F7F3E8', text: '#2F5233', connector: '#A9B49B', accent: '#B8933D',
    nodeFill: '#F7F3E8', nodeBorder: '#B8933D',
    titleFamily: '"Cormorant Garamond", serif', nameFamily: '"Source Sans 3", sans-serif',
    fontCssImports: ['@fontsource/cormorant-garamond/600.css', '@fontsource/cormorant-garamond/vietnamese-600.css',
      '@fontsource/source-sans-3/600.css', '@fontsource/source-sans-3/vietnamese-600.css'],
    fontFiles: [...files('Cormorant Garamond', 600, cgLatin, cgViet), ...files('Source Sans 3', 600, ss3Latin, ss3Viet)],
  },
};

const primaryFamily = (cssFontFamily: string): string =>
  cssFontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');

/** The weight embedded in `fontFiles`/imported via `fontCssImports` for a given
 *  `titleFamily`/`nameFamily` token — kept out of themeCss's hardcoded literals so a
 *  theme can't drift: whatever weight is actually embedded is what gets requested. */
function weightFor(t: ThemeTokens, cssFontFamily: string): number {
  const name = primaryFamily(cssFontFamily);
  const match = t.fontFiles.find((f) => f.family === name);
  if (!match) throw new Error(`themeCss: theme "${t.id}" has no fontFiles entry for family "${name}"`);
  return match.weight;
}

/** Public form of `weightFor` for the title/name faces: the single source of truth for
 *  "what weight does this theme actually render/export text at" — themeCss (render/export
 *  CSS) and usePrintMeasure (canvas text measurement used for layout/wrap decisions) must
 *  both read from here, or measured widths silently stop matching what gets drawn. */
export function themeWeights(t: ThemeTokens): { title: number; name: number } {
  return { title: weightFor(t, t.titleFamily), name: weightFor(t, t.nameFamily) };
}

/** Style body shared by the on-canvas SVG and (via clone) the export. Units are
 *  SVG user units ≡ mm. Connector stroke 0.35 mm ≈ 1 pt — comfortably above the
 *  0.18 mm (0.5 pt) physical floor (risk R5).
 *
 *  Explicit font-weight matters beyond screen rendering: exported/printed text is
 *  measured (legibility floor, collision checks) and pre-press tools embed/subset by
 *  exact weight — an implicit 400 request against faces embedded at 500-700 risks
 *  synthetic/faux-bold substitution that silently invalidates those measurements. */
export function themeCss(t: ThemeTokens): string {
  const { title: titleWeight, name: nameWeight } = themeWeights(t);
  return [
    `.pt-bg{fill:${t.background};}`,
    `.pt-title{font-family:${t.titleFamily};font-weight:${titleWeight};fill:${t.accent};}`,
    `.pn-capsule{fill:${t.nodeFill};stroke:${t.nodeBorder};}`,
    `.pn-name{font-family:${t.nameFamily};font-weight:${nameWeight};fill:${t.text};}`,
    `.pn-name-title{font-family:${t.titleFamily};font-weight:${titleWeight};fill:${t.text};}`, // F0/F1 names use the title face (spec: serif for title + F0/F1)
    `.pn-years{font-family:${t.nameFamily};font-weight:${nameWeight};fill:${t.text};opacity:0.75;}`,
    `.connector{stroke:${t.connector};fill:none;stroke-width:0.35;}`,
    `.pp-frame{stroke:${t.accent};fill:none;}`,
    `.pt-subtitle{font-family:${t.nameFamily};font-weight:${nameWeight};fill:${t.accent};opacity:0.8;}`,
    `.pm-chip{fill:${t.nodeFill};stroke:${t.accent};stroke-width:0.5;}`,
    `.pm-label{font-family:${t.titleFamily};font-weight:${titleWeight};fill:${t.accent};}`,
    `.pt-guide{stroke:${t.accent};fill:none;stroke-dasharray:4 3;opacity:0.5;}`,
  ].join('\n');
}

const channel = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export function relLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => channel(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
