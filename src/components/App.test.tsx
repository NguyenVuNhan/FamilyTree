// src/components/App.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { REGISTRY_STORAGE_KEY } from '../config/registry';
import { collectFontCss } from '../print/export';

// Only collectFontCss is overridden (wrapped in a spy that still calls through by
// default) — this lets one test (Finding 3: export failure path) force a rejection
// via mockRejectedValueOnce without touching buildExportSvg/downloadSvg/exportFilename.
vi.mock('../print/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../print/export')>();
  return { ...actual, collectFontCss: vi.fn(actual.collectFontCss) };
});

const DEMO_CSV = 'Đời 1,Đời 2,Image\nMa Ellis + Pa Ellis,,\n,Kid Ellis,';
const SRC_URL = 'https://sheets.example/a.csv';
const SRC_SEARCH = `?${new URLSearchParams({ src: SRC_URL, name: 'Alpha Family' })}`;

const LAYOUT_KEY = `ft:layout:src:${SRC_URL}`;

const okFetch = () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => DEMO_CSV }) as Response));
const setUrl = (search: string) => window.history.replaceState({}, '', `/${search}`);
afterEach(() => { vi.unstubAllGlobals(); setUrl(''); localStorage.clear(); });

describe('App', () => {
  it('no params → load dialog, no fetch, no tree', () => {
    okFetch();
    render(<App />);
    expect(screen.getByTestId('load-dialog')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector('.person-card')).toBeNull();
  });

  it('?family=demo renders the tree with title and demo banner; dismissible', async () => {
    setUrl('?family=demo');
    okFetch();
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Demo Family' })).toBeInTheDocument());
    expect(document.title).toBe('Demo Family — Family Tree');
    expect(screen.getByTestId('sample-banner')).toHaveTextContent(/sample data/i);
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByTestId('sample-banner')).not.toBeInTheDocument();
  });

  it('demo is never saved to the registry', async () => {
    setUrl('?family=demo');
    okFetch();
    render(<App />);
    await waitFor(() => screen.getByRole('heading', { name: 'Demo Family' }));
    expect(localStorage.getItem(REGISTRY_STORAGE_KEY)).toBeNull();
  });

  it('?src= renders with the given name, no banner, share button, and saves to the registry', async () => {
    setUrl(SRC_SEARCH);
    okFetch();
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Alpha Family' })).toBeInTheDocument());
    expect(document.title).toBe('Alpha Family — Family Tree');
    expect(screen.queryByTestId('sample-banner')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy share link' })).toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(REGISTRY_STORAGE_KEY)!) as Array<{ key: string; name: string; search: string }>;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        key: `?${new URLSearchParams({ src: SRC_URL })}`,
        name: 'Alpha Family',
        search: SRC_SEARCH,
      });
    });
  });

  it('re-opening a saved source with no ?name= keeps the existing name/search, only refreshing savedAt', async () => {
    const key = `?${new URLSearchParams({ src: SRC_URL })}`;
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify([
      { key, name: 'Alpha Family', search: SRC_SEARCH, savedAt: 1000 },
    ]));
    setUrl(`?${new URLSearchParams({ src: SRC_URL })}`); // no &name=
    okFetch();
    render(<App />);
    // The page itself shows the fallback title (no ?name= was given) — only the
    // registry entry is expected to retain the previously-saved name.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Family Tree' })).toBeInTheDocument());
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(REGISTRY_STORAGE_KEY)!) as Array<{ key: string; name: string; search: string; savedAt: number }>;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ key, name: 'Alpha Family', search: SRC_SEARCH });
      expect(saved[0].savedAt).toBeGreaterThan(1000);
    });
  });

  it('re-opening a saved source WITH ?name= renames the entry', async () => {
    const key = `?${new URLSearchParams({ src: SRC_URL })}`;
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify([
      { key, name: 'Alpha Family', search: SRC_SEARCH, savedAt: 1000 },
    ]));
    const newSearch = `?${new URLSearchParams({ src: SRC_URL, name: 'New Name' })}`;
    setUrl(newSearch);
    okFetch();
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New Name' })).toBeInTheDocument());
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(REGISTRY_STORAGE_KEY)!) as Array<{ key: string; name: string; search: string }>;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ key, name: 'New Name', search: newSearch });
    });
  });

  it('unknown ?family → link-error panel with demo link, nothing saved', () => {
    setUrl('?family=nope');
    okFetch();
    render(<App />);
    expect(screen.getByTestId('error-panel')).toHaveTextContent(/no family tree at this address/i);
    expect(screen.getByRole('link', { name: /demo family/i })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('non-https src → link-error panel, no fetch', () => {
    setUrl(`?${new URLSearchParams({ src: 'http://evil.example/a.csv' })}`);
    okFetch();
    render(<App />);
    expect(screen.getByTestId('error-panel')).toHaveTextContent(/https:\/\/ address/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetch failure → could-not-load panel with demo link; nothing saved', async () => {
    setUrl(SRC_SEARCH);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    render(<App />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent(/couldn't be loaded/i);
    expect(screen.getByRole('link', { name: /demo family/i })).toBeInTheDocument();
    expect(localStorage.getItem(REGISTRY_STORAGE_KEY)).toBeNull();
  });

  it('shows the sheet-error panel for invalid data (default copy)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, text: async () => 'Đời 1,Đời 2,Image\n,Orphan Kid,',
    }) as Response));
    setUrl('?family=demo');
    render(<App />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent(/must start in/);
  });

  it('only one card expands at a time; Esc collapses', async () => {
    setUrl('?family=demo');
    okFetch();
    render(<App />);
    await waitFor(() => screen.getAllByRole('button', { name: /Ellis/ }));
    const cards = screen.getAllByRole('button', { name: /Ellis/ });
    await userEvent.click(cards[0]);
    await userEvent.click(cards[1]);
    expect(document.querySelectorAll('[data-expanded="true"]')).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    expect(document.querySelectorAll('[data-expanded="true"]')).toHaveLength(0);
  });

  it('reflects zoom-in/out from the viewport in the toolbar percentage (no stale %)', async () => {
    setUrl('?family=demo');
    okFetch();
    render(<App />);
    await waitFor(() => screen.getByTestId('zoom-pct'));
    const initialPct = screen.getByTestId('zoom-pct').textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByTestId('zoom-pct').textContent).not.toBe(initialPct);
  });

  it('gear opens the settings panel; changing card style re-renders and persists under the source key', async () => {
    setUrl('?family=demo');
    okFetch();
    render(<App />);
    await waitFor(() => screen.getAllByRole('button', { name: /Ellis/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Layout settings' }));
    await userEvent.click(within(screen.getByTestId('settings-panel')).getByRole('button', { name: 'Circle' }));
    expect(document.querySelector('.person-card.style-circle')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('ft:layout:demo')!)).toMatchObject({ cardStyle: 'circle' });
  });

  it('Escape closes the settings panel', async () => {
    setUrl('?family=demo');
    okFetch();
    render(<App />);
    await waitFor(() => screen.getAllByRole('button', { name: /Ellis/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Layout settings' }));
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
  });

  it('saved settings are loaded on mount', async () => {
    localStorage.setItem('ft:layout:demo', JSON.stringify({ contentMode: 'name' }));
    setUrl('?family=demo');
    okFetch();
    render(<App />);
    await waitFor(() => screen.getByText('Ma Ellis')); // name mode renders names
  });

  it('share link gains &view= only when settings differ from the defaults', async () => {
    setUrl(SRC_SEARCH);
    okFetch();
    render(<App />);
    await waitFor(() => screen.getByRole('heading', { name: 'Alpha Family' }));

    await userEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    const box = await screen.findByRole('textbox', { name: 'Share link' });
    expect(box).toHaveValue(`${window.location.origin}${window.location.pathname}${SRC_SEARCH}`); // no &view=

    await userEvent.click(screen.getByRole('button', { name: 'Layout settings' }));
    await userEvent.click(within(screen.getByTestId('settings-panel')).getByRole('button', { name: 'Circle' }));
    expect(screen.getByRole('textbox', { name: 'Share link' }))
      .toHaveValue(`${window.location.origin}${window.location.pathname}${SRC_SEARCH}&view=${encodeURIComponent('style:circle')}`);
  });

  it('a ?view= link wins over saved settings, persists, and strips the param', async () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ cardStyle: 'photoLeft' }));
    setUrl(`${SRC_SEARCH}&view=${encodeURIComponent('style:circle')}`);
    okFetch();
    render(<App />);
    await waitFor(() => screen.getByRole('heading', { name: 'Alpha Family' }));

    expect(document.querySelector('.person-card.style-circle')).not.toBeNull();
    expect(document.querySelector('.person-card.style-photoLeft')).toBeNull();
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!)).toMatchObject({ cardStyle: 'circle', contentMode: 'full' });
      expect(window.location.search).not.toContain('view=');
    });
    expect(window.location.search).toContain('src=');
  });

  it('a malformed view degrades silently to defaults — no error panel', async () => {
    setUrl(`${SRC_SEARCH}&view=${encodeURIComponent('style:bogus,,junk')}`);
    okFetch();
    render(<App />);
    await waitFor(() => screen.getByRole('heading', { name: 'Alpha Family' }));
    expect(document.querySelector('.person-card.style-archCard')).not.toBeNull();
  });
});

describe('flow arrangement (UC-77/82/89)', () => {
  const csvFetch = (csv: string) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => csv }) as Response));

  it('renders PrintTreeCanvas for ?view=arr:flow and sets body dataset', async () => {
    csvFetch('Image,Gen 1,Gen 2\n,Ông Nội (1900–1980) + Bà Nội,\n,,Con Trai');
    setUrl(`${SRC_SEARCH}&view=${encodeURIComponent('arr:flow')}`);
    render(<App />);
    expect(await screen.findByTestId('print-expanded', {}, { timeout: 50 }).catch(() => null)).toBeNull();
    expect((await screen.findAllByRole('button', { name: /Ông/ })).length).toBeGreaterThan(0);
    expect(document.body.dataset.printArrangement).toBe('flow');
    expect(document.querySelector('svg.print-canvas-svg')).toBeTruthy();
  });

  it('fit refusal strip appears when content exceeds format (a4 + long tree)', async () => {
    const wideFixtureCsv = [
      'Image,Gen 1,Gen 2',
      ',Ông Tổ Đường Rất Là Dài + Bà Tổ Đường Rất Là Dài,',
      ...Array.from({ length: 12 }, (_, i) => `,,Người Con Thứ ${i + 1} Có Tên Rất Là Dài Để Vượt Khổ A4`),
    ].join('\n');
    csvFetch(wideFixtureCsv);
    setUrl(`${SRC_SEARCH}&view=${encodeURIComponent('arr:flow,fmt:a4')}`);
    render(<App />);
    expect(await screen.findByTestId('fit-refusal')).toHaveTextContent('cm');
  });

  it('excluded (disconnected-component) people block export, named by display name (UC-19)', async () => {
    csvFetch('Image,Gen 1,Gen 2\n,Ông Nội + Bà Nội,\n,,Con Trai\n,Người Lạc + Người Lạc Hai,');
    setUrl(`${SRC_SEARCH}&view=${encodeURIComponent('arr:flow')}`);
    render(<App />);
    await screen.findAllByRole('button', { name: /Ông/ });
    const exportButton = screen.getByRole('button', { name: 'Export SVG' });
    expect(exportButton).toBeDisabled();
    const reason = exportButton.getAttribute('title') ?? '';
    expect(reason).toContain('Người Lạc');
    expect(reason).not.toMatch(/\br\d+p?\b/); // never a synthetic row id
    // Also surfaced in the "not connected" warning, by the same names.
    expect(screen.getByTestId('warnings')).toHaveTextContent('Người Lạc');
  });

  it('export failure surfaces a message instead of a silent no-op / unhandled rejection', async () => {
    vi.mocked(collectFontCss).mockRejectedValueOnce(new Error('offline'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    csvFetch('Image,Gen 1,Gen 2\n,Ông Nội + Bà Nội,\n,,Con Trai');
    setUrl(`${SRC_SEARCH}&view=${encodeURIComponent('arr:flow')}`);
    render(<App />);
    await screen.findAllByRole('button', { name: /Ông/ });
    await userEvent.click(screen.getByRole('button', { name: 'Export SVG' }));
    expect(await screen.findByTestId('export-error')).toHaveTextContent(/export failed/i);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('fan arrangement (UC-77, PR ②)', () => {
  const csvFetch = (csv: string) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => csv }) as Response));

  it('renders the fan scene through the same SVG path: dataset, data-arrangement, print sheet, export enabled', async () => {
    csvFetch('Image,Gen 1,Gen 2\n,Ông Nội (1900–1980) + Bà Nội,\n,,Con Trai');
    setUrl(`${SRC_SEARCH}&view=${encodeURIComponent('arr:fan')}`);
    render(<App />);
    expect((await screen.findAllByRole('button', { name: /Ông/ })).length).toBeGreaterThan(0);
    expect(document.body.dataset.printArrangement).toBe('fan');
    const svg = document.querySelector('svg.print-canvas-svg')!;
    expect(svg.getAttribute('data-arrangement')).toBe('fan');
    expect(screen.getByTestId('print-sheet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export SVG' })).toBeEnabled();
    // Fan-only fact: a rotated capsule transform, which flowLayout never emits —
    // proves the fan branch actually ran fanLayout, not flowLayout under a fan label.
    expect(document.querySelector('.person-node[transform*="rotate("]')).toBeTruthy();
  });

  it('fit refusal fires on fan too — legibility floor first, then refuse (a4 + wide tree)', async () => {
    const wide = [
      'Image,Gen 1,Gen 2',
      ',Ông Tổ Đường Rất Là Dài + Bà Tổ Đường Rất Là Dài,',
      ...Array.from({ length: 12 }, (_, i) => `,,Người Con Thứ ${i + 1} Có Tên Rất Là Dài Để Vượt Khổ A4`),
    ].join('\n');
    csvFetch(wide);
    setUrl(`${SRC_SEARCH}&view=${encodeURIComponent('arr:fan,fmt:a4')}`);
    render(<App />);
    expect(await screen.findByTestId('fit-refusal')).toHaveTextContent('cm');
    expect(screen.getByRole('button', { name: 'Export SVG' })).toBeDisabled();
  });
});
