import { useEffect, useMemo, useRef, useState } from 'react';
import { families } from '../config';
import { resolveFamily } from '../config/families';
import type { Issue } from '../data/types';
import { layoutMetrics } from '../layout/card-metrics';
import { layoutTree, unplacedIds } from '../layout/layout-engine';
import { loadSettings } from '../settings/settings';
import { ErrorPanel } from './ErrorPanel';
import { PanZoomViewport, type ViewportApi } from './PanZoomViewport';
import { SampleDataBanner } from './SampleDataBanner';
import { Toolbar } from './Toolbar';
import { TreeCanvas } from './TreeCanvas';
import { useFamilyData } from './use-family-data';

export default function App() {
  const param = new URLSearchParams(window.location.search).get('family');
  const family = resolveFamily(families, param);
  if (!family) {
    return (
      <main data-testid="family-not-found" className="center-screen">
        <h1>Family not found</h1>
        <p>There is no family tree at this address. Check the link you were given.</p>
      </main>
    );
  }
  return <FamilyApp familyKey={family.key} />;
}

function FamilyApp({ familyKey }: { familyKey: string }) {
  const family = families.find((f) => f.key === familyKey)!;
  const isOnlyDemo = families.length === 1;
  const data = useFamilyData(family, isOnlyDemo);
  const [settings, setSettings] = useState(() => loadSettings(family.key));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [scalePct, setScalePct] = useState(100);
  const viewport = useRef<ViewportApi | null>(null);

  useEffect(() => { document.title = `${family.displayName} — Family Tree`; }, [family.displayName]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const layout = useMemo(
    () => (data.status === 'ready' ? layoutTree(data.model, layoutMetrics(settings)) : null),
    [data, settings],
  );

  // Never a silently wrong tree (spec §6): if the single-root layout walk couldn't
  // reach everyone in the model (e.g. a rendered child's spouse's own parents form a
  // second root-candidate union), surface it rather than dropping them without a trace.
  const warnings = useMemo((): Issue[] => {
    if (data.status !== 'ready' || !layout) return [];
    const missing = unplacedIds(data.model, layout);
    return missing.length > 0
      ? [...data.warnings, { message: `In this version, relatives connected only through an in-law are not shown: ${missing.join(', ')}` }]
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

  return (
    <div className="app">
      <Toolbar
        title={family.displayName}
        mode={settings.contentMode === 'name' ? 'name' : 'photo'}
        onMode={(m) => setSettings({ ...settings, contentMode: m === 'name' ? 'name' : 'avatar' })}
        scalePct={scalePct}
        onZoomIn={() => viewport.current?.zoomIn()}
        onZoomOut={() => viewport.current?.zoomOut()}
        onFit={() => viewport.current?.fit()}
        onPrint={() => window.print()}
      />
      {data.source === 'fallback' && !bannerDismissed && data.fallbackReason && (
        <SampleDataBanner reason={data.fallbackReason} onDismiss={() => setBannerDismissed(true)} />
      )}
      {warnings.length > 0 && (
        <div className="warnings" data-testid="warnings">
          {warnings.map((w, i) => <p key={i}>{w.message}</p>)}
        </div>
      )}
      <PanZoomViewport
        contentSize={{ width: layout!.width, height: layout!.height }}
        onBackgroundClick={() => setExpandedId(null)}
        viewportRef={viewport}
        onScaleChange={setScalePct}
      >
        <TreeCanvas model={data.model} layout={layout!} settings={settings}
          expandedId={expandedId} onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))} />
      </PanZoomViewport>
    </div>
  );
}
