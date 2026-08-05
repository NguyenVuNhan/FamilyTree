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

describe('fan rendering (PR ②)', () => {
  const fanScene: PrintScene = {
    nodes: [
      { personId: 'r2', xMm: 40, yMm: 60, wMm: 40, hMm: 12, generation: 0, nameLines: ['Root'], years: null, fontMm: 12, titleFace: true },
      { personId: 'r3', xMm: 70, yMm: 30, wMm: 30, hMm: 10, generation: 1, nameLines: ['Child'], years: null, fontMm: 10.2, titleFace: true, rotateDeg: -45 },
    ],
    edges: [{ d: 'M 60 60 C 62 55 66 50 70 35', fromId: 'u:x', toId: 'r3' }],
    wMm: 120, hMm: 80,
  };
  it('rotated nodes render translate + rotate; unrotated nodes stay translate-only', () => {
    const { container } = render(
      <PrintTreeCanvas scene={fanScene} theme={THEMES.indochine} title="T" guide={null}
        expandedId={null} onToggle={() => {}} arrangement="fan" />,
    );
    expect(container.querySelector('[data-person-id="r3"]')!.getAttribute('transform')).toBe('translate(70 30) rotate(-45)');
    expect(container.querySelector('[data-person-id="r2"]')!.getAttribute('transform')).toBe('translate(40 60)');
  });
  it('fan: data-arrangement=fan and the title cartouche sits BELOW the scene (ornament zone under the root)', () => {
    const { container } = render(
      <PrintTreeCanvas scene={fanScene} theme={THEMES.indochine} title="Gia Phả" guide={null}
        expandedId={null} onToggle={() => {}} arrangement="fan" />,
    );
    expect(container.querySelector('svg')!.getAttribute('data-arrangement')).toBe('fan');
    const titleY = Number(container.querySelector('text.pt-title')!.getAttribute('y'));
    expect(titleY).toBeGreaterThan(fanScene.hMm); // below the content, inside the bottom strip
    // content group is NOT pushed down when the title is at the bottom:
    expect(container.querySelector('svg > g')!.getAttribute('transform')).toBe('translate(0 0)');
  });
  it('default arrangement stays flow — existing markup untouched', () => {
    const { container } = render(
      <PrintTreeCanvas scene={fanScene} theme={THEMES.indochine} title="T" guide={null}
        expandedId={null} onToggle={() => {}} />,
    );
    expect(container.querySelector('svg')!.getAttribute('data-arrangement')).toBe('flow');
    const titleY = Number(container.querySelector('text.pt-title')!.getAttribute('y'));
    expect(titleY).toBeLessThan(30); // top strip, as before
  });
});

describe('marker chips (PR ③)', () => {
  const chipScene: PrintScene = {
    nodes: [
      { personId: 'r2', xMm: 10, yMm: 10, wMm: 40, hMm: 12, generation: 0, nameLines: ['Root'], years: null, fontMm: 12, titleFace: true },
      { personId: 'm:II', xMm: 70, yMm: 12, wMm: 15, hMm: 9, generation: 1, nameLines: ['II'], years: null, fontMm: 10.2, titleFace: true },
    ],
    edges: [{ d: 'M 50 16 C 55 16 65 16 70 16', fromId: 'u:x', toId: 'm:II' }],
    wMm: 100, hMm: 40,
  };
  it('m:-prefixed nodes render as non-interactive continuation chips, not person nodes', () => {
    const { container } = render(
      <PrintTreeCanvas scene={chipScene} theme={THEMES.botanical} title="T" guide={null}
        expandedId={null} onToggle={() => {}} />,
    );
    const chip = container.querySelector('g.print-marker')!;
    expect(chip.getAttribute('data-marker')).toBe('II');
    expect(chip.getAttribute('data-marker-side')).toBe('out');
    expect(chip.getAttribute('role')).toBeNull();          // not a button
    expect(chip.getAttribute('tabindex')).toBeNull();      // not focusable
    expect(chip.querySelector('rect.pm-chip')).not.toBeNull();
    expect(chip.querySelector('text.pm-label')!.textContent).toBe('II');
    expect(container.querySelectorAll('g.person-node')).toHaveLength(1); // only the real person
    // the replacement connector still carries the pairing hooks
    expect(container.querySelector('path.connector[data-to="m:II"]')).not.toBeNull();
  });
});
