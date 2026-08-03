// src/components/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSaved, upsertSaved } from '../config/registry';
import { resolveSource, type ResolvedSource } from '../config/source';
import type { Issue } from '../data/types';
import { layoutMetrics } from '../layout/card-metrics';
import { layoutTree, unplacedIds } from '../layout/layout-engine';
import { loadSettings, saveSettings, type LayoutSettings } from '../settings/settings';
import { decodeView, encodeView } from '../settings/view-param';
import { ErrorPanel } from './ErrorPanel';
import { LoadFamilyDialog } from './LoadFamilyDialog';
import { PanZoomViewport, type ViewportApi } from './PanZoomViewport';
import { SampleDataBanner } from './SampleDataBanner';
import { SettingsPanel } from './SettingsPanel';
import { Toolbar } from './Toolbar';
import { TreeCanvas } from './TreeCanvas';
import { useFamilyData } from './use-family-data';
import { useNameLines } from './use-name-lines';

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

  useEffect(() => {
    if (!layout) return;
    const onBeforePrint = () => {
      document.documentElement.style.setProperty(
        '--print-scale', String(Math.min(1, 1000 / layout.width, 660 / layout.height)),
      );
    };
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, [layout]);

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
      <PanZoomViewport
        contentSize={{ width: layout!.width, height: layout!.height }}
        onBackgroundClick={() => { setExpandedId(null); setPanelOpen(false); }}
        viewportRef={viewport}
        onScaleChange={setScalePct}
      >
        <TreeCanvas model={data.model} layout={layout!} settings={settings}
          expandedId={expandedId} onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))} />
      </PanZoomViewport>
    </div>
  );
}
