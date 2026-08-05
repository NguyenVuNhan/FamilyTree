import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PrintPanels } from '../layout/panels-layout';
import { THEMES } from '../print/themes';
import { PrintPanelsCanvas } from './PrintPanelsCanvas';

const scene = (ids: string[], wMm: number, hMm: number) => ({
  nodes: ids.map((id, i) => ({
    personId: id, xMm: 8, yMm: 8 + i * 20, wMm: 40, hMm: 12, generation: i,
    nameLines: [id.startsWith('m:') ? id.slice(2) : `Name ${id}`], years: null, fontMm: 10, titleFace: false,
  })),
  edges: [], wMm, hMm,
});

const comp: PrintPanels = {
  kind: 'panels',
  panels: [
    { label: null, parentLabel: null, headId: null, headName: null, cutLabels: ['II'],
      scene: scene(['a', 'm:II'], 100, 60), xMm: 0, wMm: 100, hMm: 86, overCap: false },
    { label: 'II', parentLabel: null, headId: 'g', headName: 'Trần Văn Đức', cutLabels: [],
      scene: scene(['g', 'x0'], 120, 70), xMm: 124, wMm: 120, hMm: 96, overCap: false },
  ],
  wMm: 244, hMm: 96,
  overCap: false,
};

describe('PrintPanelsCanvas', () => {
  it('renders one SVG with per-panel groups carrying the extraction contract (label + physical dims)', () => {
    const { container } = render(
      <PrintPanelsCanvas composition={comp} theme={THEMES.botanical} title="Gia Phả"
        guide={null} expandedId={null} onToggle={() => {}} />,
    );
    const svg = container.querySelector('svg.print-canvas-svg')!;
    expect(svg.getAttribute('data-arrangement')).toBe('panels');
    expect(svg.getAttribute('viewBox')).toBe('0 0 244 96');
    const groups = container.querySelectorAll('g.print-panel');
    expect(groups).toHaveLength(2);
    expect(groups[0].getAttribute('data-panel-label')).toBe('master');
    expect(groups[0].getAttribute('data-panel-w')).toBe('100');
    expect(groups[0].getAttribute('data-panel-h')).toBe('86');
    expect(groups[1].getAttribute('transform')).toBe('translate(124 0)');
  });

  it('master shows the family title; sub-panels show label · head name, an in-chip, and the continuation subtitle', () => {
    const { container } = render(
      <PrintPanelsCanvas composition={comp} theme={THEMES.botanical} title="Gia Phả"
        guide={null} expandedId={null} onToggle={() => {}} />,
    );
    const [master, sub] = [...container.querySelectorAll('g.print-panel')];
    expect(master.querySelector('text.pt-title')!.textContent).toBe('Gia Phả');
    expect(master.querySelector('[data-marker-side="in"]')).toBeNull();
    expect(sub.querySelector('text.pt-title')!.textContent).toBe('II · Trần Văn Đức');
    const inChip = sub.querySelector('g.print-marker[data-marker-side="in"]')!;
    expect(inChip.getAttribute('data-marker')).toBe('II');
    expect(sub.querySelector('text.pt-subtitle')!.textContent).toBe('continued from the master panel');
    // the out-chip inside the master's scene pairs with it (rendered by PrintSceneGroup)
    expect(master.querySelector('g.print-marker[data-marker-side="out"]')!.getAttribute('data-marker')).toBe('II');
  });

  it('draws a double-rule frame per panel tagged as sacrificial border', () => {
    const { container } = render(
      <PrintPanelsCanvas composition={comp} theme={THEMES.indochine} title="T"
        guide={null} expandedId={null} onToggle={() => {}} />,
    );
    for (const g of container.querySelectorAll('g.print-panel')) {
      const border = g.querySelector('[data-print-role="border"]')!;
      expect(border.querySelectorAll('rect.pp-frame')).toHaveLength(2);
    }
  });

  it('frame guide draws per panel and stays out of the content group', () => {
    const { container } = render(
      <PrintPanelsCanvas composition={comp} theme={THEMES.nordic} title="T"
        guide={{ wMm: 400, hMm: 600, marginMm: 50 }} expandedId={null} onToggle={() => {}} />,
    );
    expect(container.querySelectorAll('[data-print-role="guide"]')).toHaveLength(2);
  });

  it('expanded overlay positions against the owning panel offset; node clicks still toggle', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <PrintPanelsCanvas composition={comp} theme={THEMES.inkwash} title="T"
        guide={null} expandedId="x0" onToggle={onToggle} />,
    );
    const overlay = container.querySelector('[data-testid="print-expanded"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.style.left).toBe('132px');            // panel x 124 + node x 8
    expect(overlay.textContent).toContain('Name x0');
    (container.querySelector('g.person-node[data-person-id="a"]') as SVGGElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(onToggle).toHaveBeenCalledWith('a');
  });
});
