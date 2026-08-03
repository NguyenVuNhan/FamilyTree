export type FormatId = 'a4' | 'a3' | 'a1' | 'a0' | 'pano' | 'square' | 'custom';

export const FORMAT_PRESETS: Record<Exclude<FormatId, 'custom'>, { wMm: number; hMm: number; label: string }> = {
  a4: { wMm: 297, hMm: 210, label: 'A4 landscape' },
  a3: { wMm: 420, hMm: 297, label: 'A3 landscape' },
  a1: { wMm: 841, hMm: 594, label: 'A1 landscape' },
  a0: { wMm: 1189, hMm: 841, label: 'A0 landscape' },
  pano: { wMm: 1200, hMm: 600, label: 'Panorama 120×60 cm' },
  square: { wMm: 900, hMm: 900, label: 'Square 90×90 cm' },
};

export const PRINT_BOUNDS = {
  marginMm: { min: 50, max: 70 },
  customMm: { min: 300, maxW: 2000, maxH: 1200 },
} as const;

export function formatSizeMm(s: { format: FormatId; customWmm: number; customHmm: number }): { wMm: number; hMm: number } {
  if (s.format === 'custom') return { wMm: s.customWmm, hMm: s.customHmm };
  const p = FORMAT_PRESETS[s.format];
  return { wMm: p.wMm, hMm: p.hMm };
}

/** "1200x600" (mm) → size, or null when malformed / out of PRINT_BOUNDS.customMm. */
export function parseCustomFmt(v: string): { wMm: number; hMm: number } | null {
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(v);
  if (!m) return null;
  const wMm = Number(m[1]);
  const hMm = Number(m[2]);
  const b = PRINT_BOUNDS.customMm;
  if (wMm < b.min || hMm < b.min || wMm > b.maxW || hMm > b.maxH) return null;
  return { wMm, hMm };
}
