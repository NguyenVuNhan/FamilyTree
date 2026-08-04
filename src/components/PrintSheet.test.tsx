import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrintSheet } from './PrintSheet';

describe('PrintSheet', () => {
  it('hidden on screen; fills with composed SVG and @page rule on beforeprint', () => {
    document.body.innerHTML = `<svg class="print-canvas-svg" width="100" height="50" viewBox="0 0 100 50"><style></style><rect data-print-role="background"/></svg>`;
    render(<PrintSheet svgSelector=".print-canvas-svg" wMm={1200} hMm={600} background="#FBFAF7" />);
    const sheet = screen.getByTestId('print-sheet');
    expect(sheet.innerHTML).toBe('');
    window.dispatchEvent(new Event('beforeprint'));
    expect(sheet.querySelector('svg')!.getAttribute('width')).toBe('1200mm');
    expect(document.getElementById('print-page')!.textContent).toContain('@page { size: 1200mm 600mm; margin: 0 }');
  });

  it('removes the injected #print-page style on unmount, so switching to another arrangement never inherits a stale @page size', () => {
    document.body.innerHTML = `<svg class="print-canvas-svg" width="100" height="50" viewBox="0 0 100 50"><style></style><rect data-print-role="background"/></svg>`;
    const { unmount } = render(<PrintSheet svgSelector=".print-canvas-svg" wMm={1200} hMm={600} background="#FBFAF7" />);
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.getElementById('print-page')).not.toBeNull();
    unmount();
    expect(document.getElementById('print-page')).toBeNull();
  });
});
