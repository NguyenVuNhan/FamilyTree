const MALE = new Set(['m', 'male', 'nam']);
const FEMALE = new Set(['f', 'female', 'nữ', 'nu']);

/** Case-insensitive; English + Vietnamese values. Unrecognized → undefined (validator warns). */
export function parseGender(raw: string): 'male' | 'female' | undefined {
  const v = raw.trim().toLowerCase();
  if (MALE.has(v)) return 'male';
  if (FEMALE.has(v)) return 'female';
  return undefined;
}
