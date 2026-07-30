import { useEffect, useState } from 'react';
import { DEMO_KEY, type Family } from '../config/families';
import type { FamilyModel, Issue } from '../data/types';
import { parseStaircase, UnreadableSheetError } from '../data/staircase-parser';
import { validateRows } from '../data/validate';
import { buildModel } from '../data/build-model';
import { families } from '../config';

export type DataState =
  | { status: 'loading' }
  | { status: 'ready'; model: FamilyModel; warnings: Issue[]; source: 'live' | 'fallback'; fallbackReason?: 'no-config' | 'load-failed' | 'unreadable' }
  | { status: 'invalid'; errors: Issue[] }
  | { status: 'empty' };

function process(text: string): DataState {
  const { rows, errors, warnings: parseWarnings } = parseStaircase(text);
  if (errors.length > 0) return { status: 'invalid', errors };
  if (rows.length === 0) return { status: 'empty' };
  const imageWarnings = validateRows(rows);
  const warnings = [...parseWarnings, ...imageWarnings];
  const model = buildModel(rows);
  if (model.excludedIds.length > 0) {
    // synthetic ids (r5, r5p) must never reach the user — list display names
    const nameOf = new Map(rows.map((r) => [r.id, r.fullName]));
    warnings.push({
      message: `Not connected to the main family and not shown: ${model.excludedIds.map((id) => nameOf.get(id) ?? id).join(', ')}`,
    });
  }
  return { status: 'ready', model, warnings, source: 'live' };
}

export function useFamilyData(family: Family, isOnlyDemo: boolean): DataState {
  const [state, setState] = useState<DataState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const done = (s: DataState) => { if (alive) setState(s); };
    (async () => {
      let reason: 'load-failed' | 'unreadable';
      try {
        const res = await fetch(family.csvUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = process(await res.text());
        if (result.status === 'ready' && family.key === DEMO_KEY && isOnlyDemo) {
          return done({ ...result, source: 'fallback', fallbackReason: 'no-config' });
        }
        return done(result);
      } catch (e) {
        reason = e instanceof UnreadableSheetError ? 'unreadable' : 'load-failed';
      }
      try {
        const demoUrl = families.find((f) => f.key === DEMO_KEY)!.csvUrl; // demo always exists
        const result = process(await (await fetch(demoUrl)).text());
        if (result.status === 'ready') return done({ ...result, source: 'fallback', fallbackReason: reason });
        return done(result);
      } catch {
        return done({ status: 'invalid', errors: [{ message: 'Could not load any family data.' }] });
      }
    })();
    return () => { alive = false; };
  }, [family.key, family.csvUrl, isOnlyDemo]);

  return state;
}
