// src/components/App.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { REGISTRY_STORAGE_KEY } from '../config/registry';

const DEMO_CSV = 'Đời 1,Đời 2,Image\nMa Ellis + Pa Ellis,,\n,Kid Ellis,';
const SRC_URL = 'https://sheets.example/a.csv';
const SRC_SEARCH = `?${new URLSearchParams({ src: SRC_URL, name: 'Alpha Family' })}`;

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
});
