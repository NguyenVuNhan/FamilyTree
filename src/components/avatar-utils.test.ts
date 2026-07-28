import { describe, expect, it } from 'vitest';
import { avatarHue, initials } from './avatar-utils';

describe('initials', () => {
  it('first + last word', () => expect(initials('Mary Jane Ellis')).toBe('ME'));
  it('single word → one letter', () => expect(initials('Cher')).toBe('C'));
  it('uppercases', () => expect(initials('anna smith')).toBe('AS'));
  it('empty string → empty', () => expect(initials('')).toBe(''));
});

describe('avatarHue', () => {
  it('is deterministic', () => expect(avatarHue('robert')).toBe(avatarHue('robert')));
  it('is in 0..359', () => {
    for (const id of ['a', 'robert', 'margaret', 'x1']) {
      expect(avatarHue(id)).toBeGreaterThanOrEqual(0);
      expect(avatarHue(id)).toBeLessThan(360);
    }
  });
  it('differs for typical ids', () => expect(avatarHue('robert')).not.toBe(avatarHue('margaret')));
});
