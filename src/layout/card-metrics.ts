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

export function cardMetrics(s: LayoutSettings): { cardW: number; cardH: number } {
  const p = s.cardPadding;
  const style = effectiveCardStyle(s);
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
        h = d + p + NAME_H; // padding doubles as circle↔label gap
      }
      break;
    }
    case 'photoLeft': {
      h = PHOTO_LEFT + 2 * p;
      w = s.contentMode === 'avatar' ? PHOTO_LEFT + 2 * p : 176 + 2 * p;
      break;
    }
    case 'archCard': {
      w = 104 + 2 * p; // image spans the full card width (square)
      h = s.contentMode === 'avatar' ? w : w + NAME_H + 2 * p;
      break;
    }
    default: {
      // classic: today's geometry — 132×150 at default padding 14
      w = 104 + 2 * p;
      h = AVATAR + NAME_H + 2 * p + CLASSIC_SLACK + 10; // 64+20+28+28+10 = 150 at p=14
      break;
    }
  }
  return { cardW: Math.max(MIN_CARD_SIZE, Math.round(w)), cardH: Math.max(MIN_CARD_SIZE, Math.round(h)) };
}

export function layoutMetrics(s: LayoutSettings): LayoutMetrics {
  return {
    ...cardMetrics(s),
    coupleGap: s.coupleGap,
    siblingGap: s.siblingGap,
    genGap: s.genGap,
    margin: MARGIN,
    connectorStyle: s.connectorStyle,
  };
}

export const DEFAULT_METRICS: LayoutMetrics = layoutMetrics(DEFAULT_SETTINGS);
