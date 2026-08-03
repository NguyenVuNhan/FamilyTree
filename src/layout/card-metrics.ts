import { DEFAULT_SETTINGS, type CardStyle, type ConnectorStyle, type LayoutSettings } from '../settings/settings';
import { MARGIN } from './constants';

export interface LayoutMetrics {
  cardW: number;
  cardH: number;
  coupleGap: number;
  siblingGap: number;
  genGap: number;
  margin: number;
  connectorStyle: ConnectorStyle;
}

export const MIN_CARD_SIZE = 44; // touch-target floor (spec: Visual design guidance)

// Content building blocks (px)
const AVATAR = 64;   // collapsed avatar diameter (matches PersonCard)
const PHOTO_LEFT = 48; // photoLeft thumbnail
const NAME_H = 20;   // one line of name text
const RING = 4;      // circle-variant ring + breathing room
const CLASSIC_SLACK = 28; // preserves today's 150 height at padding 14 (see test)

/** Matrix rule: a name-only rendering has no imagery to style — every style renders as classic. */
export function effectiveCardStyle(s: LayoutSettings): CardStyle {
  return s.contentMode === 'name' ? 'classic' : s.cardStyle;
}

/** Horizontal space the name text actually gets — must mirror index.css. */
export function nameTextWidth(s: LayoutSettings): number {
  const p = s.cardPadding;
  switch (effectiveCardStyle(s)) {
    case 'circle': return 104 + 2 * p;              // label floats at full card width (bleeds, no padding)
    case 'photoLeft': return 176 - PHOTO_LEFT - 10; // photo + 10px flex gap sit beside the text
    case 'archCard': return 104 + 2 * p - 20;       // .style-archCard .person-name pads 10px each side
    default: return 104;                            // classic: cardW − 2·padding
  }
}

export function cardMetrics(s: LayoutSettings, maxNameLines = 1): { cardW: number; cardH: number } {
  const p = s.cardPadding;
  const style = effectiveCardStyle(s);
  const lines = s.contentMode === 'avatar' ? 1 : Math.max(1, maxNameLines);
  const nameBlock = NAME_H * lines;
  let w: number;
  let h: number;
  switch (style) {
    case 'circle': {
      const d = AVATAR + 2 * RING; // 72
      if (s.contentMode === 'avatar') {
        w = d;
        h = d;
      } else {
        w = 104 + 2 * p; // label needs the classic card's text width
        h = d + p + nameBlock; // padding doubles as circle↔label gap
      }
      break;
    }
    case 'photoLeft': {
      h = Math.max(PHOTO_LEFT, s.contentMode === 'avatar' ? 0 : nameBlock) + 2 * p;
      w = s.contentMode === 'avatar' ? PHOTO_LEFT + 2 * p : 176 + 2 * p;
      break;
    }
    case 'archCard': {
      w = 104 + 2 * p; // image spans the full card width (square)
      h = s.contentMode === 'avatar' ? w : w + nameBlock + 2 * p;
      break;
    }
    default: {
      // classic: today's geometry — 132×150 at default padding 14
      w = 104 + 2 * p;
      h = AVATAR + nameBlock + 2 * p + CLASSIC_SLACK + 10; // 64+20+28+28+10 = 150 at p=14
      break;
    }
  }
  return { cardW: Math.max(MIN_CARD_SIZE, Math.round(w)), cardH: Math.max(MIN_CARD_SIZE, Math.round(h)) };
}

export function layoutMetrics(s: LayoutSettings, maxNameLines = 1): LayoutMetrics {
  return {
    ...cardMetrics(s, maxNameLines),
    coupleGap: s.coupleGap,
    siblingGap: s.siblingGap,
    genGap: s.genGap,
    margin: MARGIN,
    connectorStyle: s.connectorStyle,
  };
}

export const DEFAULT_METRICS: LayoutMetrics = layoutMetrics(DEFAULT_SETTINGS);
