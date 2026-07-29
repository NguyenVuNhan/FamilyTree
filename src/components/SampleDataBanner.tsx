const COPY = {
  'no-config': 'Showing sample data — no family sheets are configured.',
  'load-failed': "Couldn't load the live family data — showing sample data instead.",
  unreadable: "The live data couldn't be read — showing sample data instead.",
} as const;

export function SampleDataBanner({ reason, onDismiss }: { reason: keyof typeof COPY; onDismiss: () => void }) {
  return (
    <div data-testid="sample-banner" className="sample-banner">
      <span>{COPY[reason]}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}
