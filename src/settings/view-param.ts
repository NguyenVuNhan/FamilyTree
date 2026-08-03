import { parseCustomFmt } from '../print/formats';
import { DEFAULT_SETTINGS, sanitizeSettings, type LayoutSettings } from './settings';

/** URL key ↔ settings field, in canonical encode order. `arch` is the URL alias for archCard. */
const FIELDS = [
  ['style', 'cardStyle'],
  ['show', 'contentMode'],
  ['name', 'namePosition'],
  ['pad', 'cardPadding'],
  ['couple', 'coupleGap'],
  ['sib', 'siblingGap'],
  ['gen', 'genGap'],
  ['conn', 'connectorStyle'],
  ['ph', 'placeholderStyle'],
  ['arr', 'arrangement'],
  ['theme', 'theme'],
  ['mgn', 'marginMm'],
] as const;

const toUrl = (v: string | number) => (v === 'archCard' ? 'arch' : String(v));
const fromUrl = (v: string) => (v === 'arch' ? 'archCard' : v);

/** Compact `view` value listing only non-default fields; null when all-default. */
export function encodeView(s: LayoutSettings): string | null {
  const pairs = FIELDS.filter(([, field]) => s[field] !== DEFAULT_SETTINGS[field])
    .map(([key, field]) => `${key}:${toUrl(s[field])}`);
  if (s.format !== DEFAULT_SETTINGS.format) {
    pairs.push(`fmt:${s.format === 'custom' ? `${s.customWmm}x${s.customHmm}` : s.format}`);
  }
  if (s.frameGuide) pairs.push('guide:1');
  return pairs.length > 0 ? pairs.join(',') : null;
}

/** Total: unknown keys and invalid values fall back per-field to the defaults. */
export function decodeView(raw: string): LayoutSettings {
  const partial: Record<string, unknown> = {};
  for (const part of raw.split(',')) {
    const i = part.indexOf(':');
    if (i <= 0) continue;
    const key = part.slice(0, i);
    const value = part.slice(i + 1);
    if (key === 'fmt') {
      const custom = parseCustomFmt(value);
      if (custom) {
        partial.format = 'custom';
        partial.customWmm = custom.wMm;
        partial.customHmm = custom.hMm;
      } else {
        partial.format = value; // preset id or junk — sanitize decides
      }
      continue;
    }
    if (key === 'guide') {
      partial.frameGuide = value === '1';
      continue;
    }
    const field = FIELDS.find(([k]) => k === key)?.[1];
    if (!field) continue;
    const v = fromUrl(value);
    partial[field] = /^\d+$/.test(v) ? Number(v) : v;
  }
  return sanitizeSettings({ ...DEFAULT_SETTINGS, ...partial });
}
