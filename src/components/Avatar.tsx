import { useState } from 'react';
import type { Person } from '../data/types';
import type { PlaceholderStyle } from '../settings/settings';
import { avatarHue, initials } from './avatar-utils';

function Silhouette({ gender, hue, size, shape, label }: {
  gender: 'male' | 'female'; hue: number; size: number; shape: 'circle' | 'square'; label: string;
}) {
  return (
    <svg
      role="img"
      aria-label={label}
      data-testid="silhouette"
      data-gender={gender}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={shape === 'circle' ? 'avatar-fallback rounded-full' : 'avatar-fallback'}
      style={{ background: `hsl(${hue} 45% 90%)`, flexShrink: 0 }}
    >
      {gender === 'female' ? (
        // head with hair sweep + shoulders
        <g fill={`hsl(${hue} 40% 34%)`}>
          <path d="M32 8c-8.5 0-14 5.8-14 14.5 0 4.6 1 8.4-1.6 12.5h7.2C21.4 41 16.4 44 10 46v10h44V46c-6.4-2-11.4-5-13.6-11h7.2C45 30.9 46 27.1 46 22.5 46 13.8 40.5 8 32 8z" />
        </g>
      ) : (
        // round head + shoulders
        <g fill={`hsl(${hue} 40% 34%)`}>
          <circle cx="32" cy="21" r="10.5" />
          <path d="M32 35c-11.5 0-19.5 6.2-21.5 16.5V56h43v-4.5C51.5 41.2 43.5 35 32 35z" />
        </g>
      )}
    </svg>
  );
}

export function Avatar({ person, size, shape = 'circle', placeholderStyle = 'initials' }: {
  person: Person; size: number; shape?: 'circle' | 'square'; placeholderStyle?: PlaceholderStyle;
}) {
  const [broken, setBroken] = useState(false);
  const [prevSrc, setPrevSrc] = useState(person.imageSrc);
  if (prevSrc !== person.imageSrc) {
    setPrevSrc(person.imageSrc);
    setBroken(false);
  }
  const round = shape === 'circle' ? 'rounded-full' : '';
  if (person.imageSrc && !broken) {
    return (
      <img
        src={person.imageSrc}
        alt={person.fullName}
        onError={() => setBroken(true)}
        className={`${round} object-cover`.trim()}
        style={{ width: size, height: size, flexShrink: 0 }}
      />
    );
  }
  const hue = avatarHue(person.id);
  if (placeholderStyle === 'illustrated' && person.gender) {
    return <Silhouette gender={person.gender} hue={hue} size={size} shape={shape} label={person.fullName} />;
  }
  return (
    <div
      role="img"
      aria-label={person.fullName}
      className={`avatar-fallback flex items-center justify-center ${round} font-semibold text-white select-none`.trim()}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue} 70% 60%), hsl(${(hue + 40) % 360} 70% 50%))`,
      }}
    >
      {initials(person.fullName)}
    </div>
  );
}
