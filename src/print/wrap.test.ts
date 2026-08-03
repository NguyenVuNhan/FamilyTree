import { describe, expect, it } from 'vitest';
import { wrapName } from './wrap';

const byChars = (t: string) => t.length * 10; // 10 units per char

describe('wrapName', () => {
  it('single line when it fits', () => {
    expect(wrapName('Nguyễn Văn A', 200, byChars)).toEqual(['Nguyễn Văn A']);
  });
  it('greedy word wrap, no ellipsis, nothing dropped', () => {
    expect(wrapName('Nguyễn Thị Phương Thảo Nguyên', 120, byChars))
      .toEqual(['Nguyễn Thị', 'Phương Thảo', 'Nguyên']);
  });
  it('a word wider than the line breaks per character', () => {
    expect(wrapName('Abcdefghij', 50, byChars)).toEqual(['Abcde', 'fghij']);
  });
  it('empty → single empty line', () => {
    expect(wrapName('  ', 100, byChars)).toEqual(['']);
  });
});
