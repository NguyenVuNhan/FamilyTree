import { describe, expect, it, vi } from 'vitest';
import { buildExportSvg, buildPanelExportSvg, collectFontCss, downloadSvg, exportFilename, exportPanelFilename } from './export';
import { THEMES } from './themes';

function liveSvg(): SVGSVGElement {
  const host = document.createElement('div');
  host.innerHTML = `<svg class="print-canvas-svg" data-arrangement="flow" width="200" height="100" viewBox="0 0 200 100">
    <style>.pn-name{fill:#000;}</style>
    <rect data-print-role="background" width="200" height="100"/>
    <g data-print-role="guide"><rect/></g>
    <g class="person-node" role="button" tabindex="0" data-person-id="r2" data-generation="0" onclick="x()"><rect/><text class="pn-name">Anh</text></g>
  </svg>`;
  return host.querySelector('svg')!;
}

describe('buildExportSvg', () => {
  const opts = { wMm: 1200, hMm: 600, fontCss: '@font-face{}', background: '#F5EBDC' };
  it('mm dimensions and matching viewBox aspect', () => {
    const out = buildExportSvg(liveSvg(), opts);
    expect(out).toContain('width="1200mm"');
    expect(out).toContain('height="600mm"');
    expect(out).toContain('viewBox="0 0 1200 600"');
  });
  it('strips guide and interactivity, keeps the data contract', () => {
    const out = buildExportSvg(liveSvg(), opts);
    expect(out).not.toContain('data-print-role="guide"');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('tabindex');
    expect(out).toContain('data-person-id="r2"');
    expect(out).toContain('data-generation="0"');
  });
  it('centers content and embeds calibration bar + fonts', () => {
    const out = buildExportSvg(liveSvg(), opts);
    expect(out).toContain('translate(500 250)'); // (1200−200)/2, (600−100)/2
    expect(out).toContain('data-print-role="calibration"');
    expect(out).toContain('h 100');
    expect(out).toContain('@font-face{}');
  });
  it('deterministic: two builds are byte-identical', () => {
    expect(buildExportSvg(liveSvg(), opts)).toBe(buildExportSvg(liveSvg(), opts));
  });
});

describe('collectFontCss', () => {
  it('fetches each font file once and emits base64 @font-face rules', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const css = await collectFontCss(THEMES.indochine, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(THEMES.indochine.fontFiles.length);
    expect(css).toContain('font-family:"Playfair Display"');
    expect(css).toContain('data:font/woff2;base64,AQID');
  });
});

describe('exportFilename', () => {
  it('family-arrangement-theme-WxHcm.svg', () => {
    expect(exportFilename('Nhà Nội', 'flow', 'inkwash', 1200, 600)).toBe('Nhà Nội-flow-inkwash-120x60cm.svg');
  });
});

describe('downloadSvg', () => {
  it('creates a Blob URL, clicks a synthetic anchor, then revokes the URL only after a grace period', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadSvg('<svg/>', 'tree.svg');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // Synchronous revocation races the async download read (CI shipped 2 of 8
    // panel files) — the URL must still be alive immediately after the click.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('per-panel export (PR ③)', () => {
  const PANELS_SVG = `
    <svg class="print-canvas-svg" data-arrangement="panels" viewBox="0 0 244 96">
      <style>.pn-name{fill:#111;}</style>
      <rect data-print-role="background" width="244" height="96" fill="#eee"/>
      <g class="print-panel" data-panel-label="master" data-panel-w="100" data-panel-h="86">
        <g data-print-role="guide"><rect width="10" height="10"/></g>
        <g class="person-node" role="button" tabindex="0" data-person-id="a"><text class="pn-name">A</text></g>
      </g>
      <g class="print-panel" data-panel-label="II" data-panel-w="120" data-panel-h="96" transform="translate(124 0)">
        <g class="person-node" role="button" tabindex="0" data-person-id="g"><text class="pn-name">G</text></g>
      </g>
    </svg>`;
  const host = () => {
    document.body.innerHTML = PANELS_SVG;
    return document.querySelector<SVGSVGElement>('svg.print-canvas-svg')!;
  };

  it('extracts exactly one panel, strips its composition offset, and produces an mm-true page', () => {
    const out = buildPanelExportSvg(host(), 'II', { wMm: 1200, hMm: 600, fontCss: '', background: '#eee' });
    expect(out).toContain('width="1200mm"');
    expect(out).toContain('height="600mm"');
    expect(out).toContain('data-person-id="g"');
    expect(out).not.toContain('data-person-id="a"');           // the other panel stays out
    expect(out).not.toContain('translate(124 0)');             // composition offset is screen-only
    expect(out).toContain('.pn-name{fill:#111;}');             // scene style rides along
    expect(out).toContain('h 100');                            // calibration bar per page
    expect(out).not.toContain('tabindex');                     // interactivity stripped by buildExportSvg
  });

  it('removes per-panel guides and is deterministic', () => {
    const a = buildPanelExportSvg(host(), 'master', { wMm: 1200, hMm: 600, fontCss: '', background: '#eee' });
    const b = buildPanelExportSvg(host(), 'master', { wMm: 1200, hMm: 600, fontCss: '', background: '#eee' });
    expect(a).toBe(b);
    expect(a).not.toContain('data-print-role="guide"');
  });

  it('throws loudly on an unknown panel label (never a silent empty page)', () => {
    expect(() => buildPanelExportSvg(host(), 'IX', { wMm: 1200, hMm: 600, fontCss: '', background: '#eee' }))
      .toThrow(/no panel labeled "IX"/);
  });

  it('exportPanelFilename carries n-of-N and cm dimensions', () => {
    expect(exportPanelFilename('Nhà Nội', 'botanical', 2, 3, 400, 600))
      .toBe('Nhà Nội-panels-botanical-2of3-40x60cm.svg');
  });
});
