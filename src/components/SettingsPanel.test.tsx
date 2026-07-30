import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './SettingsPanel';
import { DEFAULT_SETTINGS, type LayoutSettings } from '../settings/settings';

const s = (over: Partial<LayoutSettings> = {}): LayoutSettings => ({ ...DEFAULT_SETTINGS, ...over });

describe('SettingsPanel', () => {
  it('every control group has a visible label', () => {
    render(<SettingsPanel settings={s()} onChange={() => {}} />);
    for (const label of ['Card style', 'Show', 'Name position', 'Placeholder', 'Connectors']) {
      expect(screen.getByRole('group', { name: label })).toBeInTheDocument();
    }
    for (const label of ['Card padding', 'Partner gap', 'Sibling gap', 'Generation gap']) {
      expect(screen.getByRole('slider', { name: label })).toBeInTheDocument();
    }
  });

  it('reflects current values via aria-pressed and slider values', () => {
    render(<SettingsPanel settings={s({ cardStyle: 'circle', genGap: 120 })} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Circle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('slider', { name: 'Generation gap' })).toHaveValue('120');
  });

  it('selecting a card style emits the whole settings object with that field changed', async () => {
    const onChange = vi.fn();
    render(<SettingsPanel settings={s()} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Photo left' }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, cardStyle: 'photoLeft' });
  });

  it('moving a slider emits the numeric value', () => {
    const onChange = vi.fn();
    render(<SettingsPanel settings={s()} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Generation gap' }), { target: { value: '150' } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, genGap: 150 });
  });

  it('name position is disabled outside full mode and for photoLeft', () => {
    const { rerender } = render(<SettingsPanel settings={s({ contentMode: 'avatar' })} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Top' })).toBeDisabled();
    rerender(<SettingsPanel settings={s({ contentMode: 'full' })} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Top' })).toBeEnabled();
    rerender(<SettingsPanel settings={s({ contentMode: 'full', cardStyle: 'photoLeft' })} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Top' })).toBeDisabled();
  });

  it('reset emits pristine defaults', async () => {
    const onChange = vi.fn();
    render(<SettingsPanel settings={s({ cardStyle: 'archCard', genGap: 200 })} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });
});
