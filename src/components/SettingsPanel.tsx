import { useState } from 'react';
import { DEFAULT_SETTINGS, printControlsActive, SPACING_BOUNDS, type LayoutSettings } from '../settings/settings';
import { PRINT_BOUNDS, parseCustomFmt } from '../print/formats';

const CARD_STYLES = [['classic', 'Classic'], ['circle', 'Circle'], ['photoLeft', 'Photo left'], ['archCard', 'Arch']] as const;
const CONTENT_MODES = [['full', 'Full'], ['name', 'Name'], ['avatar', 'Avatar']] as const;
const NAME_POSITIONS = [['top', 'Top'], ['bottom', 'Bottom']] as const;
const PLACEHOLDERS = [['initials', 'Initials'], ['illustrated', 'Illustrated']] as const;
const CONNECTORS = [['elbow', 'Elbow'], ['curved', 'Curved'], ['straight', 'Straight']] as const;
const ARRANGEMENTS = [['topDown', 'Top-down'], ['flow', 'Scroll']] as const;
const THEME_OPTIONS = [['indochine', 'Indochine'], ['nordic', 'Nordic'], ['inkwash', 'Ink wash'], ['botanical', 'Botanical']] as const;
const FORMAT_OPTIONS = [
  ['a4', 'A4'], ['a3', 'A3'], ['a1', 'A1'], ['a0', 'A0'], ['pano', 'Panorama'], ['square', 'Square'], ['custom', 'Custom'],
] as const;

const CARD_DISABLED_REASON = 'Applies to the Top-down arrangement';

function Segmented<T extends string>({ label, value, options, onSelect, disabled, disabledReason }: {
  label: string; value: T; options: ReadonlyArray<readonly [T, string]>;
  onSelect: (v: T) => void; disabled?: boolean; disabledReason?: string;
}) {
  return (
    <div className="settings-row" title={disabled ? disabledReason : undefined}>
      <span className="settings-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" disabled={disabled} aria-pressed={value === v} onClick={() => onSelect(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderRow({ label, value, bounds, onChange, unit = 'px' }: {
  label: string; value: number; bounds: { min: number; max: number }; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label} <output>{value}{unit}</output></span>
      <input
        type="range" aria-label={label} min={bounds.min} max={bounds.max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function CustomSizeRow({ settings, onChange }: {
  settings: LayoutSettings; onChange: (s: LayoutSettings) => void;
}) {
  const [w, setW] = useState(String(settings.customWmm));
  const [h, setH] = useState(String(settings.customHmm));
  const parsed = parseCustomFmt(`${w}x${h}`);

  const commit = (nw: string, nh: string) => {
    const p = parseCustomFmt(`${nw}x${nh}`);
    if (p) onChange({ ...settings, customWmm: p.wMm, customHmm: p.hMm });
  };

  return (
    <div className="settings-row settings-custom-size">
      <span className="settings-label">Custom size</span>
      <input
        type="number" aria-label="Custom width (mm)" value={w}
        onChange={(e) => { setW(e.target.value); commit(e.target.value, h); }}
      />
      <span aria-hidden="true">×</span>
      <input
        type="number" aria-label="Custom height (mm)" value={h}
        onChange={(e) => { setH(e.target.value); commit(w, e.target.value); }}
      />
      {!parsed && (
        <span data-testid="custom-size-error">
          Between {PRINT_BOUNDS.customMm.min} and {PRINT_BOUNDS.customMm.maxW}×{PRINT_BOUNDS.customMm.maxH} mm
        </span>
      )}
    </div>
  );
}

export function SettingsPanel({ settings, onChange }: {
  settings: LayoutSettings; onChange: (s: LayoutSettings) => void;
}) {
  const set = <K extends keyof LayoutSettings>(key: K, value: LayoutSettings[K]) =>
    onChange({ ...settings, [key]: value });
  const printActive = printControlsActive(settings);
  const nameContentDisabled = settings.contentMode !== 'full' || settings.cardStyle === 'photoLeft';
  const nameDisabled = printActive || nameContentDisabled;
  const nameDisabledReason = printActive ? CARD_DISABLED_REASON : 'Applies in Full mode (Photo left places the name itself)';

  return (
    <div className="settings-panel" data-testid="settings-panel" role="dialog" aria-label="Layout settings">
      <Segmented label="Arrangement" value={settings.arrangement} options={ARRANGEMENTS} onSelect={(v) => set('arrangement', v)} />
      {printActive && (
        <>
          <Segmented label="Theme" value={settings.theme} options={THEME_OPTIONS} onSelect={(v) => set('theme', v)} />
          <Segmented label="Format" value={settings.format} options={FORMAT_OPTIONS} onSelect={(v) => set('format', v)} />
          {settings.format === 'custom' && <CustomSizeRow settings={settings} onChange={onChange} />}
          {settings.format === 'square' && (
            <p className="settings-hint" data-testid="aspect-hint">Scroll reads best on a wide format</p>
          )}
          <SliderRow
            label="Safe margin" unit="mm" value={settings.marginMm} bounds={PRINT_BOUNDS.marginMm}
            onChange={(v) => set('marginMm', v)}
          />
          <div className="settings-row">
            <label>
              <input
                type="checkbox" aria-label="Frame guide" checked={settings.frameGuide}
                onChange={(e) => set('frameGuide', e.target.checked)}
              /> Frame guide
            </label>
          </div>
        </>
      )}
      <Segmented
        label="Card style" value={settings.cardStyle} options={CARD_STYLES} onSelect={(v) => set('cardStyle', v)}
        disabled={printActive} disabledReason={CARD_DISABLED_REASON}
      />
      <Segmented
        label="Show" value={settings.contentMode} options={CONTENT_MODES} onSelect={(v) => set('contentMode', v)}
        disabled={printActive} disabledReason={CARD_DISABLED_REASON}
      />
      <Segmented
        label="Name position" value={settings.namePosition} options={NAME_POSITIONS}
        onSelect={(v) => set('namePosition', v)}
        disabled={nameDisabled} disabledReason={nameDisabledReason}
      />
      <Segmented
        label="Placeholder" value={settings.placeholderStyle} options={PLACEHOLDERS} onSelect={(v) => set('placeholderStyle', v)}
        disabled={printActive} disabledReason={CARD_DISABLED_REASON}
      />
      {!printActive && (
        <>
          <Segmented label="Connectors" value={settings.connectorStyle} options={CONNECTORS} onSelect={(v) => set('connectorStyle', v)} />
          <SliderRow label="Card padding" value={settings.cardPadding} bounds={SPACING_BOUNDS.cardPadding} onChange={(v) => set('cardPadding', v)} />
          <SliderRow label="Partner gap" value={settings.coupleGap} bounds={SPACING_BOUNDS.coupleGap} onChange={(v) => set('coupleGap', v)} />
          <SliderRow label="Sibling gap" value={settings.siblingGap} bounds={SPACING_BOUNDS.siblingGap} onChange={(v) => set('siblingGap', v)} />
          <SliderRow label="Generation gap" value={settings.genGap} bounds={SPACING_BOUNDS.genGap} onChange={(v) => set('genGap', v)} />
        </>
      )}
      <button type="button" className="settings-reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
        Reset to defaults
      </button>
    </div>
  );
}
