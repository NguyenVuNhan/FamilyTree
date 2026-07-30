import { describe, expect, it } from 'vitest';
import { parseGender } from './gender';

describe('parseGender', () => {
  it.each([['m'], ['M'], ['male'], ['Male'], ['nam'], ['NAM']])('"%s" → male', (v) => {
    expect(parseGender(v)).toBe('male');
  });
  it.each([['f'], ['F'], ['female'], ['nữ'], ['Nữ'], ['nu']])('"%s" → female', (v) => {
    expect(parseGender(v)).toBe('female');
  });
  it.each([[''], ['  '], ['x'], ['man'], ['nam nữ']])('"%s" → undefined', (v) => {
    expect(parseGender(v)).toBeUndefined();
  });
});
