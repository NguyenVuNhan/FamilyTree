export interface Family {
  key: string;
  displayName: string;
  csvUrl: string;
}

export const DEMO_KEY = 'demo';

const URL_PREFIX = 'FAMILY_TREE_URL_';
const NAME_PREFIX = 'FAMILY_TREE_NAME_';

export function buildFamilies(env: Record<string, string | undefined>, baseUrl: string): Family[] {
  const names = new Set<string>();
  for (const key of Object.keys(env)) {
    if (key.startsWith(URL_PREFIX)) names.add(key.slice(URL_PREFIX.length));
    if (key.startsWith(NAME_PREFIX)) names.add(key.slice(NAME_PREFIX.length));
  }
  const configured: Family[] = [];
  for (const name of names) {
    if (name.toLowerCase() === DEMO_KEY) {
      throw new Error(`"${name}" is a reserved family name — the built-in demo family always exists`);
    }
    const csvUrl = env[URL_PREFIX + name];
    const displayName = env[NAME_PREFIX + name];
    if (!csvUrl) throw new Error(`Incomplete family pair: ${URL_PREFIX + name} is missing`);
    if (!displayName) throw new Error(`Incomplete family pair: ${NAME_PREFIX + name} is missing`);
    configured.push({ key: name.toLowerCase(), displayName, csvUrl });
  }
  configured.sort((a, b) => a.key.localeCompare(b.key));
  return [...configured, { key: DEMO_KEY, displayName: 'Demo Family', csvUrl: `${baseUrl}sample-data.csv` }];
}

export function resolveFamily(families: Family[], param: string | null): Family | undefined {
  if (!param) return families[0];
  const key = param.toLowerCase();
  return families.find((f) => f.key === key);
}
