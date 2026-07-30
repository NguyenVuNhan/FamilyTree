import Papa from 'papaparse';
import type { Issue, PersonRow } from './types';

export class UnreadableSheetError extends Error {
  constructor() {
    super('The data could not be read as a family sheet (no "Image" column found in the header row)');
    this.name = 'UnreadableSheetError';
  }
}

export interface ParseResult {
  rows: PersonRow[];
  errors: Issue[];
  warnings: Issue[];
}

// '+' or en-dash split a cell into "Name <sep> Partner". A plain hyphen is NOT a
// separator — it may legitimately appear inside a name (e.g. "Mai-Anh").
const SEPARATORS = ['+', '–'];

interface GenColumn {
  index: number; // column position in the sheet
  label: string; // header text, quoted verbatim in user-facing messages
}

export function parseStaircase(text: string): ParseResult {
  const table = Papa.parse<string[]>(text, { skipEmptyLines: false }).data;
  if (table.length === 0) throw new UnreadableSheetError();

  // Reserved columns are matched by NAME, not position, so a generation column
  // added to the right of Image/PartnerImage still works. Depth is the
  // left-to-right order among generation columns — unbounded by design.
  let imageIdx = -1;
  let partnerImageIdx = -1;
  let genderIdx = -1;
  let partnerGenderIdx = -1;
  const genCols: GenColumn[] = [];
  table[0].forEach((raw, index) => {
    const label = (raw ?? '').trim();
    const key = label.toLowerCase();
    if (key === 'image') imageIdx = index;
    else if (key === 'partnerimage') partnerImageIdx = index;
    else if (key === 'gender') genderIdx = index;
    else if (key === 'partnergender') partnerGenderIdx = index;
    else if (label !== '') genCols.push({ index, label });
  });
  if (imageIdx === -1 || genCols.length === 0) throw new UnreadableSheetError();

  const rows: PersonRow[] = [];
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  // stack[d] = ids of the most recent valid row at generation depth d (0-based).
  // A row at depth d attaches to stack[d-1] and truncates everything deeper.
  const stack: Array<{ personId: string; partnerId: string }> = [];

  for (let i = 1; i < table.length; i++) {
    const rowNumber = i + 1; // sheet rows are 1-based; row 1 is the header
    const cells = table[i].map((c) => (c ?? '').trim());
    const at = (index: number) => cells[index] ?? '';
    const image = at(imageIdx);
    const partnerImage = partnerImageIdx === -1 ? '' : at(partnerImageIdx);
    // Gender cells are soft metadata: stray values on spacing or partner-less
    // rows are ignored; unrecognized values get a validate-level warning.
    const gender = genderIdx === -1 ? '' : at(genderIdx);
    const partnerGender = partnerGenderIdx === -1 ? '' : at(partnerGenderIdx);

    const filled = genCols.filter((g) => at(g.index) !== '');
    if (filled.length === 0) {
      if (image || partnerImage) {
        warnings.push({ row: rowNumber, message: `Row ${rowNumber} has an image but no person — the image is ignored` });
      }
      continue; // spacing row
    }
    if (filled.length > 1) {
      errors.push({
        row: rowNumber,
        message: `Row ${rowNumber} has people in both "${filled[0].label}" and "${filled[1].label}" — each row should use exactly one generation column`,
      });
      continue;
    }

    const depth = genCols.indexOf(filled[0]);
    if (depth > stack.length) {
      errors.push({
        row: rowNumber,
        message:
          stack.length === 0
            ? `Row ${rowNumber} is in "${filled[0].label}" but the tree must start in "${genCols[0].label}"`
            : `Row ${rowNumber} is in "${filled[0].label}" but the row above it is in "${genCols[stack.length - 1].label}" — did you mean "${genCols[stack.length].label}"?`,
      });
      continue;
    }

    const cellText = at(filled[0].index);
    let sepPos = -1;
    for (const sep of SEPARATORS) {
      const found = cellText.indexOf(sep);
      if (found !== -1 && (sepPos === -1 || found < sepPos)) sepPos = found;
    }
    const fullName = (sepPos === -1 ? cellText : cellText.slice(0, sepPos)).trim();
    const partnerName = sepPos === -1 ? '' : cellText.slice(sepPos + 1).trim();
    if (!fullName) {
      errors.push({ row: rowNumber, message: `Row ${rowNumber} is missing the person's name before the "${cellText[sepPos]}"` });
      continue;
    }

    const personId = `r${rowNumber}`;
    const partnerId = partnerName ? `${personId}p` : '';
    const parent = depth === 0 ? undefined : stack[depth - 1];
    const parentIds = parent ? [parent.personId, parent.partnerId].filter(Boolean) : [];

    rows.push({ rowNumber, id: personId, fullName, image, gender, partnerId, parentIds });
    if (partnerId) {
      rows.push({ rowNumber, id: partnerId, fullName: partnerName, image: partnerImage, gender: partnerGender, partnerId: '', parentIds: [] });
    } else if (partnerImage) {
      warnings.push({ row: rowNumber, message: `Row ${rowNumber} has a partner image but no partner — the image is ignored` });
    }

    stack.length = depth;
    stack.push({ personId, partnerId });
  }

  return { rows, errors, warnings };
}
