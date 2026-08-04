import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { THEMES } from '../print/themes';
import type { PrintScene } from '../layout/flow-layout';
import { PrintTreeCanvas } from './PrintTreeCanvas';

const scene: PrintScene = {
  nodes: [
    { personId: 'r2', xMm: 8, yMm: 8, wMm: 40, hMm: 12, generation: 0, nameLines: ['Nguyễn Văn A'], years: '1930–1990', fontMm: 12, titleFace: true },
    { personId: 'r3', xMm: 64, yMm: 8, wMm: 30, hMm: 10, generation: 1, nameLines: ['Bé'], years: null, fontMm: 10.2, titleFace: true },
  ],
  edges: [{ d: 'M 48 14 C 56 14 56 13 64 13', fromId: 'u:x', toId: 'r3' }],
  wMm: 102, hMm: 30,
};

describe('PrintTreeCanvas', () => {
  it('emits the markup contract (E2E plan §2.1)', () => {
    const { container } = render(
      <PrintTreeCanvas scene={scene} theme={THEMES.indochine} title="Gia Phả" guide={null} expandedId={null} onToggle={() => {}} />,
    );
    const node = container.querySelector('g.person-node[data-person-id="r2"]')!;
    expect(node.getAttribute('data-generation')).toBe('0');
    expect(node.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('path.connector[data-from="u:x"][data-to="r3"]')).toBeTruthy();
    expect(container.querySelector('[data-print-role="background"]')).toBeTruthy();
    expect(container.querySelector('svg')!.getAttribute('data-arrangement')).toBe('flow');
    expect(container.querySelector('style')!.textContent).toContain('.pn-name');
  });
  it('title face on gens 0–1, years line optional', () => {
    const { container } = render(
      <PrintTreeCanvas scene={scene} theme={THEMES.indochine} title="T" guide={null} expandedId={null} onToggle={() => {}} />,
    );
    expect(container.querySelectorAll('text.pn-name-title')).toHaveLength(2);
    expect(container.querySelectorAll('text.pn-years')).toHaveLength(1);
  });
  it('guide renders only when requested and is tagged non-semantic', () => {
    const { container, rerender } = render(
      <PrintTreeCanvas scene={scene} theme={THEMES.nordic} title="T" guide={null} expandedId={null} onToggle={() => {}} />,
    );
    expect(container.querySelector('[data-print-role="guide"]')).toBeNull();
    rerender(
      <PrintTreeCanvas scene={scene} theme={THEMES.nordic} title="T" guide={{ wMm: 1200, hMm: 600, marginMm: 60 }} expandedId={null} onToggle={() => {}} />,
    );
    expect(container.querySelectorAll('[data-print-role="guide"] rect')).toHaveLength(2);
  });
  it('click and keyboard toggle; expanded overlay shows name + years', async () => {
    const onToggle = vi.fn();
    const { container, rerender } = render(
      <PrintTreeCanvas scene={scene} theme={THEMES.inkwash} title="T" guide={null} expandedId={null} onToggle={onToggle} />,
    );
    await userEvent.click(container.querySelector('[data-person-id="r2"]')!);
    expect(onToggle).toHaveBeenCalledWith('r2');
    rerender(
      <PrintTreeCanvas scene={scene} theme={THEMES.inkwash} title="T" guide={null} expandedId="r2" onToggle={onToggle} />,
    );
    expect(screen.getByTestId('print-expanded')).toHaveTextContent('Nguyễn Văn A');
    expect(screen.getByTestId('print-expanded')).toHaveTextContent('1930–1990');
  });
});
