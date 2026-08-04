// src/components/use-family-data.ts
import { useEffect, useState } from 'react';
import type { FamilyModel, Issue } from '../data/types';
import { parseStaircase, UnreadableSheetError } from '../data/staircase-parser';
import { validateRows } from '../data/validate';
import { buildModel } from '../data/build-model';

export type DataState =
  | { status: 'loading' }
  | { status: 'ready'; model: FamilyModel; warnings: Issue[] }
  | { status: 'invalid'; errors: Issue[] }
  | { status: 'empty' }
  | { status: 'failed'; reason: 'load-failed' | 'unreadable' };

function process(text: string): DataState {
  const { rows, errors, warnings: parseWarnings } = parseStaircase(text);
  if (errors.length > 0) return { status: 'invalid', errors };
  if (rows.length === 0) return { status: 'empty' };
  const imageWarnings = validateRows(rows);
  const warnings = [...parseWarnings, ...imageWarnings];
  const model = buildModel(rows);
  if (model.excludedIds.length > 0) {
    // synthetic ids (r5, r5p) must never reach the user — model.excludedNames already
    // carries display names in the same order (captured in build-model.ts before it
    // deletes these people from `persons`) — the same names App.tsx's export-block
    // reason uses, so there's one source of truth instead of two name lookups.
    warnings.push({ message: `Not connected to the main family and not shown: ${model.excludedNames.join(', ')}` });
  }
  return { status: 'ready', model, warnings };
}

/** Fetches and parses exactly the given CSV URL. Explicit sources never fall
 *  back to demo data — a failure is reported as `failed` and rendered honestly. */
export function useFamilyData(csvUrl: string): DataState {
  const [state, setState] = useState<DataState>({ status: 'loading' });
  // Reset to loading during render (not inside the effect) when csvUrl changes,
  // per React's "adjusting state when a prop changes" pattern — avoids a
  // synchronous setState-in-effect that would cascade an extra commit.
  const [loadedFor, setLoadedFor] = useState(csvUrl);
  if (csvUrl !== loadedFor) {
    setLoadedFor(csvUrl);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      let next: DataState;
      try {
        const res = await fetch(csvUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        next = process(await res.text());
      } catch (e) {
        next = { status: 'failed', reason: e instanceof UnreadableSheetError ? 'unreadable' : 'load-failed' };
      }
      if (alive) setState(next);
    })();
    return () => { alive = false; };
  }, [csvUrl]);

  return state;
}
