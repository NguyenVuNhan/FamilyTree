export type ResolvedImage = { kind: 'none' } | { kind: 'invalid' } | { kind: 'src'; src: string };

const MAGIC: Array<[prefix: string, mime: string]> = [
  ['iVBOR', 'image/png'],
  ['/9j/', 'image/jpeg'],
  ['R0lGOD', 'image/gif'],
  ['UklGR', 'image/webp'],
];

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function resolveImage(value: string): ResolvedImage {
  if (!value) return { kind: 'none' };
  if (/^https?:\/\//i.test(value)) return { kind: 'src', src: value };
  if (value.startsWith('data:image/')) return { kind: 'src', src: value };
  if (BASE64_RE.test(value)) {
    const magic = MAGIC.find(([prefix]) => value.startsWith(prefix));
    if (magic) return { kind: 'src', src: `data:${magic[1]};base64,${value}` };
  }
  return { kind: 'invalid' };
}
