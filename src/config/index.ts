import { buildFamilies } from './families';
import type { DisplayMode } from '../data/types';

declare const __FAMILY_ENV__: Record<string, string>;

export type { DisplayMode };
export const defaultDisplayMode: DisplayMode = 'photo';
export const families = buildFamilies(__FAMILY_ENV__, import.meta.env.BASE_URL);
