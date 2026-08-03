import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadFamilyDialog } from './LoadFamilyDialog';
import { REGISTRY_STORAGE_KEY } from '../config/registry';

const ID = '2PACX-1vT4xAbCdEfGhIjKlMnOpQrStUvWxYz';
afterEach(() => localStorage.clear());

function setup(saved: Parameters<typeof LoadFamilyDialog>[0]['saved'] = []) {
  const navigate = vi.fn();
  render(<LoadFamilyDialog saved={saved} navigate={navigate} />);
  return navigate;
}

describe('LoadFamilyDialog', () => {
  it('is a modal with a focused link input and a demo link', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('link-input')).toHaveFocus();
    expect(screen.getByRole('link', { name: /demo family/i })).toHaveAttribute('href', '?family=demo');
    expect(screen.queryByTestId('saved-families')).not.toBeInTheDocument(); // empty registry → no section
  });

  it('published URL + name → navigate to canonical search', async () => {
    const navigate = setup();
    await userEvent.type(screen.getByTestId('link-input'), `https://docs.google.com/spreadsheets/d/e/${ID}/pubhtml?gid=7&single=true`);
    await userEvent.type(screen.getByTestId('name-input'), 'Smith Family');
    await userEvent.click(screen.getByRole('button', { name: /view the tree/i }));
    expect(navigate).toHaveBeenCalledWith(`?sheet=${ID}&gid=7&name=Smith+Family`);
  });

  it('generic https URL without name → ?src= canonical search', async () => {
    const navigate = setup();
    await userEvent.type(screen.getByTestId('link-input'), 'https://x.example/a.csv');
    await userEvent.click(screen.getByRole('button', { name: /view the tree/i }));
    expect(navigate).toHaveBeenCalledWith(`?${new URLSearchParams({ src: 'https://x.example/a.csv' })}`);
  });

  it.each([
    ['', /paste a link/i],
    ['https://docs.google.com/spreadsheets/d/abc/edit', /publish to web/i],
    ['http://evil.example/a.csv', /https:\/\//],
    ['hello', /doesn't look like a link/i],
  ])('invalid input %j → inline message, no navigation', async (input, message) => {
    const navigate = setup();
    if (input) await userEvent.type(screen.getByTestId('link-input'), input);
    await userEvent.click(screen.getByRole('button', { name: /view the tree/i }));
    expect(screen.getByTestId('link-input-error')).toHaveTextContent(message);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('validation message clears on retype', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /view the tree/i }));
    expect(screen.getByTestId('link-input-error')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('link-input'), 'h');
    expect(screen.queryByTestId('link-input-error')).not.toBeInTheDocument();
  });

  it('saved families render newest-first with subtitles; click navigates; × removes from list and storage', async () => {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify([
      { key: `?sheet=${ID}`, name: 'Smith Family', search: `?sheet=${ID}&name=Smith+Family`, savedAt: 2000 },
      { key: '?src=https%3A%2F%2Fx.example%2Fa.csv', name: 'Alpha', search: '?src=https%3A%2F%2Fx.example%2Fa.csv&name=Alpha', savedAt: 1000 },
    ]));
    const navigate = setup([
      { key: `?sheet=${ID}`, name: 'Smith Family', search: `?sheet=${ID}&name=Smith+Family`, savedAt: 2000 },
      { key: '?src=https%3A%2F%2Fx.example%2Fa.csv', name: 'Alpha', search: '?src=https%3A%2F%2Fx.example%2Fa.csv&name=Alpha', savedAt: 1000 },
    ]);
    const items = within(screen.getByTestId('saved-families')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Smith Family');
    expect(items[0]).toHaveTextContent(/google sheet/i);  // subtitle for sheet entries
    expect(items[1]).toHaveTextContent('x.example');      // subtitle for src entries: host

    // Main button is disambiguated by subtitle text (unique to the view button, not remove)
    await userEvent.click(within(items[0]).getByRole('button', { name: /google sheet/i }));
    expect(navigate).toHaveBeenCalledWith(`?sheet=${ID}&name=Smith+Family`);

    // Verify remove button has correct accessible name
    expect(within(items[0]).getByRole('button', { name: 'Remove Smith Family' })).toBeInTheDocument();

    await userEvent.click(within(items[1]).getByRole('button', { name: 'Remove Alpha' }));
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(REGISTRY_STORAGE_KEY)!)).toHaveLength(1);
  });
});
