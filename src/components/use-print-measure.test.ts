import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as nameMetrics from '../layout/name-metrics';
import { THEMES, themeCss, type ThemeId } from '../print/themes';
import { usePrintMeasure } from './use-print-measure';

// Wrapped (not replaced) so canvasMeasurer's real behavior is unchanged — this only lets
// the drift-guard test below inspect the exact font string usePrintMeasure builds.
vi.mock('../layout/name-metrics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../layout/name-metrics')>();
  return { ...actual, canvasMeasurer: vi.fn(actual.canvasMeasurer) };
});

const realFonts = document.fonts;
afterEach(() => {
  Object.defineProperty(document, 'fonts', { value: realFonts, configurable: true });
});

function stubFonts(value: unknown) {
  Object.defineProperty(document, 'fonts', { value, configurable: true });
}

describe('usePrintMeasure', () => {
  it('re-measures once the theme faces explicitly load (Finding 2: not just document.fonts.ready)', async () => {
    let resolveLoad: () => void = () => {};
    const loaded = new Promise<[]>((res) => { resolveLoad = () => res([]); });
    const load = vi.fn(() => loaded);
    stubFonts({ load, ready: Promise.resolve() });

    const { result } = renderHook(() => usePrintMeasure('indochine'));
    const before = result.current;
    // both the title face (Playfair Display, indochine's titleFamily) and the name
    // face (Be Vietnam Pro) must be requested — not just awaited via .ready.
    expect(load).toHaveBeenCalledWith(expect.stringContaining('Playfair Display'));
    expect(load).toHaveBeenCalledWith(expect.stringContaining('Be Vietnam Pro'));

    resolveLoad();
    await waitFor(() => expect(result.current).not.toBe(before)); // measurer recomputed
  });

  it('still re-measures when a font fails to load (best-effort, no stuck fallback)', async () => {
    let rejectLoad: (e: Error) => void = () => {};
    const failed = new Promise<[]>((_res, rej) => { rejectLoad = rej; });
    stubFonts({ load: vi.fn(() => failed), ready: Promise.resolve() });

    const { result } = renderHook(() => usePrintMeasure('nordic'));
    const before = result.current;
    rejectLoad(new Error('font 404'));
    await waitFor(() => expect(result.current).not.toBe(before));
  });

  it('falls back to document.fonts.ready when load() is unavailable', async () => {
    let resolveReady: () => void = () => {};
    const ready = new Promise<void>((res) => { resolveReady = res; });
    stubFonts({ ready });

    const { result } = renderHook(() => usePrintMeasure('botanical'));
    const before = result.current;
    resolveReady();
    await waitFor(() => expect(result.current).not.toBe(before));
  });

  it('re-arms when the theme changes', async () => {
    let resolveA: () => void = () => {};
    const loadCalls: string[] = [];
    stubFonts({
      load: vi.fn((font: string) => {
        loadCalls.push(font);
        return new Promise<[]>((res) => { resolveA = () => res([]); });
      }),
      ready: Promise.resolve(),
    });

    const { rerender } = renderHook(({ theme }: { theme: ThemeId }) => usePrintMeasure(theme), {
      initialProps: { theme: 'indochine' },
    });
    resolveA();
    await waitFor(() => expect(loadCalls.some((f) => f.includes('Playfair Display'))).toBe(true));

    rerender({ theme: 'nordic' });
    await waitFor(() => expect(loadCalls.some((f) => f.includes('Space Grotesk'))).toBe(true));
  });
});

// Closes the re-review gap: usePrintMeasure previously hardcoded "600 …" / "500 …"
// regardless of theme, so inkwash (title Charm 700) and botanical (name Source Sans 3
// 600) were measured at the wrong weight — different from what themeCss actually draws.
// This cross-checks, per theme, that both the fonts.load() warm-up and the canvas
// measurer's font string request the exact weight themeCss emits for the corresponding
// class, so measured widths can never silently drift from rendered/exported ones again.
describe('measure/render weight parity (Finding 2 closure)', () => {
  const weightFromCss = (css: string, selector: string): number => {
    const m = new RegExp(`\\.${selector}\\{[^}]*font-weight:(\\d+);`).exec(css);
    if (!m) throw new Error(`no font-weight found for .${selector} in: ${css}`);
    return Number(m[1]);
  };

  it.each(Object.values(THEMES).map((t) => [t.id, t] as const))(
    '%s: fonts.load() and the canvas measurer request themeCss\'s exact title/name weights',
    async (_, theme) => {
      vi.mocked(nameMetrics.canvasMeasurer).mockClear();
      const loadCalls: string[] = [];
      stubFonts({
        load: vi.fn((font: string) => { loadCalls.push(font); return Promise.resolve([]); }),
        ready: Promise.resolve(),
      });

      const css = themeCss(theme);
      const titleWeight = weightFromCss(css, 'pt-title');
      const nameWeight = weightFromCss(css, 'pn-name');
      expect(weightFromCss(css, 'pn-name-title')).toBe(titleWeight);
      expect(weightFromCss(css, 'pn-years')).toBe(nameWeight);

      const { result } = renderHook(() => usePrintMeasure(theme.id));
      await waitFor(() => expect(loadCalls.length).toBeGreaterThanOrEqual(2));
      expect(loadCalls.some((f) => f.startsWith(`${titleWeight} `))).toBe(true);
      expect(loadCalls.some((f) => f.startsWith(`${nameWeight} `))).toBe(true);

      result.current('Ancestor Name', 6, true);
      result.current('Descendant Name', 4, false);
      const measuredFonts = vi.mocked(nameMetrics.canvasMeasurer).mock.calls.map(([font]) => font);
      expect(measuredFonts.some((f) => f.startsWith(`${titleWeight} `))).toBe(true);
      expect(measuredFonts.some((f) => f.startsWith(`${nameWeight} `))).toBe(true);
    },
  );
});
