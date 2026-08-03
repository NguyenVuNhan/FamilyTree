import { isAllowedSrc, PUBLISH_ID_RE, type SourceTarget } from './source';

export type ParsedInput = SourceTarget | { type: 'invalid'; reason: 'empty' | 'edit-url' | 'insecure' | 'not-a-link' };

const PUBLISH_PATH_RE = /\/d\/e\/(2PACX-[A-Za-z0-9_-]{20,})/;

/** Forgiving parser for the load dialog: accepts a published-sheet link in any
 *  form (pub?output=csv, pubhtml, ± gid), a bare publish ID, or any https CSV URL. */
export function parseSheetInput(raw: string): ParsedInput {
  const text = raw.trim();
  if (!text) return { type: 'invalid', reason: 'empty' };
  if (PUBLISH_ID_RE.test(text)) return { type: 'sheet', id: text };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { type: 'invalid', reason: 'not-a-link' };
  }

  if (url.hostname === 'docs.google.com') {
    const match = PUBLISH_PATH_RE.exec(url.pathname);
    if (!match) return { type: 'invalid', reason: 'edit-url' }; // /d/<id>/edit etc. — not published
    const gidRaw = url.searchParams.get('gid');
    const gid = gidRaw !== null && /^\d+$/.test(gidRaw) ? Number(gidRaw) || undefined : undefined;
    return { type: 'sheet', id: match[1], gid };
  }
  if (isAllowedSrc(text)) return { type: 'src', url: text };
  return { type: 'invalid', reason: url.protocol === 'http:' ? 'insecure' : 'not-a-link' };
}
