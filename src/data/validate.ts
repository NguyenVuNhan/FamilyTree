import type { Issue, PersonRow } from './types';
import { resolveImage } from './image-source';

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
}

// Structural validation lives in the staircase parser — the positional format
// cannot express reference mistakes (unknown ids, cycles, conflicting unions),
// so all that remains here is per-person image-value checking.
export function validateRows(rows: PersonRow[]): ValidationResult {
  const warnings: Issue[] = [];
  for (const row of rows) {
    if (resolveImage(row.image).kind === 'invalid') {
      warnings.push({
        row: row.rowNumber,
        message: `Row ${row.rowNumber} (${row.fullName}): image value is not a URL, data URI, or recognizable base64 — showing initials instead`,
      });
    }
  }
  return { errors: [], warnings };
}
