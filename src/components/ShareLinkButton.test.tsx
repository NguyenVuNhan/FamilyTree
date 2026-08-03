import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareLinkButton } from './ShareLinkButton';

const LINK = 'https://host.example/?sheet=2PACX-x&name=Smith+Family';
afterEach(() => vi.unstubAllGlobals());

describe('ShareLinkButton', () => {
  it('copies the canonical link and confirms via aria-live', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ShareLinkButton link={LINK} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(screen.getByTestId('copy-confirmation')).toHaveTextContent('Link copied');
  });

  it('clipboard unavailable → selectable read-only input fallback', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    render(<ShareLinkButton link={LINK} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    const input = screen.getByRole('textbox', { name: 'Share link' });
    expect(input).toHaveValue(LINK);
    expect(input).toHaveAttribute('readonly');
  });
});
