export type TextMeasurer = (text: string) => number;

/** Greedy word wrap matching CSS `overflow-wrap: break-word`: words fill lines;
 *  a word wider than the line starts on its own line and breaks per character. */
export function lineCount(name: string, maxWidth: number, measure: TextMeasurer): number {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let lines = 1;
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines++;
    }
    current = word;
    while (measure(current) > maxWidth && current.length > 1) {
      let fit = current.length - 1;
      while (fit > 1 && measure(current.slice(0, fit)) > maxWidth) fit--;
      lines++;
      current = current.slice(fit);
    }
  }
  return lines;
}

export function maxNameLines(names: string[], maxWidth: number, measure: TextMeasurer): number {
  return Math.max(1, ...names.map((n) => lineCount(n, maxWidth, measure)));
}

/** Real-font measurer; jsdom (no canvas 2D) gets a generous 8px/char estimate. */
export function canvasMeasurer(font: string): TextMeasurer {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return (text) => text.length * 8;
  ctx.font = font;
  return (text) => ctx.measureText(text).width;
}
