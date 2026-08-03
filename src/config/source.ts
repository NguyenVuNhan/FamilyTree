export const PUBLISH_ID_RE = /^2PACX-[A-Za-z0-9_-]{20,}$/;
export const FALLBACK_TITLE = 'Family Tree';

export type SourceTarget = { type: 'sheet'; id: string; gid?: number } | { type: 'src'; url: string };

export interface ResolvedSource {
  kind: 'demo' | 'sheet' | 'src';
  csvUrl: string;
  displayName: string;
  /** layout-settings identity (settings.ts prefixes it with ft:layout:) */
  settingsKey: string;
  /** canonical query string including name — the shareable link's search part */
  canonicalSearch: string;
  /** canonical search minus name — saved-families identity; null = never saved (demo) */
  registryKey: string | null;
}

export type Resolution =
  | { status: 'source'; source: ResolvedSource }
  | { status: 'none' }
  | { status: 'error'; message: string };

export const RESOLVE_ERRORS = {
  sheetId: 'The sheet ID in this link is not a Google publish ID (it should start with "2PACX-").',
  gid: 'The "gid" part of this link must be a number.',
  srcNotHttps: 'Tree links must point at an https:// address.',
  unknownFamily: 'There is no family tree at this address.',
} as const;

export function sheetCsvUrl(id: string, gid?: number): string {
  return `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv${gid ? `&gid=${gid}` : ''}`;
}

export function buildSearch(target: SourceTarget, name?: string): string {
  const params = new URLSearchParams();
  if (target.type === 'sheet') {
    params.set('sheet', target.id);
    if (target.gid) params.set('gid', String(target.gid));
  } else {
    params.set('src', target.url);
  }
  if (name) params.set('name', name);
  return `?${params.toString()}`;
}

export function isAllowedSrc(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
}

export function resolveSource(search: string, baseUrl: string): Resolution {
  const params = new URLSearchParams(search);
  const name = params.get('name') ?? undefined;

  const sheet = params.get('sheet');
  if (sheet !== null) {
    if (!PUBLISH_ID_RE.test(sheet)) return { status: 'error', message: RESOLVE_ERRORS.sheetId };
    const gidRaw = params.get('gid');
    if (gidRaw !== null && !/^\d+$/.test(gidRaw)) return { status: 'error', message: RESOLVE_ERRORS.gid };
    const gid = gidRaw !== null ? Number(gidRaw) || undefined : undefined; // 0 → omitted
    return {
      status: 'source',
      source: {
        kind: 'sheet',
        csvUrl: sheetCsvUrl(sheet, gid),
        displayName: name ?? FALLBACK_TITLE,
        settingsKey: `sheet:${sheet}${gid ? `:${gid}` : ''}`,
        canonicalSearch: buildSearch({ type: 'sheet', id: sheet, gid }, name),
        registryKey: buildSearch({ type: 'sheet', id: sheet, gid }),
      },
    };
  }

  const src = params.get('src');
  if (src !== null) {
    if (!isAllowedSrc(src)) return { status: 'error', message: RESOLVE_ERRORS.srcNotHttps };
    return {
      status: 'source',
      source: {
        kind: 'src',
        csvUrl: src,
        displayName: name ?? FALLBACK_TITLE,
        settingsKey: `src:${src}`,
        canonicalSearch: buildSearch({ type: 'src', url: src }, name),
        registryKey: buildSearch({ type: 'src', url: src }),
      },
    };
  }

  const family = params.get('family');
  if (family !== null) {
    if (family.toLowerCase() !== 'demo') return { status: 'error', message: RESOLVE_ERRORS.unknownFamily };
    return {
      status: 'source',
      source: {
        kind: 'demo',
        csvUrl: `${baseUrl}sample-data.csv`,
        displayName: 'Demo Family',
        settingsKey: 'demo',
        canonicalSearch: '?family=demo',
        registryKey: null, // the demo has a permanent dialog link — never saved
      },
    };
  }

  return { status: 'none' };
}
