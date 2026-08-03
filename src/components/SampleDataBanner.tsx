// src/components/SampleDataBanner.tsx
export function SampleDataBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div data-testid="sample-banner" className="sample-banner">
      <span>Showing sample data — this is the built-in demo family.</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}
