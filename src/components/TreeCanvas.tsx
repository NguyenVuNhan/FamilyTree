import { memo } from 'react';
import type { FamilyModel } from '../data/types';
import type { LayoutResult } from '../layout/layout-engine';
import type { LayoutSettings } from '../settings/settings';
import { PersonCard } from './PersonCard';

// Memoized: the viewport re-renders on every pan/zoom tick, but the tree's own props
// (model/layout/settings/expandedId) rarely change on those ticks — memo skips re-rendering
// (and re-diffing) every card in the tree for a plain pan or zoom.
export const TreeCanvas = memo(function TreeCanvas({ model, layout, settings, expandedId, onToggle, nameLines }: {
  model: FamilyModel; layout: LayoutResult; settings: LayoutSettings;
  expandedId: string | null; onToggle: (id: string) => void; nameLines: number;
}) {
  return (
    <div className="tree-canvas" style={{ width: layout.width, height: layout.height }}>
      <svg data-testid="connector-layer" width={layout.width} height={layout.height} aria-hidden="true">
        {layout.connectors.map((d, i) => (
          <path key={i} className="connector" d={d} fill="none" />
        ))}
      </svg>
      {layout.cards.map((c) => {
        const person = model.persons.get(c.personId)!;
        return (
          <PersonCard key={c.personId} person={person} settings={settings}
            expanded={expandedId === c.personId} x={c.x} y={c.y} onToggle={onToggle} nameLines={nameLines} />
        );
      })}
    </div>
  );
});
