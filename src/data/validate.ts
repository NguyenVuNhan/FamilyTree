import type { Issue, PersonRow } from './types';
import { resolveImage } from './image-source';
import { parseGender } from './gender';

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
    if (row.partnerId && row.id && row.partnerId === row.id) {
      errors.push({ row: row.rowNumber, message: `row ${row.rowNumber}: "${row.id}" lists themselves as partner` });
    }
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
    if (row.gender && !parseGender(row.gender)) {
      warnings.push({
        row: row.rowNumber,
        message: `Row ${row.rowNumber}: Gender "${row.gender}" not recognized (use m/f, male/female, nam/nữ) — showing the default avatar`,
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
      const named = claimants.map((c) => `"${c.id}" (row ${c.rowNumber})`);
      if (named.length === 2) {
        errors.push({
          message: `"${target}" is linked as partner by both ${named[0]} and ${named[1]} — one person can only appear in one couple`,
        });
      } else {
        const list = `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
        errors.push({
          message: `"${target}" is linked as partner by ${list} — one person can only appear in one couple`,
        });
      }
      continue;
    }
    const targetRow = byId.get(target);
    if (targetRow && targetRow.partnerId && targetRow.partnerId !== claimants[0].id) {
      errors.push({
        message: `conflicting partner links: "${claimants[0].id}" (row ${claimants[0].rowNumber}) → "${target}", but "${target}" (row ${targetRow.rowNumber}) → "${targetRow.partnerId}"`,
      });
    }
  }

  // implicit unions: every explicit partner pair AND every 2-person ParentIDs pair form the
  // same kind of union the model builder will create; a 1-person ParentIDs entry forms a
  // lone-parent union. Pairs are keyed by sorted ids so an explicit "a" -> partner "b" and a
  // child's ParentIDs "a;b" are recognized as the SAME union, not a conflict. A person may
  // belong to at most one union (couple or lone-parent) — appearing in 2+ distinct unions means
  // the model builder's last-write-wins map will silently drop one of that person's branches.
  interface UnionEntry {
    partners: string[]; // 2 ids for a couple, 1 id for a lone-parent union
    row: number; // the row that established this union (first one seen, sheet order)
    via: 'partner' | 'parentIds';
  }
  const unions = new Map<string, UnionEntry>();

  for (const row of rows) {
    if (row.partnerId && row.partnerId !== row.id && byId.has(row.partnerId)) {
      const pair = [row.id, row.partnerId].sort();
      const key = pair.join('|');
      if (!unions.has(key)) unions.set(key, { partners: pair, row: row.rowNumber, via: 'partner' });
    }
  }
  for (const row of rows) {
    if (row.parentIds.length === 2 && row.parentIds.every((p) => byId.has(p))) {
      const pair = [...row.parentIds].sort();
      const key = pair.join('|');
      if (!unions.has(key)) unions.set(key, { partners: pair, row: row.rowNumber, via: 'parentIds' });
    }
  }
  for (const row of rows) {
    if (row.parentIds.length === 1 && byId.has(row.parentIds[0])) {
      const key = `lone:${row.parentIds[0]}`;
      if (!unions.has(key)) unions.set(key, { partners: [row.parentIds[0]], row: row.rowNumber, via: 'parentIds' });
    }
  }

  const unionsByPerson = new Map<string, UnionEntry[]>();
  for (const entry of unions.values()) {
    for (const person of entry.partners) {
      unionsByPerson.set(person, [...(unionsByPerson.get(person) ?? []), entry]);
    }
  }

  const describeUnion = (person: string, entry: UnionEntry): string => {
    if (entry.partners.length === 1) return `as a lone parent (via ParentIDs on row ${entry.row})`;
    const other = entry.partners.find((p) => p !== person) ?? person;
    return entry.via === 'partner' ? `with "${other}" (row ${entry.row})` : `with "${other}" (via ParentIDs on row ${entry.row})`;
  };

  for (const [person, entries] of unionsByPerson) {
    if (entries.length <= 1) continue;
    const sorted = [...entries].sort((x, y) => x.row - y.row);
    const parts = sorted.map((entry) => describeUnion(person, entry));
    const list = parts.length === 2 ? `${parts[0]} and ${parts[1]}` : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    const countWord = entries.length === 2 ? 'two' : String(entries.length);
    errors.push({
      message: `"${person}" appears in ${countWord} unions: ${list} — one person can only belong to one union at a time`,
    });
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
        const cycleRow = byId.get(id)?.rowNumber;
        errors.push({
          message: `Ancestry cycle detected involving "${id}" (row ${cycleRow}) — someone is their own ancestor`,
        });
        break;
      }
    }
  }

  return { errors, warnings };
}
