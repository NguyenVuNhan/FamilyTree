import { useEffect, useMemo, useState } from 'react';
import type { PrintMeasurer } from '../layout/flow-layout';
import { canvasMeasurer } from '../layout/name-metrics';
import { THEMES, themeWeights, type ThemeId } from '../print/themes';

/** Flow-scene text metrics. `document.fonts.ready` (the pattern useNameLines relies on)
 *  resolves as soon as ANY font on the page finishes loading — often well before the
 *  theme's title face (e.g. Playfair Display 600) is ever requested, since it's first
 *  requested only once PrintTreeCanvas paints text in it. That would leave F0/F1 capsules
 *  (titleFace, the largest text) measured with fallback-serif metrics forever, letting
 *  glyphs overflow the capsule. Instead, explicitly load the two faces this theme actually
 *  uses and re-measure once they settle; keyed on `theme` so switching themes re-measures
 *  too. Falls back to the old ready-based bump when `fonts.load` isn't available.
 *
 *  Weights come from `themeWeights` (same source themeCss reads for render/export), not
 *  hardcoded 600/500 — inkwash's title face is Charm 700 and botanical's name face is
 *  Source Sans 3 600, so a hardcoded weight here would measure a different weight than
 *  what actually gets drawn, silently invalidating the measured width. */
export function usePrintMeasure(theme: ThemeId): PrintMeasurer {
  const [gen, setGen] = useState(0);
  useEffect(() => {
    let alive = true;
    const bump = () => { if (alive) setGen((n) => n + 1); };
    const { titleFamily, nameFamily } = THEMES[theme];
    const { title: titleWeight, name: nameWeight } = themeWeights(THEMES[theme]);
    const fonts = document.fonts;
    if (fonts?.load) {
      // Best-effort: even a rejected/partial load still bumps once settled, so a missing
      // font file degrades to fallback metrics instead of never re-measuring at all.
      Promise.all([
        fonts.load(`${titleWeight} 12px ${titleFamily}`),
        fonts.load(`${nameWeight} 12px ${nameFamily}`),
      ]).then(bump, bump);
    } else {
      fonts?.ready.then(bump);
    }
    return () => { alive = false; };
  }, [theme]);
  return useMemo(() => {
    void gen; // re-measure trigger once the theme's faces are loaded
    const { titleFamily, nameFamily } = THEMES[theme];
    const { title: titleWeight, name: nameWeight } = themeWeights(THEMES[theme]);
    return (text: string, fontMm: number, titleFace: boolean) =>
      canvasMeasurer(`${titleFace ? titleWeight : nameWeight} ${fontMm}px ${titleFace ? titleFamily : nameFamily}`)(text);
  }, [theme, gen]);
}
