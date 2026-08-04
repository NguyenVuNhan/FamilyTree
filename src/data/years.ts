export interface ExtractedYears {
  cleanName: string;
  birthYear?: number;
  deathYear?: number;
}

// Trailing "(...)" whose inner text is a year expression: "1950", "1950–2001",
// "1950-2001", "1950–", "–2001". At least one 4-digit year required; anything
// else is just part of the name (spec §Schema: no "invalid year" error state).
const TRAILING_PARENS = /^(.*?)\s*\(([^()]*)\)$/;
const YEAR_EXPR = /^(?:(\d{4})\s*[–-]?\s*(\d{4})?|[–-]\s*(\d{4}))$/;

export function extractYears(segment: string): ExtractedYears {
  const m = TRAILING_PARENS.exec(segment.trim());
  if (m) {
    const y = YEAR_EXPR.exec(m[2].trim());
    if (y) {
      const birthYear = y[1] ? Number(y[1]) : undefined;
      const deathYear = y[2] ? Number(y[2]) : y[3] ? Number(y[3]) : undefined;
      return {
        cleanName: m[1].trim(),
        ...(birthYear !== undefined ? { birthYear } : {}),
        ...(deathYear !== undefined ? { deathYear } : {}),
      };
    }
  }
  return { cleanName: segment.trim() };
}

export function formatYears(birthYear?: number, deathYear?: number): string | null {
  if (birthYear !== undefined && deathYear !== undefined) return `${birthYear}–${deathYear}`;
  if (birthYear !== undefined) return `b. ${birthYear}`;
  if (deathYear !== undefined) return `d. ${deathYear}`;
  return null;
}
