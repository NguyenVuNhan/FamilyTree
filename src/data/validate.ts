import type { Issue, PersonRow } from './types';
import { resolveImage } from './image-source';
import { parseGender } from './gender';

// Structural validation lives in the staircase parser — the positional format
// cannot express reference mistakes (unknown ids, cycles, conflicting unions),
// so all that remains here is per-person image-value checking.
export function validateRows(rows: PersonRow[]): Issue[] {
  const warnings: Issue[] = [];
  for (const row of rows) {
    if (resolveImage(row.image).kind === 'invalid') {
      warnings.push({
        row: row.rowNumber,
        message: `Row ${row.rowNumber} (${row.fullName}): image value is not a URL, data URI, or recognizable base64 — showing initials instead`,
      });
    }
    if (row.gender && !parseGender(row.gender)) {
      warnings.push({
        row: row.rowNumber,
        message: `Row ${row.rowNumber}: Gender "${row.gender}" not recognized (use m/f, male/female, nam/nữ) — showing the default avatar`,
      });
    }
  }
  return warnings;
}
