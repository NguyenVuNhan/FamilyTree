import type { TextMeasurer } from '../layout/name-metrics';

/** Greedy word wrap returning the actual lines (never-truncate invariant:
 *  every character of the name appears in some line). Mirrors name-metrics
 *  lineCount semantics: words fill lines; an over-wide word breaks per char. */
export function wrapName(name: string, maxWidth: number, measure: TextMeasurer): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    while (measure(current) > maxWidth && current.length > 1) {
      let fit = current.length - 1;
      while (fit > 1 && measure(current.slice(0, fit)) > maxWidth) fit--;
      lines.push(current.slice(0, fit));
      current = current.slice(fit);
    }
  }
  lines.push(current);
  return lines;
}
