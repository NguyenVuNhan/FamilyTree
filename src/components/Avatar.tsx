import { useState } from 'react';
import type { Person } from '../data/types';
import { avatarHue, initials } from './avatar-utils';

export function Avatar({ person, size }: { person: Person; size: number }) {
  const [broken, setBroken] = useState(false);
  const [prevSrc, setPrevSrc] = useState(person.imageSrc);
  if (prevSrc !== person.imageSrc) {
    setPrevSrc(person.imageSrc);
    setBroken(false);
  }
  if (person.imageSrc && !broken) {
    return (
      <img
        src={person.imageSrc}
        alt={person.fullName}
        onError={() => setBroken(true)}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const hue = avatarHue(person.id);
  return (
    <div
      role="img"
      aria-label={person.fullName}
      className="flex items-center justify-center rounded-full font-semibold text-white select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(135deg, hsl(${hue} 70% 60%), hsl(${(hue + 40) % 360} 70% 50%))`,
      }}
    >
      {initials(person.fullName)}
    </div>
  );
}
