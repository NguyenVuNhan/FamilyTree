import { describe, expect, it, vi } from 'vitest';
import { buildExportSvg, collectFontCss, downloadSvg, exportFilename } from './export';
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
  const opts = { wMm: 1200, hMm: 600, marginMm: 60, fontCss: '@font-face{}', background: '#F5EBDC' };
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
  it('creates a Blob URL, clicks a synthetic anchor, then revokes the URL', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadSvg('<svg/>', 'tree.svg');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  });
});
