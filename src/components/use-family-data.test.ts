import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Issue } from '../data/types';
import { useFamilyData } from './use-family-data';

const CSV = 'Đời 1,Image\nAnn + Bob,';
const DEMO_CSV = 'Đời 1,Image\nDemo Person,';
const live = { key: 'alpha', displayName: 'Alpha', csvUrl: 'https://sheets.example/a.csv' };
const demo = { key: 'demo', displayName: 'Demo Family', csvUrl: '/sample-data.csv' };

const mockFetch = (routes: Record<string, { ok: boolean; body?: string }>) => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const r = routes[url];
    if (!r) throw new TypeError('network error');
    return { ok: r.ok, text: async () => r.body ?? '' } as Response;
  }));
};
afterEach(() => vi.unstubAllGlobals());

describe('useFamilyData', () => {
  it('live CSV → ready/live', async () => {
    mockFetch({ [live.csvUrl]: { ok: true, body: CSV } });
    const { result } = renderHook(() => useFamilyData(live, false));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ source: 'live' });
  });

  it('structural errors → invalid with issues', async () => {
    mockFetch({ [live.csvUrl]: { ok: true, body: 'Đời 1,Đời 2,Image\n,Orphan Kid,' } });
    const { result } = renderHook(() => useFamilyData(live, false));
    await waitFor(() => expect(result.current.status).toBe('invalid'));
  });

  it('header-only CSV → empty', async () => {
    mockFetch({ [live.csvUrl]: { ok: true, body: 'Đời 1,Đời 2,Image' } });
    const { result } = renderHook(() => useFamilyData(live, false));
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('network failure → fallback demo data with load-failed reason', async () => {
    mockFetch({ '/sample-data.csv': { ok: true, body: DEMO_CSV } });
    const { result } = renderHook(() => useFamilyData(live, false));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ source: 'fallback', fallbackReason: 'load-failed' });
  });

  it('HTML response → fallback with unreadable reason', async () => {
    mockFetch({
      [live.csvUrl]: { ok: true, body: '<!doctype html><html>err</html>' },
      '/sample-data.csv': { ok: true, body: DEMO_CSV },
    });
    const { result } = renderHook(() => useFamilyData(live, false));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ source: 'fallback', fallbackReason: 'unreadable' });
  });

  it('demo as the only family → fallback/no-config; explicit demo → live', async () => {
    mockFetch({ '/sample-data.csv': { ok: true, body: DEMO_CSV } });
    const a = renderHook(() => useFamilyData(demo, true));
    await waitFor(() => expect(a.result.current.status).toBe('ready'));
    expect(a.result.current).toMatchObject({ source: 'fallback', fallbackReason: 'no-config' });
    const b = renderHook(() => useFamilyData(demo, false));
    await waitFor(() => expect(b.result.current.status).toBe('ready'));
    expect(b.result.current).toMatchObject({ source: 'live' });
  });

  it('excluded-component warning lists display names, never synthetic ids', async () => {
    mockFetch({ [live.csvUrl]: { ok: true, body: 'Đời 1,Đời 2,Image\nAnn + Bob,,\n,Kid One,\nLoner Sue,,' } });
    const { result } = renderHook(() => useFamilyData(live, false));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const { warnings } = result.current as { warnings: Issue[] };
    expect(warnings.some((w) => w.message.includes('Loner Sue'))).toBe(true);
    expect(warnings.some((w) => /\br\d+p?\b/.test(w.message))).toBe(false);
  });
});
