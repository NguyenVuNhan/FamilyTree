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
] as const;

const toUrl = (v: string | number) => (v === 'archCard' ? 'arch' : String(v));
const fromUrl = (v: string) => (v === 'arch' ? 'archCard' : v);

/** Compact `view` value listing only non-default fields; null when all-default. */
export function encodeView(s: LayoutSettings): string | null {
  const pairs = FIELDS.filter(([, field]) => s[field] !== DEFAULT_SETTINGS[field])
    .map(([key, field]) => `${key}:${toUrl(s[field])}`);
  return pairs.length > 0 ? pairs.join(',') : null;
}

/** Total: unknown keys and invalid values fall back per-field to the defaults. */
export function decodeView(raw: string): LayoutSettings {
  const partial: Record<string, unknown> = {};
  for (const part of raw.split(',')) {
    const i = part.indexOf(':');
    if (i <= 0) continue;
    const field = FIELDS.find(([key]) => key === part.slice(0, i))?.[1];
    if (!field) continue;
    const value = fromUrl(part.slice(i + 1));
    partial[field] = /^\d+$/.test(value) ? Number(value) : value;
  }
  return sanitizeSettings({ ...DEFAULT_SETTINGS, ...partial });
}
