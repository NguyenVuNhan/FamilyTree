import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeCanvas } from './TreeCanvas';
import { parseCsv } from '../data/csv-parser';
import { buildModel } from '../data/build-model';
import { layoutTree } from '../layout/layout-engine';

const model = buildModel(parseCsv('ID,FullName,Image,PartnerID,ParentIDs\nma,Ma Ellis,,pa,\npa,Pa Ellis,,,\nk,Kid Ellis,,,ma;pa'));
const layout = layoutTree(model);

describe('TreeCanvas', () => {
  it('renders one card per person and one path per connector', () => {
    render(<TreeCanvas model={model} layout={layout} mode="name" expandedId={null} onToggle={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByTestId('connector-layer').querySelectorAll('path')).toHaveLength(layout.connectors.length);
  });

  it('marks only the expanded card', () => {
    render(<TreeCanvas model={model} layout={layout} mode="name" expandedId="pa" onToggle={() => {}} />);
    const expanded = screen.getAllByRole('button').filter((b) => b.dataset.expanded === 'true');
    expect(expanded).toHaveLength(1);
    expect(expanded[0].dataset.personId).toBe('pa');
  });
});
