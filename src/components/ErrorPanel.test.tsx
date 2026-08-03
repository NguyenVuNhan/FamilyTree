import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorPanel } from './ErrorPanel';

describe('ErrorPanel', () => {
  it('defaults keep the sheet-problems copy', () => {
    render(<ErrorPanel errors={[{ message: 'Row 3 is wrong' }]} />);
    expect(screen.getByTestId('error-panel')).toHaveTextContent('The family sheet has problems');
    expect(screen.getByTestId('error-panel')).toHaveTextContent('Fix these in the spreadsheet, then refresh:');
    expect(screen.getByText('Row 3 is wrong')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('custom title/hint and demo link for link-level failures', () => {
    render(<ErrorPanel title="This link doesn't work" hint="Check the link you were given." demoLink
      errors={[{ message: 'Tree links must point at an https:// address.' }]} />);
    expect(screen.getByRole('heading', { name: "This link doesn't work" })).toBeInTheDocument();
    expect(screen.getByText('Check the link you were given.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /demo family/i })).toHaveAttribute('href', '?family=demo');
  });
});
