import { useEffect, useMemo, useState } from 'react';
import { nameTextWidth } from '../layout/card-metrics';
import { canvasMeasurer, maxNameLines } from '../layout/name-metrics';
import type { LayoutSettings } from '../settings/settings';

/** Must match .person-name in index.css (weight size family). */
export const NAME_FONT = '600 13.5px "Be Vietnam Pro", Inter, system-ui, sans-serif';

/** Max wrapped line count across the family for the current settings.
 *  Measures immediately (fallback font), then once more when the real font
 *  is ready — worst case a brief reflow, never a clipped name. */
export function useNameLines(names: string[], settings: LayoutSettings): number {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) setFontsReady(true); });
    return () => { alive = false; };
  }, []);
  return useMemo(() => {
    void fontsReady; // re-measure trigger once Be Vietnam Pro is loaded
    return maxNameLines(names, nameTextWidth(settings), canvasMeasurer(NAME_FONT));
  }, [names, settings, fontsReady]);
}
