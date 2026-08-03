export interface SavedFamily {
  /** canonical search minus name — the entry's identity */
  key: string;
  name: string;
  /** canonical search including name — the navigation target */
  search: string;
  savedAt: number;
}

export const REGISTRY_STORAGE_KEY = 'ft:families:v1';

function isSavedFamily(v: unknown): v is SavedFamily {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.key === 'string' && typeof r.name === 'string'
    && typeof r.search === 'string' && typeof r.savedAt === 'number';
}

/** Newest first. Corrupt payloads, wrong versions (different key), and blocked
 *  storage all behave as an empty list — the dialog must keep working without it. */
export function loadSaved(): SavedFamily[] {
  try {
    const text = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!text) return [];
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedFamily).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function write(entries: SavedFamily[]): void {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or blocked — saved families just won't persist
  }
}

export function upsertSaved(entry: { key: string; name: string; search: string }, now = Date.now()): void {
  const rest = loadSaved().filter((f) => f.key !== entry.key);
  write([{ ...entry, savedAt: now }, ...rest]);
}

export function removeSaved(key: string): void {
  write(loadSaved().filter((f) => f.key !== key));
}
