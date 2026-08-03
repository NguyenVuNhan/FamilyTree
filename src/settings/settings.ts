import { COUPLE_GAP, GEN_GAP, SIBLING_GAP } from '../layout/constants';

export type CardStyle = 'classic' | 'circle' | 'photoLeft' | 'archCard';
export type ContentMode = 'full' | 'name' | 'avatar';
export type NamePosition = 'top' | 'bottom';
export type ConnectorStyle = 'elbow' | 'curved' | 'straight';
export type PlaceholderStyle = 'initials' | 'illustrated';

export interface LayoutSettings {
  cardStyle: CardStyle;
  contentMode: ContentMode;
  namePosition: NamePosition;
  cardPadding: number;
  coupleGap: number;
  siblingGap: number;
  genGap: number;
  connectorStyle: ConnectorStyle;
  placeholderStyle: PlaceholderStyle;
}

export const SPACING_BOUNDS = {
  cardPadding: { min: 6, max: 28 },
  coupleGap: { min: 12, max: 80 },
  siblingGap: { min: 16, max: 100 },
  genGap: { min: 40, max: 200 },
} as const;

export const DEFAULT_SETTINGS: LayoutSettings = {
  cardStyle: 'archCard',
  contentMode: 'full', // default view: arch photo card with the full name underneath
  namePosition: 'bottom',
  cardPadding: 14,
  coupleGap: COUPLE_GAP,
  siblingGap: SIBLING_GAP,
  genGap: GEN_GAP,
  connectorStyle: 'elbow',
  placeholderStyle: 'initials',
};

const CARD_STYLES: readonly CardStyle[] = ['classic', 'circle', 'photoLeft', 'archCard'];
const CONTENT_MODES: readonly ContentMode[] = ['full', 'name', 'avatar'];
const NAME_POSITIONS: readonly NamePosition[] = ['top', 'bottom'];
const CONNECTOR_STYLES: readonly ConnectorStyle[] = ['elbow', 'curved', 'straight'];
const PLACEHOLDER_STYLES: readonly PlaceholderStyle[] = ['initials', 'illustrated'];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
function num(value: unknown, bounds: { min: number; max: number }, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= bounds.min && value <= bounds.max
    ? value
    : fallback;
}

/** Per-field validation: any unknown value or out-of-range number falls back to that field's default. */
export function sanitizeSettings(raw: unknown): LayoutSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    cardStyle: pick(r.cardStyle, CARD_STYLES, DEFAULT_SETTINGS.cardStyle),
    contentMode: pick(r.contentMode, CONTENT_MODES, DEFAULT_SETTINGS.contentMode),
    namePosition: pick(r.namePosition, NAME_POSITIONS, DEFAULT_SETTINGS.namePosition),
    cardPadding: num(r.cardPadding, SPACING_BOUNDS.cardPadding, DEFAULT_SETTINGS.cardPadding),
    coupleGap: num(r.coupleGap, SPACING_BOUNDS.coupleGap, DEFAULT_SETTINGS.coupleGap),
    siblingGap: num(r.siblingGap, SPACING_BOUNDS.siblingGap, DEFAULT_SETTINGS.siblingGap),
    genGap: num(r.genGap, SPACING_BOUNDS.genGap, DEFAULT_SETTINGS.genGap),
    connectorStyle: pick(r.connectorStyle, CONNECTOR_STYLES, DEFAULT_SETTINGS.connectorStyle),
    placeholderStyle: pick(r.placeholderStyle, PLACEHOLDER_STYLES, DEFAULT_SETTINGS.placeholderStyle),
  };
}

const storageKey = (familyKey: string) => `ft:layout:${familyKey}`;

export function loadSettings(familyKey: string): LayoutSettings {
  try {
    const text = localStorage.getItem(storageKey(familyKey));
    if (!text) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(text));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(familyKey: string, settings: LayoutSettings): void {
  try {
    localStorage.setItem(storageKey(familyKey), JSON.stringify(settings));
  } catch {
    // storage full or blocked — settings just won't persist this session
  }
}
