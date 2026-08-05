// src/components/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSaved, upsertSaved } from '../config/registry';
import { resolveSource, type ResolvedSource } from '../config/source';
import type { Issue } from '../data/types';
import { layoutMetrics } from '../layout/card-metrics';
import { fanLayout } from '../layout/fan-layout';
import { flowLayout, printUnplacedIds, type PrintScene } from '../layout/flow-layout';
import { layoutTree, unplacedIds } from '../layout/layout-engine';
import { panelsLayout, panelsUnplacedIds, type PrintPanels } from '../layout/panels-layout';
import { buildExportSvg, buildPanelExportSvg, collectFontCss, downloadSvg, exportFilename, exportPanelFilename } from '../print/export';
import { TITLE_BLOCK_MM, checkFit, checkPanelsFit } from '../print/fit';
import { formatSizeMm } from '../print/formats';
import { THEMES } from '../print/themes';
import { loadSettings, saveSettings, type LayoutSettings } from '../settings/settings';
import { decodeView, encodeView } from '../settings/view-param';
import { ErrorPanel } from './ErrorPanel';
import { LoadFamilyDialog } from './LoadFamilyDialog';
import { PanZoomViewport, type ViewportApi } from './PanZoomViewport';
import { PrintPanelsCanvas } from './PrintPanelsCanvas';
import { PrintSheet } from './PrintSheet';
import { PrintTreeCanvas } from './PrintTreeCanvas';
import { SampleDataBanner } from './SampleDataBanner';
import { SettingsPanel } from './SettingsPanel';
import { Toolbar } from './Toolbar';
import { TreeCanvas } from './TreeCanvas';
import { useFamilyData } from './use-family-data';
import { useNameLines } from './use-name-lines';
import { usePrintMeasure } from './use-print-measure';

const LINK_ERROR_HINT = 'Check the link you were given, or ask the person who shared it for a new one.';

const FAILED_MESSAGES = {
  'load-failed': "This link's sheet couldn't be loaded — it may be unpublished, offline, or blocked.",
  unreadable: "This link didn't return a readable sheet — the spreadsheet may no longer be published (File → Share → Publish to web).",
} as const;

export default function App() {
  const resolution = resolveSource(window.location.search, import.meta.env.BASE_URL);
  const viewRaw = new URLSearchParams(window.location.search).get('view');
  if (resolution.status === 'none') {
    return <LoadFamilyDialog saved={loadSaved()} navigate={(search) => window.location.assign(search)} />;
  }
  if (resolution.status === 'error') {
    return (
      <main className="center-screen">
        <ErrorPanel title="This link doesn't work" hint={LINK_ERROR_HINT} demoLink
          errors={[{ message: resolution.message }]} />
      </main>
    );
  }
  return <FamilyApp source={resolution.source} linkSettings={viewRaw !== null ? decodeView(viewRaw) : null} />;
}

function FamilyApp({ source, linkSettings }: { source: ResolvedSource; linkSettings: LayoutSettings | null }) {
  const data = useFamilyData(source.csvUrl);
  const [settings, setSettings] = useState(() => linkSettings ?? loadSettings(source.settingsKey));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [scalePct, setScalePct] = useState(100);
  const [panelOpen, setPanelOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const viewport = useRef<ViewportApi | null>(null);

  const changeSettings = (s: LayoutSettings) => {
    setSettings(s);
    saveSettings(source.settingsKey, s);
  };

  // Link wins: a shared view is applied exactly (including sender-default fields),
  // persisted, then ?view= is stripped so reload after a tweak doesn't snap back.
  useEffect(() => {
    if (linkSettings) {
      saveSettings(source.settingsKey, linkSettings);
      window.history.replaceState(null, '', window.location.pathname + source.canonicalSearch);
    }
  }, [linkSettings, source]);

  const viewValue = encodeView(settings);
  const shareLink = `${window.location.origin}${window.location.pathname}${source.canonicalSearch}${
    viewValue !== null ? `&view=${encodeURIComponent(viewValue)}` : ''
  }`;

  useEffect(() => { document.title = `${source.displayName} — Family Tree`; }, [source.displayName]);

  // Save to the registry only after the sheet actually loads — failed links
  // never pollute the saved list; the demo (registryKey null) is never saved.
  // A re-open via a link with NO explicit name must not clobber an existing
  // entry's name/search back to the fallback title — only bump savedAt.
  useEffect(() => {
    if (data.status === 'ready' && source.registryKey) {
      const existing = loadSaved().find((f) => f.key === source.registryKey);
      const named = source.canonicalSearch !== source.registryKey;
      upsertSaved(named || !existing
        ? { key: source.registryKey, name: source.displayName, search: source.canonicalSearch }
        : { key: existing.key, name: existing.name, search: existing.search });
    }
  }, [data.status, source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelOpen(false);
        setExpandedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const names = useMemo(
    () => (data.status === 'ready' ? [...data.model.persons.values()].map((p) => p.fullName) : []),
    [data],
  );
  const nameLines = useNameLines(names, settings);
  const layout = useMemo(
    () => (data.status === 'ready' ? layoutTree(data.model, layoutMetrics(settings, nameLines)) : null),
    [data, settings, nameLines],
  );

  const printMeasure = usePrintMeasure(settings.theme);

  type ActiveScene =
    | { kind: 'single'; arrangement: 'flow' | 'fan'; scene: PrintScene }
    | { kind: 'panels'; composition: PrintPanels };

  // Only print arrangements compute a scene — topDown must not pay for full-tree
  // text measurement (PR ① finding). The tagged union is what print gating keys
  // off below: an arrangement value WITHOUT an engine branch renders topDown
  // cards instead of a blank hidden app (PR ② review carry-forward).
  const active = useMemo((): ActiveScene | null => {
    if (data.status !== 'ready') return null;
    switch (settings.arrangement) {
      case 'topDown': return null;
      case 'flow': return { kind: 'single', arrangement: 'flow', scene: flowLayout(data.model, printMeasure) };
      case 'fan': return { kind: 'single', arrangement: 'fan', scene: fanLayout(data.model, printMeasure) };
      case 'panels': return { kind: 'panels', composition: panelsLayout(data.model, printMeasure) };
      default: {
        // Exhaustiveness guard (Fix round 1, Important finding 2): this repo's eslint
        // config has no switch-exhaustiveness rule, so widening Arrangement (PR ④'s
        // 'stacks') without adding a case above would otherwise fall through here
        // silently. Assigning to `never` fails tsc (npm run lint runs tsc -b) the
        // moment the union grows past the cases handled above.
        const _exhaustive: never = settings.arrangement;
        void _exhaustive;
        return null;
      }
    }
  }, [data, printMeasure, settings.arrangement]);

  // Never a silently wrong tree (spec §6): if the single-root layout walk couldn't
  // reach everyone in the model (e.g. a rendered child's spouse's own parents form a
  // second root-candidate union), surface it rather than dropping them without a trace.
  const warnings = useMemo((): Issue[] => {
    if (data.status !== 'ready' || !layout) return [];
    const missing = unplacedIds(data.model, layout);
    return missing.length > 0
      ? [...data.warnings, { message: `In this version, relatives connected only through an in-law are not shown: ${missing.map((id) => data.model.persons.get(id)?.fullName ?? id).join(', ')}` }]
      : data.warnings;
  }, [data, layout]);

  // CSS (styles/index.css) keys the print-only sheet visibility off
  // body[data-print-arrangement] — set it exactly when a print scene exists, so
  // print CSS can never hide the app while nothing would print (blank-page guard).
  const isPrint = active !== null;

  // topDown's own print path (no print scene — the on-screen cards ARE the print
  // output, scaled to fit). Keyed off `isPrint` (scene-based), not the arrangement
  // string directly: a future arrangement with no engine branch renders topDown
  // cards (active === null → isPrint false) and must ALSO get this scale hook, or
  // Ctrl+P would print an oversized, clipped tree instead of the fitted page
  // (Fix round 1, Important finding 1 — provably identical for today's four values,
  // since isPrint is exactly `settings.arrangement !== 'topDown'` whenever data is ready).
  useEffect(() => {
    if (!layout || isPrint) return;
    const onBeforePrint = () => {
      document.documentElement.style.setProperty(
        '--print-scale', String(Math.min(1, 1000 / layout.width, 660 / layout.height)),
      );
    };
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, [layout, isPrint]);

  useEffect(() => {
    if (!isPrint) return;
    document.body.dataset.printArrangement = settings.arrangement;
    return () => { delete document.body.dataset.printArrangement; };
  }, [isPrint, settings.arrangement]);

  if (data.status === 'loading') return <main className="center-screen" data-testid="loading"><div className="spinner" aria-label="Loading" /></main>;
  if (data.status === 'invalid') return <main className="center-screen"><ErrorPanel errors={data.errors} /></main>;
  if (data.status === 'empty') return <main className="center-screen" data-testid="empty-state"><h1>No people found</h1><p>The sheet has no rows yet — add people and refresh.</p></main>;
  if (data.status === 'failed') {
    return (
      <main className="center-screen">
        <ErrorPanel title="This tree couldn't be loaded" hint="Refresh to try again." demoLink
          errors={[{ message: FAILED_MESSAGES[data.reason] }]} />
      </main>
    );
  }

  const theme = THEMES[settings.theme];
  const size = formatSizeMm(settings);
  const fit = active === null
    ? { ok: true as const }
    : active.kind === 'panels'
      ? checkPanelsFit(active.composition, size, settings.marginMm, settings.format)
      : checkFit(active.scene.wMm, active.scene.hMm + TITLE_BLOCK_MM, size, settings.marginMm, { suggestPanels: true });
  // Blocked-export precedence (UC-19/82/89): excluded → unplaced (GLOBAL across
  // panels) → fit. Every reason names people by display name, never r5/r5p ids.
  const unplacedNames = active === null
    ? []
    : (active.kind === 'panels'
        ? panelsUnplacedIds(data.model, active.composition)
        : printUnplacedIds(data.model, active.scene)
      ).map((id) => data.model.persons.get(id)!.fullName);
  const exportDisabledReason: string | null = data.model.excludedIds.length > 0
    ? `Cannot export while people are not connected to the main family: ${data.model.excludedNames.join(', ')}`
    : unplacedNames.length > 0
      ? `Cannot export while people are missing from the tree: ${unplacedNames.join(', ')}`
      : !fit.ok ? fit.message : null;
  const guide = settings.frameGuide ? { wMm: size.wMm, hMm: size.hMm, marginMm: settings.marginMm } : null;
  const handleExport = () => {
    setExportError(null);
    collectFontCss(theme).then((fontCss) => {
      const svg = document.querySelector<SVGSVGElement>('.print-canvas-svg')!;
      if (active?.kind === 'panels') {
        // One click → one file per panel (Chrome may ask to allow multiple
        // downloads once — documented in the README).
        const total = active.composition.panels.length;
        active.composition.panels.forEach((p, i) => downloadSvg(
          buildPanelExportSvg(svg, p.label ?? 'master', { wMm: size.wMm, hMm: size.hMm, fontCss, background: theme.background }),
          exportPanelFilename(source.displayName, settings.theme, i + 1, total, size.wMm, size.hMm),
        ));
      } else {
        downloadSvg(
          buildExportSvg(svg, { wMm: size.wMm, hMm: size.hMm, fontCss, background: theme.background }),
          exportFilename(source.displayName, settings.arrangement, settings.theme, size.wMm, size.hMm),
        );
      }
    }).catch((err: unknown) => {
      // Offline / a 404'd font asset must never be a silent no-op click or an
      // unhandled rejection — surface it the same way fit/unplaced refusals are shown.
      console.error('Export failed', err);
      setExportError('Export failed — check your connection and retry.');
    });
  };
  const toggleExpanded = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="app">
      <Toolbar
        title={source.displayName}
        scalePct={scalePct}
        shareLink={shareLink}
        onZoomIn={() => viewport.current?.zoomIn()}
        onZoomOut={() => viewport.current?.zoomOut()}
        onFit={() => viewport.current?.fit()}
        onPrint={() => window.print()}
        settingsOpen={panelOpen}
        onToggleSettings={() => setPanelOpen((o) => !o)}
        onExport={isPrint ? handleExport : undefined}
        exportDisabledReason={isPrint ? exportDisabledReason : undefined}
      />
      {panelOpen && <SettingsPanel settings={settings} onChange={changeSettings} />}
      {source.kind === 'demo' && !bannerDismissed && (
        <SampleDataBanner onDismiss={() => setBannerDismissed(true)} />
      )}
      {warnings.length > 0 && (
        <div className="warnings" data-testid="warnings">
          {warnings.map((w, i) => <p key={i}>{w.message}</p>)}
        </div>
      )}
      {isPrint && !fit.ok && (
        // Blocks export only (see exportDisabledReason above) — print (window.print())
        // and the canvas itself keep working regardless, per spec: a fit failure never
        // hides the tree or the ability to print it.
        <div className="warnings" data-testid="fit-refusal">{fit.message}</div>
      )}
      {isPrint && exportError && (
        <div className="warnings" data-testid="export-error">{exportError}</div>
      )}
      <PanZoomViewport
        contentSize={active
          ? active.kind === 'panels'
            ? { width: active.composition.wMm, height: active.composition.hMm }
            : { width: active.scene.wMm, height: active.scene.hMm + TITLE_BLOCK_MM }
          : { width: layout!.width, height: layout!.height }}
        onBackgroundClick={() => { setExpandedId(null); setPanelOpen(false); }}
        viewportRef={viewport}
        onScaleChange={setScalePct}
      >
        {active ? (
          active.kind === 'panels' ? (
            <PrintPanelsCanvas composition={active.composition} theme={theme} title={source.displayName}
              guide={guide} expandedId={expandedId} onToggle={toggleExpanded} />
          ) : (
            <PrintTreeCanvas scene={active.scene} theme={theme} title={source.displayName}
              arrangement={active.arrangement}
              guide={guide} expandedId={expandedId} onToggle={toggleExpanded} />
          )
        ) : (
          <TreeCanvas model={data.model} layout={layout!} settings={settings} nameLines={nameLines}
            expandedId={expandedId} onToggle={toggleExpanded} />
        )}
      </PanZoomViewport>
      {active && (
        // The @page rule this injects (id="print-page") beats index.css's unscoped
        // @page{size:landscape} purely by head insertion order — same specificity,
        // later wins — so PrintSheet must stay mounted after main.tsx's stylesheet import.
        <PrintSheet svgSelector=".print-canvas-svg" wMm={size.wMm} hMm={size.hMm}
          background={theme.background}
          panelLabels={active.kind === 'panels' ? active.composition.panels.map((p) => p.label ?? 'master') : undefined} />
      )}
    </div>
  );
}
