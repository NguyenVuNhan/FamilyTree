import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from './Toolbar';

const noop = { onZoomIn: () => {}, onZoomOut: () => {}, onFit: () => {}, onPrint: () => {}, onMode: () => {} };

describe('Toolbar', () => {
  it('shows title and zoom percentage', () => {
    render(<Toolbar {...noop} title="Demo Family" mode="photo" scalePct={80} />);
    expect(screen.getByRole('heading', { name: 'Demo Family' })).toBeInTheDocument();
    expect(screen.getByTestId('zoom-pct')).toHaveTextContent('80%');
  });

  it('pins e2e-bound container classes and the segmented group', () => {
    const { container } = render(<Toolbar {...noop} title="Demo Family" mode="photo" scalePct={80} />);
    expect(container.querySelector('header')).toHaveClass('toolbar');
    expect(screen.getByRole('group', { name: 'Card display mode' })).toHaveClass('segmented');
    expect(container.querySelector('.zoom-controls')).not.toBeNull();
  });

  it('mode toggle reflects state and fires onMode', async () => {
    const onMode = vi.fn();
    render(<Toolbar {...noop} onMode={onMode} title="T" mode="photo" scalePct={100} />);
    expect(screen.getByRole('button', { name: 'Photo' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onMode).toHaveBeenCalledWith('name');
  });

  it('zoom, fit and print buttons fire callbacks', async () => {
    const cbs = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onFit: vi.fn(), onPrint: vi.fn() };
    render(<Toolbar {...noop} {...cbs} title="T" mode="photo" scalePct={100} />);
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(cbs.onZoomIn).toHaveBeenCalled();
    expect(cbs.onZoomOut).toHaveBeenCalled();
    expect(cbs.onFit).toHaveBeenCalled();
    expect(cbs.onPrint).toHaveBeenCalled();
  });
});
