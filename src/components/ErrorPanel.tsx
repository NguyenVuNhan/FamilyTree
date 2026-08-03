import type { Issue } from '../data/types';

export function ErrorPanel({
  errors,
  title = 'The family sheet has problems',
  hint = 'Fix these in the spreadsheet, then refresh:',
  demoLink = false,
}: {
  errors: Issue[];
  title?: string;
  hint?: string;
  demoLink?: boolean;
}) {
  return (
    <section role="alert" data-testid="error-panel" className="error-panel">
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
      <ul>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>
      {demoLink && <p><a href="?family=demo">View the demo family instead</a></p>}
    </section>
  );
}
