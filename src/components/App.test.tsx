import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const DEMO_CSV = 'Đời 1,Đời 2,Image\nMa Ellis + Pa Ellis,,\n,Kid Ellis,';

const okFetch = () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => DEMO_CSV }) as Response));
const setUrl = (search: string) => window.history.replaceState({}, '', `/${search}`);
afterEach(() => { vi.unstubAllGlobals(); setUrl(''); });

// With no FAMILY_TREE_* env in tests, the registry contains only demo.
describe('App', () => {
  it('renders the tree with the family display name and title', async () => {
    okFetch();
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Demo Family' })).toBeInTheDocument());
    expect(document.title).toBe('Demo Family — Family Tree');
    expect(screen.getAllByRole('button', { name: /Ellis/ }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('sample-banner')).toHaveTextContent(/no family sheets/i);
  });

  it('dismisses the banner', async () => {
    okFetch();
    render(<App />);
    await waitFor(() => screen.getByTestId('sample-banner'));
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByTestId('sample-banner')).not.toBeInTheDocument();
  });

  it('unknown ?family → not-found state without listing names', async () => {
    setUrl('?family=nope');
    okFetch();
    render(<App />);
    expect(await screen.findByTestId('family-not-found')).toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it('only one card expands at a time; Esc collapses', async () => {
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
    okFetch();
    render(<App />);
    await waitFor(() => screen.getByTestId('zoom-pct'));
    const initialPct = screen.getByTestId('zoom-pct').textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByTestId('zoom-pct').textContent).not.toBe(initialPct);
  });

  it('shows the error panel for invalid data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, text: async () => 'Đời 1,Đời 2,Image\n,Orphan Kid,',
    }) as Response));
    setUrl('?family=demo');
    render(<App />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent(/must start in/);
  });
});
