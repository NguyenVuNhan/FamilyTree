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

describe('multi-page panels sheet (PR ③)', () => {
  it('composes one break-after page per panel label and sizes @page to the per-panel format', () => {
    document.body.innerHTML = `
      <svg class="print-canvas-svg" viewBox="0 0 244 96">
        <style></style>
        <g class="print-panel" data-panel-label="master" data-panel-w="100" data-panel-h="86"></g>
        <g class="print-panel" data-panel-label="II" data-panel-w="120" data-panel-h="96" transform="translate(124 0)"></g>
      </svg>`;
    render(<PrintSheet svgSelector=".print-canvas-svg" wMm={400} hMm={600} background="#eee"
      panelLabels={['master', 'II']} />);
    window.dispatchEvent(new Event('beforeprint'));
    const sheet = screen.getByTestId('print-sheet');
    expect(sheet.querySelectorAll('.print-sheet-page')).toHaveLength(2);
    expect(sheet.querySelectorAll('.print-sheet-page svg')).toHaveLength(2);
    const css = document.getElementById('print-page')!.textContent!;
    expect(css).toContain('size: 400mm 600mm');
    expect(css).toContain('.print-sheet-page:not(:last-child) { break-after: page; }');
    expect(css).toContain('.print-sheet svg { width: 400mm; height: 600mm; display: block; }');
  });

  it('removes the injected #print-page style on unmount in the multi-page path too', () => {
    document.body.innerHTML = `
      <svg class="print-canvas-svg" viewBox="0 0 244 96">
        <style></style>
        <g class="print-panel" data-panel-label="master" data-panel-w="100" data-panel-h="86"></g>
        <g class="print-panel" data-panel-label="II" data-panel-w="120" data-panel-h="96" transform="translate(124 0)"></g>
      </svg>`;
    const { unmount } = render(<PrintSheet svgSelector=".print-canvas-svg" wMm={400} hMm={600} background="#eee"
      panelLabels={['master', 'II']} />);
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.getElementById('print-page')).not.toBeNull();
    unmount();
    expect(document.getElementById('print-page')).toBeNull();
  });
});
