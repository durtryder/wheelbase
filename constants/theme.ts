/**
 * Wheelbase color palette — inspired by the logo's black/red/gold badge.
 */

import { Platform } from 'react-native';

const wheelbaseRed = '#c1272d';
const wheelbaseGold = '#e8c56b';
const wheelbaseCream = '#f4e4bc';
const wheelbaseBlack = '#0b0b0b';
const wheelbaseSurface = '#1a1a1a';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    surface: '#f6f6f6',
    tint: wheelbaseRed,
    accent: wheelbaseGold,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: wheelbaseRed,
    border: '#e5e5e5',
  },
  dark: {
    text: wheelbaseCream,
    background: wheelbaseBlack,
    surface: wheelbaseSurface,
    tint: wheelbaseGold,
    accent: wheelbaseRed,
    icon: '#9BA1A6',
    tabIconDefault: '#6b6b6b',
    tabIconSelected: wheelbaseGold,
    border: '#2a2a2a',
  },
};

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
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
