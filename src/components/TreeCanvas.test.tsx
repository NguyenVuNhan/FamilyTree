import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeCanvas } from './TreeCanvas';
import { parseStaircase } from '../data/staircase-parser';
import { buildModel } from '../data/build-model';
import { layoutTree } from '../layout/layout-engine';
import { DEFAULT_METRICS } from '../layout/card-metrics';
import { DEFAULT_SETTINGS } from '../settings/settings';

const model = buildModel(parseStaircase('Đời 1,Đời 2,Image\nMa Ellis + Pa Ellis,,\n,Kid Ellis,').rows);
const layout = layoutTree(model, DEFAULT_METRICS);
const nameSettings = { ...DEFAULT_SETTINGS, contentMode: 'name' } as const;

describe('TreeCanvas', () => {
  it('renders one card per person and one path per connector', () => {
    render(<TreeCanvas model={model} layout={layout} settings={nameSettings} expandedId={null} onToggle={() => {}} nameLines={1} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByTestId('connector-layer').querySelectorAll('path')).toHaveLength(layout.connectors.length);
  });

  it('marks only the expanded card', () => {
    render(<TreeCanvas model={model} layout={layout} settings={nameSettings} expandedId="r2p" onToggle={() => {}} nameLines={1} />);
    const expanded = screen.getAllByRole('button').filter((b) => b.dataset.expanded === 'true');
    expect(expanded).toHaveLength(1);
    expect(expanded[0].dataset.personId).toBe('r2p');
  });
});
