import Papa from 'papaparse';
import type { PersonRow } from './types';

export class UnreadableCsvError extends Error {
  constructor() {
    super('The data could not be read as a family sheet (required columns ID and FullName not found)');
    this.name = 'UnreadableCsvError';
  }
}

export function parseCsv(text: string): PersonRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const headers = result.meta.fields ?? [];
  if (!headers.includes('id') || !headers.includes('fullname')) throw new UnreadableCsvError();

  const rows: PersonRow[] = [];
  result.data.forEach((raw, index) => {
    // Parse all fields
    const id = (raw.id ?? '').trim();
    const fullName = (raw.fullname ?? '').trim();
    const image = (raw.image ?? '').trim();
    const partnerId = (raw.partnerid ?? '').trim();
    const parentIds = (raw.parentids ?? '')
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);

    // Skip fully-empty rows (all fields are empty after trimming)
    if (!id && !fullName && !image && !partnerId && parentIds.length === 0) {
      return;
    }

    // True sheet row number: header is 1, first person is 2, etc.
    // index is 0-based in the data array, so row number is index + 2
    rows.push({
      rowNumber: index + 2,
      id,
      fullName,
      image,
      partnerId,
      parentIds,
    });
  });

  return rows;
}
