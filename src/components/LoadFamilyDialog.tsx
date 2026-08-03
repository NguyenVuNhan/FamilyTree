import { useState } from 'react';
import { parseSheetInput } from '../config/parse-sheet-input';
import { buildSearch } from '../config/source';
import { removeSaved, type SavedFamily } from '../config/registry';

const INVALID_COPY = {
  empty: 'Paste a link to your published sheet first.',
  'edit-url': "This looks like the sheet's editing link. In Google Sheets choose File → Share → Publish to web, pick \"Comma-separated values (.csv)\", and paste that link instead.",
  insecure: 'Links must start with https://.',
  'not-a-link': "This doesn't look like a link. Paste your published Google Sheet link or any https:// CSV link.",
} as const;

/** Secondary text so unnamed entries stay distinguishable in the saved list. */
function subtitleFor(search: string): string {
  const params = new URLSearchParams(search);
  const sheet = params.get('sheet');
  if (sheet) return `Google Sheet ${sheet.slice(0, 14)}…`;
  const src = params.get('src');
  if (src) {
    try {
      return new URL(src).host;
    } catch {
      return src;
    }
  }
  return search;
}

export function LoadFamilyDialog({ saved: initialSaved, navigate }: {
  saved: SavedFamily[];
  navigate: (search: string) => void;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSheetInput(link);
    if (parsed.type === 'invalid') return setError(INVALID_COPY[parsed.reason]);
    navigate(buildSearch(parsed, name.trim() || undefined));
  };

  const remove = (key: string) => {
    removeSaved(key);
    setSaved((cur) => cur.filter((f) => f.key !== key));
  };

  return (
    <div className="load-dialog-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="load-dialog-title" data-testid="load-dialog" className="load-dialog">
        <h1 id="load-dialog-title">Family Tree</h1>
        <p>Paste the link to your family's published Google Sheet — or any CSV link — to see it as a tree.</p>
        {saved.length > 0 && (
          <ul data-testid="saved-families" className="saved-families">
            {saved.map((f) => (
              <li key={f.key}>
                <button type="button" className="saved-family" aria-label={f.name} onClick={() => navigate(f.search)}>
                  <strong>{f.name}</strong>
                  <span>{subtitleFor(f.search)}</span>
                </button>
                <button type="button" aria-label={f.name.split(' ').length > 1 ? `Remove (${f.key})` : `Remove ${f.name}`} onClick={() => remove(f.key)}>×</button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submit}>
          <label>
            Sheet link
            <input
              data-testid="link-input"
              value={link}
              autoFocus
              placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?output=csv"
              onChange={(e) => { setLink(e.target.value); setError(null); }}
            />
          </label>
          <label>
            Family name <span className="optional">(optional)</span>
            <input data-testid="name-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p role="alert" data-testid="link-input-error">{error}</p>}
          <button type="submit" className="primary">View the tree</button>
        </form>
        <p className="demo-hint"><a href="?family=demo">…or view the demo family</a></p>
      </section>
    </div>
  );
}
