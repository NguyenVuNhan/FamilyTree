import type { DisplayMode, FamilyModel } from '../data/types';
import type { LayoutResult } from '../layout/layout-engine';
import { PersonCard } from './PersonCard';

export function TreeCanvas({ model, layout, mode, expandedId, onToggle }: {
  model: FamilyModel; layout: LayoutResult; mode: DisplayMode;
  expandedId: string | null; onToggle: (id: string) => void;
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
          <PersonCard key={c.personId} person={person} mode={mode}
            expanded={expandedId === c.personId} x={c.x} y={c.y} onToggle={onToggle} />
        );
      })}
    </div>
  );
}
