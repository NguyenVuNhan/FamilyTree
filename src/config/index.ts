import { buildFamilies } from './families';

declare const __FAMILY_ENV__: Record<string, string>;

export type DisplayMode = 'photo' | 'name';
export const defaultDisplayMode: DisplayMode = 'photo';
export const families = buildFamilies(__FAMILY_ENV__, import.meta.env.BASE_URL);
