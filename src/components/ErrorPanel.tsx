import type { Issue } from '../data/types';

export function ErrorPanel({ errors }: { errors: Issue[] }) {
  return (
    <section role="alert" data-testid="error-panel" className="error-panel">
      <h2>The family sheet has problems</h2>
      <p>Fix these in the spreadsheet, then refresh:</p>
      <ul>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>
    </section>
  );
}
