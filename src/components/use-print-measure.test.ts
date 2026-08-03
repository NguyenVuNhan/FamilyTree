import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ThemeId } from '../print/themes';
import { usePrintMeasure } from './use-print-measure';

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
