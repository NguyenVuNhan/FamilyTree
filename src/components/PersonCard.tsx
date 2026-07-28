import type { DisplayMode, Person } from '../data/types';
import { CARD_H, CARD_W } from '../layout/constants';
import { Avatar } from './Avatar';

export function PersonCard({ person, mode, expanded, x, y, onToggle }: {
  person: Person; mode: DisplayMode; expanded: boolean;
  x: number; y: number; onToggle: (id: string) => void;
}) {
  const showAvatar = expanded || mode === 'photo';
  const showName = expanded || mode === 'name';
  return (
    <button
      type="button"
      data-person-id={person.id}
      data-expanded={expanded}
      onClick={() => onToggle(person.id)}
      className={expanded ? 'person-card expanded' : 'person-card'}
      style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
    >
      {showAvatar && <Avatar person={person} size={expanded ? 56 : 64} />}
      {showName && <span className="person-name">{person.fullName}</span>}
    </button>
  );
}
