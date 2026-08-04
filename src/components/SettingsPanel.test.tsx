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

describe('print controls gating (UC-78)', () => {
  const flow = { ...DEFAULT_SETTINGS, arrangement: 'flow' as const };
  it('flow: card controls disabled with tooltip, print controls present', () => {
    render(<SettingsPanel settings={flow} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Card style' }).querySelector('button')).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Format' })).toBeInTheDocument();
    expect(screen.getByLabelText('Frame guide')).toBeInTheDocument();
  });
  it('topDown: print controls absent, card controls enabled', () => {
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onChange={() => {}} />);
    expect(screen.queryByRole('group', { name: 'Theme' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Card style' }).querySelector('button')).toBeEnabled();
  });
  it('custom format: inputs clamp and report invalid', async () => {
    const onChange = vi.fn();
    render(<SettingsPanel settings={{ ...flow, format: 'custom' }} onChange={onChange} />);
    const w = screen.getByLabelText('Custom width (mm)');
    await userEvent.clear(w);
    await userEvent.type(w, '299');
    expect(screen.getByTestId('custom-size-error')).toHaveTextContent('300');
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ customWmm: 299 }));
  });
  it('square shows the soft aspect hint for flow', () => {
    render(<SettingsPanel settings={{ ...flow, format: 'square' }} onChange={() => {}} />);
    expect(screen.getByTestId('aspect-hint')).toBeInTheDocument();
  });
});

describe('fan arrangement + aspect hint (PR ②)', () => {
  const fan = { ...DEFAULT_SETTINGS, arrangement: 'fan' as const };
  it('Fan option exists and gates card controls exactly like flow', () => {
    render(<SettingsPanel settings={fan} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Fan' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Card style' }).querySelector('button')).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
  });
  it('fan hints ≥2:1 landscape on square-ish formats only; the hint never blocks anything', () => {
    const { rerender } = render(<SettingsPanel settings={{ ...fan, format: 'square' }} onChange={() => {}} />);
    expect(screen.getByTestId('aspect-hint')).toHaveTextContent('2:1');
    rerender(<SettingsPanel settings={{ ...fan, format: 'pano' }} onChange={() => {}} />);
    expect(screen.queryByTestId('aspect-hint')).toBeNull();
    rerender(<SettingsPanel settings={{ ...fan, format: 'a4' }} onChange={() => {}} />);
    expect(screen.queryByTestId('aspect-hint')).toBeNull(); // A-landscape ≈ 1.414 is not square-ish
    rerender(<SettingsPanel settings={{ ...fan, format: 'custom', customWmm: 900, customHmm: 800 }} onChange={() => {}} />);
    expect(screen.getByTestId('aspect-hint')).toHaveTextContent('2:1'); // 1.125 < 1.2
  });
  it('flow keeps its original hint, unchanged', () => {
    render(<SettingsPanel settings={{ ...DEFAULT_SETTINGS, arrangement: 'flow', format: 'square' }} onChange={() => {}} />);
    expect(screen.getByTestId('aspect-hint')).toHaveTextContent('Scroll reads best on a wide format');
  });
});
