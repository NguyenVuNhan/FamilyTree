import type { Issue, PersonRow } from './types';
import { resolveImage } from './image-source';

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
}

export function validateRows(rows: PersonRow[]): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const byId = new Map<string, PersonRow>();

  for (const row of rows) {
    if (byId.has(row.id)) {
      const original = byId.get(row.id);
      errors.push({
        row: row.rowNumber,
        message: `Duplicate ID "${row.id}" (already used on row ${original?.rowNumber})`,
      });
    } else if (row.id) {
      byId.set(row.id, row);
    }
    if (!row.fullName) errors.push({ row: row.rowNumber, message: `Row ${row.rowNumber} is missing FullName` });
    if (!row.id) errors.push({ row: row.rowNumber, message: `Row ${row.rowNumber} is missing ID` });
  }

  // case-only id collisions
  const byLower = new Map<string, string>();
  for (const id of byId.keys()) {
    const seen = byLower.get(id.toLowerCase());
    if (seen && seen !== id) {
      warnings.push({ message: `IDs "${seen}" and "${id}" differ only by letter case — is that intended?` });
    } else {
      byLower.set(id.toLowerCase(), id);
    }
  }

  for (const row of rows) {
    if (row.partnerId && !byId.has(row.partnerId)) {
      errors.push({ row: row.rowNumber, message: `Unknown PartnerID "${row.partnerId}" on row ${row.rowNumber}` });
    }
    for (const pid of row.parentIds) {
      if (!byId.has(pid)) errors.push({ row: row.rowNumber, message: `Unknown ParentIDs "${pid}" on row ${row.rowNumber}` });
    }
    if (row.parentIds.length > 2) {
      errors.push({ row: row.rowNumber, message: `Row ${row.rowNumber} lists more than 2 parents (${row.parentIds.join(', ')})` });
    }
    if (resolveImage(row.image).kind === 'invalid') {
      warnings.push({
        row: row.rowNumber,
        message: `Row ${row.rowNumber}: image value is not a URL, data URI, or recognizable base64 — showing initials instead`,
      });
    }
  }

  // partner consistency: collect every claimed pairing (either direction)
  const claims = new Map<string, PersonRow[]>(); // target id -> rows claiming it as partner
  for (const row of rows) {
    if (!row.partnerId || !byId.has(row.partnerId)) continue;
    claims.set(row.partnerId, [...(claims.get(row.partnerId) ?? []), row]);
  }
  for (const [target, claimants] of claims) {
    if (claimants.length > 1) {
      const [a, b] = claimants;
      errors.push({
        message: `"${target}" is linked as partner by both "${a.id}" (row ${a.rowNumber}) and "${b.id}" (row ${b.rowNumber}) — one person can only appear in one couple`,
      });
      continue;
    }
    const targetRow = byId.get(target);
    if (targetRow && targetRow.partnerId && targetRow.partnerId !== claimants[0].id) {
      errors.push({
        message: `conflicting partner links: "${claimants[0].id}" (row ${claimants[0].rowNumber}) → "${target}", but "${target}" (row ${targetRow.rowNumber}) → "${targetRow.partnerId}"`,
      });
    }
  }

  // ancestry cycles (DFS over parent edges) — only meaningful once the graph is otherwise clean
  if (errors.length === 0) {
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (id: string): boolean => {
      if (state.get(id) === 'done') return false;
      if (state.get(id) === 'visiting') return true;
      state.set(id, 'visiting');
      const cyc = (byId.get(id)?.parentIds ?? []).some(visit);
      state.set(id, 'done');
      return cyc;
    };
    for (const id of byId.keys()) {
      if (visit(id)) {
        errors.push({ message: `Ancestry cycle detected involving "${id}" — someone is their own ancestor` });
        break;
      }
    }
  }

  return { errors, warnings };
}
