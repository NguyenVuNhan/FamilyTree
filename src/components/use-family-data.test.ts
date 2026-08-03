// src/components/use-family-data.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Issue } from '../data/types';
import { useFamilyData } from './use-family-data';

const CSV = 'Đời 1,Image\nAnn + Bob,';
const URL_A = 'https://sheets.example/a.csv';

const mockFetch = (routes: Record<string, { ok: boolean; body?: string }>) => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const r = routes[url];
    if (!r) throw new TypeError('network error');
    return { ok: r.ok, text: async () => r.body ?? '' } as Response;
  }));
};
afterEach(() => vi.unstubAllGlobals());

describe('useFamilyData', () => {
  it('CSV → ready', async () => {
    mockFetch({ [URL_A]: { ok: true, body: CSV } });
    const { result } = renderHook(() => useFamilyData(URL_A));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('structural errors → invalid with issues', async () => {
    mockFetch({ [URL_A]: { ok: true, body: 'Đời 1,Đời 2,Image\n,Orphan Kid,' } });
    const { result } = renderHook(() => useFamilyData(URL_A));
    await waitFor(() => expect(result.current.status).toBe('invalid'));
  });

  it('header-only CSV → empty', async () => {
    mockFetch({ [URL_A]: { ok: true, body: 'Đời 1,Đời 2,Image' } });
    const { result } = renderHook(() => useFamilyData(URL_A));
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('network failure → failed/load-failed (no demo fallback)', async () => {
    mockFetch({});
    const { result } = renderHook(() => useFamilyData(URL_A));
    await waitFor(() => expect(result.current).toEqual({ status: 'failed', reason: 'load-failed' }));
    expect(fetch).toHaveBeenCalledTimes(1); // never tries a second URL
  });

  it('HTTP error status → failed/load-failed', async () => {
    mockFetch({ [URL_A]: { ok: false } });
    const { result } = renderHook(() => useFamilyData(URL_A));
    await waitFor(() => expect(result.current).toEqual({ status: 'failed', reason: 'load-failed' }));
  });

  it('HTML response → failed/unreadable', async () => {
    mockFetch({ [URL_A]: { ok: true, body: '<!doctype html><html>err</html>' } });
    const { result } = renderHook(() => useFamilyData(URL_A));
    await waitFor(() => expect(result.current).toEqual({ status: 'failed', reason: 'unreadable' }));
  });

  it('stays loading until the fetch resolves (no flash of any other state)', async () => {
    let release!: (v: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { release = r; })));
    const { result } = renderHook(() => useFamilyData(URL_A));
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.status).toBe('loading');
    release({ ok: true, text: async () => CSV } as Response);
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('excluded-component warning lists display names, never synthetic ids', async () => {
    mockFetch({ [URL_A]: { ok: true, body: 'Đời 1,Đời 2,Image\nAnn + Bob,,\n,Kid One,\nLoner Sue,,' } });
    const { result } = renderHook(() => useFamilyData(URL_A));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const { warnings } = result.current as { warnings: Issue[] };
    expect(warnings.some((w) => w.message.includes('Loner Sue'))).toBe(true);
    expect(warnings.some((w) => /\br\d+p?\b/.test(w.message))).toBe(false);
  });
});
