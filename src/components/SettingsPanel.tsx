import { DEFAULT_SETTINGS, SPACING_BOUNDS, type LayoutSettings } from '../settings/settings';

const CARD_STYLES = [['classic', 'Classic'], ['circle', 'Circle'], ['photoLeft', 'Photo left'], ['archCard', 'Arch']] as const;
const CONTENT_MODES = [['full', 'Full'], ['name', 'Name'], ['avatar', 'Avatar']] as const;
const NAME_POSITIONS = [['top', 'Top'], ['bottom', 'Bottom']] as const;
const PLACEHOLDERS = [['initials', 'Initials'], ['illustrated', 'Illustrated']] as const;
const CONNECTORS = [['elbow', 'Elbow'], ['curved', 'Curved'], ['straight', 'Straight']] as const;

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

function SliderRow({ label, value, bounds, onChange }: {
  label: string; value: number; bounds: { min: number; max: number }; onChange: (v: number) => void;
}) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label} <output>{value}px</output></span>
      <input
        type="range" aria-label={label} min={bounds.min} max={bounds.max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function SettingsPanel({ settings, onChange }: {
  settings: LayoutSettings; onChange: (s: LayoutSettings) => void;
}) {
  const set = <K extends keyof LayoutSettings>(key: K, value: LayoutSettings[K]) =>
    onChange({ ...settings, [key]: value });
  const nameDisabled = settings.contentMode !== 'full' || settings.cardStyle === 'photoLeft';
  return (
    <div className="settings-panel" data-testid="settings-panel" role="dialog" aria-label="Layout settings">
      <Segmented label="Card style" value={settings.cardStyle} options={CARD_STYLES} onSelect={(v) => set('cardStyle', v)} />
      <Segmented label="Show" value={settings.contentMode} options={CONTENT_MODES} onSelect={(v) => set('contentMode', v)} />
      <Segmented
        label="Name position" value={settings.namePosition} options={NAME_POSITIONS}
        onSelect={(v) => set('namePosition', v)}
        disabled={nameDisabled} disabledReason="Applies in Full mode (Photo left places the name itself)"
      />
      <Segmented label="Placeholder" value={settings.placeholderStyle} options={PLACEHOLDERS} onSelect={(v) => set('placeholderStyle', v)} />
      <Segmented label="Connectors" value={settings.connectorStyle} options={CONNECTORS} onSelect={(v) => set('connectorStyle', v)} />
      <SliderRow label="Card padding" value={settings.cardPadding} bounds={SPACING_BOUNDS.cardPadding} onChange={(v) => set('cardPadding', v)} />
      <SliderRow label="Partner gap" value={settings.coupleGap} bounds={SPACING_BOUNDS.coupleGap} onChange={(v) => set('coupleGap', v)} />
      <SliderRow label="Sibling gap" value={settings.siblingGap} bounds={SPACING_BOUNDS.siblingGap} onChange={(v) => set('siblingGap', v)} />
      <SliderRow label="Generation gap" value={settings.genGap} bounds={SPACING_BOUNDS.genGap} onChange={(v) => set('genGap', v)} />
      <button type="button" className="settings-reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
        Reset to defaults
      </button>
    </div>
  );
}
