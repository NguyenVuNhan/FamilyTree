import { describe, expect, it } from 'vitest';
import { resolveImage } from './image-source';

// 1×1 px valid base64 payloads (headers matter, bodies are real image bytes)
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const JPEG_B64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';

describe('resolveImage', () => {
  it('empty → none', () => {
    expect(resolveImage('')).toEqual({ kind: 'none' });
  });

  it('http(s) URL → src as-is', () => {
    expect(resolveImage('https://x.test/p.jpg')).toEqual({ kind: 'src', src: 'https://x.test/p.jpg' });
    expect(resolveImage('http://x.test/p.jpg')).toEqual({ kind: 'src', src: 'http://x.test/p.jpg' });
  });

  it('data URI → src as-is', () => {
    const uri = `data:image/png;base64,${PNG_B64}`;
    expect(resolveImage(uri)).toEqual({ kind: 'src', src: uri });
  });

  it('raw base64 sniffed: PNG (iVBOR), JPEG (/9j/), GIF (R0lGOD), WebP (UklGR)', () => {
    expect(resolveImage(PNG_B64)).toEqual({ kind: 'src', src: `data:image/png;base64,${PNG_B64}` });
    expect(resolveImage(JPEG_B64)).toEqual({ kind: 'src', src: `data:image/jpeg;base64,${JPEG_B64}` });
    expect(resolveImage('R0lGODlhAQABAAAAACw=')).toEqual({ kind: 'src', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
    expect(resolveImage('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==')).toEqual({
      kind: 'src', src: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
    });
  });

  it('unrecognized magic or non-base64 garbage → invalid', () => {
    expect(resolveImage('AAAAaGVsbG8=')).toEqual({ kind: 'invalid' }); // valid base64, unknown magic
    expect(resolveImage('not base64 at all!!')).toEqual({ kind: 'invalid' });
    expect(resolveImage('ftp://x.test/p.jpg')).toEqual({ kind: 'invalid' });
  });
});
