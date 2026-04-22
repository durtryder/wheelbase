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
    placeholder: '#c9c5ba',
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
    placeholder: '#4a4740',
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
 * Font stacks. Sans is Manrope (Google Fonts), chosen as a free modernist
 * stand-in for Daytona. Each weight is its own family name because
 * @expo-google-fonts/manrope ships weights as discrete fonts.
 *
 * Serif stays as a web CSS stack for editorial titles — tighten later if
 * we want to ship a custom serif face too.
 */
export const Fonts = {
  sans: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
  },
  serif: Platform.select({
    ios: 'ui-serif',
    default: 'serif',
    web: "'Playfair Display', Georgia, 'Times New Roman', 'Tiempos Text', serif",
  }) as string,
  mono: Platform.select({
    ios: 'ui-monospace',
    default: 'monospace',
    web: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  }) as string,
};
