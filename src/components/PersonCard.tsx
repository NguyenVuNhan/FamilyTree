import type { CSSProperties } from 'react';
import type { Person } from '../data/types';
import type { LayoutSettings } from '../settings/settings';
import { cardMetrics, effectiveCardStyle } from '../layout/card-metrics';
import { Avatar } from './Avatar';
import { avatarHue } from './avatar-utils';

export function PersonCard({ person, settings, expanded, x, y, onToggle }: {
  person: Person; settings: LayoutSettings; expanded: boolean;
  x: number; y: number; onToggle: (id: string) => void;
}) {
  const style = effectiveCardStyle(settings);
  const { cardW, cardH } = cardMetrics(settings);
  const showAvatar = expanded || settings.contentMode !== 'name';
  const showName = expanded || settings.contentMode !== 'avatar';
  const nameOnTop = settings.namePosition === 'top' && style !== 'photoLeft' && !expanded;
  const avatarSize = expanded ? 56 : style === 'photoLeft' ? 48 : style === 'archCard' ? cardW : 64;
  const bleeds = style === 'circle' || style === 'archCard'; // image/circle reaches the card edge

  const name = <span className="person-name" title={person.fullName}>{person.fullName}</span>;
  return (
    <button
      type="button"
      data-person-id={person.id}
      data-expanded={expanded}
      onClick={() => onToggle(person.id)}
      className={`person-card style-${style}${expanded ? ' expanded' : ''}`}
      style={{
        left: x, top: y, width: cardW, height: cardH,
        padding: bleeds && !expanded ? 0 : settings.cardPadding,
        '--pad': `${settings.cardPadding}px`,
        '--ring-color': `hsl(${avatarHue(person.id)} 45% 62%)`,
      } as CSSProperties}
    >
      {nameOnTop && showName && name}
      {showAvatar && (
        <Avatar
          person={person}
          size={avatarSize}
          shape={style === 'archCard' && !expanded ? 'square' : 'circle'}
          placeholderStyle={settings.placeholderStyle}
        />
      )}
      {!nameOnTop && showName && name}
    </button>
  );
}
