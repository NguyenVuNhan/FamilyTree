import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from './Toolbar';

const noop = {
  onZoomIn: () => {}, onZoomOut: () => {}, onFit: () => {}, onPrint: () => {},
  onToggleSettings: () => {}, settingsOpen: false,
};

describe('Toolbar', () => {
  it('shows title and zoom percentage', () => {
    render(<Toolbar {...noop} title="Demo Family" scalePct={80} />);
    expect(screen.getByRole('heading', { name: 'Demo Family' })).toBeInTheDocument();
    expect(screen.getByTestId('zoom-pct')).toHaveTextContent('80%');
  });

  it('pins e2e-bound container classes', () => {
    const { container } = render(<Toolbar {...noop} title="Demo Family" scalePct={80} />);
    expect(container.querySelector('header')).toHaveClass('toolbar');
    expect(container.querySelector('.zoom-controls')).not.toBeNull();
  });

  it('zoom, fit, print and settings buttons fire callbacks', async () => {
    const cbs = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onFit: vi.fn(), onPrint: vi.fn(), onToggleSettings: vi.fn() };
    render(<Toolbar {...noop} {...cbs} title="T" scalePct={100} />);
    for (const name of ['Zoom in', 'Zoom out', 'Fit to view', 'Print', 'Layout settings']) {
      await userEvent.click(screen.getByRole('button', { name }));
    }
    expect(cbs.onZoomIn).toHaveBeenCalled();
    expect(cbs.onZoomOut).toHaveBeenCalled();
    expect(cbs.onFit).toHaveBeenCalled();
    expect(cbs.onPrint).toHaveBeenCalled();
    expect(cbs.onToggleSettings).toHaveBeenCalled();
  });

  it('gear button reflects open state via aria-pressed and uses an SVG icon (no emoji)', () => {
    render(<Toolbar {...noop} settingsOpen={true} title="T" scalePct={100} />);
    const gear = screen.getByRole('button', { name: 'Layout settings' });
    expect(gear).toHaveAttribute('aria-pressed', 'true');
    expect(gear.querySelector('svg')).not.toBeNull();
    expect(gear.textContent).toBe('');
  });

  it('print and fit buttons are SVG, not emoji', () => {
    render(<Toolbar {...noop} title="T" scalePct={100} />);
    for (const name of ['Print', 'Fit to view']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.querySelector('svg')).not.toBeNull();
      expect(btn.textContent).toBe('');
    }
  });

  it('renders the share button only when shareLink is provided', () => {
    const base = {
      title: 'T', scalePct: 100, onZoomIn: () => {}, onZoomOut: () => {}, onFit: () => {},
      onPrint: () => {}, settingsOpen: false, onToggleSettings: () => {},
    };
    const { rerender } = render(<Toolbar {...base} />);
    expect(screen.queryByRole('button', { name: 'Copy share link' })).not.toBeInTheDocument();
    rerender(<Toolbar {...base} shareLink="https://host.example/?family=demo" />);
    expect(screen.getByRole('button', { name: 'Copy share link' })).toBeInTheDocument();
  });
});
