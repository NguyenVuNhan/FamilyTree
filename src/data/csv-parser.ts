import Papa from 'papaparse';
import type { PersonRow } from './types';

export class UnreadableCsvError extends Error {
  constructor() {
    super('The data could not be read as a family sheet (required columns ID and FullName not found)');
  }
}

export function parseCsv(text: string): PersonRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const headers = result.meta.fields ?? [];
  if (!headers.includes('id') || !headers.includes('fullname')) throw new UnreadableCsvError();

  return result.data.map((raw, i) => ({
    rowNumber: i + 2,
    id: (raw.id ?? '').trim(),
    fullName: (raw.fullname ?? '').trim(),
    image: (raw.image ?? '').trim(),
    partnerId: (raw.partnerid ?? '').trim(),
    parentIds: (raw.parentids ?? '')
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean),
  }));
}
