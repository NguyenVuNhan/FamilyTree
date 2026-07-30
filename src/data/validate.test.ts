import { describe, expect, it } from 'vitest';
import type { PersonRow } from './types';
import { validateRows } from './validate';

const row = (o: Partial<PersonRow> = {}): PersonRow =>
  ({ rowNumber: 2, id: 'r2', fullName: 'Ann Lee', image: '', partnerId: '', parentIds: [], ...o });

describe('validateRows', () => {
  it('accepts URLs, data URIs, raw base64, and blank images without warnings', () => {
    const warnings = validateRows([
      row({ image: 'https://x.test/a.jpg' }),
      row({ id: 'r3', rowNumber: 3, image: 'data:image/png;base64,iVBORw0KGgo=' }),
      row({ id: 'r4', rowNumber: 4, image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }),
      row({ id: 'r5', rowNumber: 5 }),
    ]);
    expect(warnings).toEqual([]);
  });

  it('warns with row number and display name when an image value is unusable', () => {
    const warnings = validateRows([row({ image: 'QUJDIS8v!!' })]);
    expect(warnings).toEqual([
      { row: 2, message: 'Row 2 (Ann Lee): image value is not a URL, data URI, or recognizable base64 — showing initials instead' },
    ]);
  });

  it('checks person and partner rows independently (partner has its own PersonRow)', () => {
    const warnings = validateRows([
      row({ partnerId: 'r2p', image: 'bad!!' }),
      row({ id: 'r2p', fullName: 'Bob Lee', image: 'also-bad!!' }),
    ]);
    expect(warnings).toHaveLength(2);
    expect(warnings[1].message).toContain('Bob Lee');
  });
});
