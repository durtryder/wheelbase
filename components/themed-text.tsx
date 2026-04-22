import {
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | 'default'
    | 'title'
    | 'defaultSemiBold'
    | 'subtitle'
    | 'link'
    | 'eyebrow'
    | 'metadata';
};

const TYPE_STYLES: Record<NonNullable<ThemedTextProps['type']>, TextStyle> = {
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Fonts.sans.regular,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Fonts.sans.semibold,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.4,
    fontFamily: Fonts.sans.bold,
  },
  subtitle: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    fontFamily: Fonts.sans.bold,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans.bold,
  },
  metadata: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    fontFamily: Fonts.sans.regular,
  },
  link: {
    fontSize: 16,
    lineHeight: 30,
    color: '#0a7ea4',
    fontFamily: Fonts.sans.medium,
  },
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  const base = TYPE_STYLES[type];
  const userOverride = (StyleSheet.flatten(style) ?? {}) as TextStyle;

  // Resolve the Manrope weight family based on any explicit fontWeight the
  // caller passed in `style`. This lets existing call sites that use
  // `fontWeight: '600'` continue to bolden without knowing about Manrope's
  // per-weight family names.
  const resolved: TextStyle = { ...base, ...userOverride };
  const userWeight = userOverride.fontWeight;
  if (userWeight && isSansFamily(resolved.fontFamily)) {
    resolved.fontFamily = manropeForWeight(userWeight);
  }

  return <Text style={[{ color }, resolved]} {...rest} />;
}

function isSansFamily(family: string | undefined): boolean {
  if (!family) return false;
  return family.startsWith('Manrope_');
}

function manropeForWeight(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '100':
    case '200':
    case '300':
    case '400':
    case 'normal':
    case undefined:
      return Fonts.sans.regular;
    case '500':
      return Fonts.sans.medium;
    case '600':
      return Fonts.sans.semibold;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return Fonts.sans.bold;
    default:
      return Fonts.sans.regular;
  }
}
