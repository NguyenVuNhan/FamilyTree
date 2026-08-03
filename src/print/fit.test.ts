import { describe, expect, it } from 'vitest';
import { checkFit } from './fit';

describe('checkFit (legibility beats fit — spec §Error handling 2)', () => {
  it('fits when content + 2·margin ≤ format on both axes', () => {
    expect(checkFit(1000, 400, { wMm: 1200, hMm: 600 }, 60)).toEqual({ ok: true });
    expect(checkFit(1081, 400, { wMm: 1200, hMm: 600 }, 60).ok).toBe(false); // 1081+120 > 1200
  });
  it('refusal carries required size in mm and an actionable cm message', () => {
    const r = checkFit(1000, 900, { wMm: 900, hMm: 900 }, 50);
    expect(r).toMatchObject({ ok: false, requiredWmm: 1100, requiredHmm: 1000 });
    if (!r.ok) expect(r.message).toContain('110×100 cm');
  });
});
