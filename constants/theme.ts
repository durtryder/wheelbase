/**
 * Wheelbase palette — editorial look/feel inspired by Bring a Trailer,
 * with Wheelbase's own brand accents (red + gold) replacing BaT's green.
 *
 * Light mode is the primary experience: cream/off-white background,
 * charcoal text, thin subtle borders, generous whitespace.
 */

import { Platform } from 'react-native';

const wheelbaseRed = '#c1272d';
const wheelbaseRedDeep = '#8c1a1f';
const wheelbaseGold = '#c9a24a';
const wheelbaseGoldSoft = '#e8c56b';
const wheelbaseCream = '#f6f1e8';
const wheelbaseCreamDim = '#ebe4d3';
const wheelbaseInk = '#1a1a1a';
const wheelbaseInkMuted = '#5a5751';
const wheelbaseBorder = '#d6cfbf';

const darkBg = '#0b0b0b';
const darkSurface = '#1a1a1a';
const darkBorder = '#2a2a2a';

export const Colors = {
  light: {
    text: wheelbaseInk,
    textMuted: wheelbaseInkMuted,
    background: wheelbaseCream,
    surface: '#ffffff',
    surfaceDim: wheelbaseCreamDim,
    tint: wheelbaseRed,
    tintDeep: wheelbaseRedDeep,
    accent: wheelbaseGold,
    accentSoft: wheelbaseGoldSoft,
    icon: wheelbaseInkMuted,
    tabIconDefault: wheelbaseInkMuted,
    tabIconSelected: wheelbaseRed,
    border: wheelbaseBorder,
  },
  dark: {
    text: '#f4e4bc',
    textMuted: '#9a958a',
    background: darkBg,
    surface: darkSurface,
    surfaceDim: '#121212',
    tint: wheelbaseGoldSoft,
    tintDeep: wheelbaseGold,
    accent: wheelbaseRed,
    accentSoft: wheelbaseRedDeep,
    icon: '#9BA1A6',
    tabIconDefault: '#6b6b6b',
    tabIconSelected: wheelbaseGoldSoft,
    border: darkBorder,
  },
};

/**
 * Font stacks. Serif is used for editorial titles (vehicle names, page
 * headings); sans is used for UI and body copy.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "'Playfair Display', Georgia, 'Times New Roman', 'Tiempos Text', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
