import { StyleSheet, Text, type TextProps } from 'react-native';

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

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'eyebrow' ? styles.eyebrow : undefined,
        type === 'metadata' ? styles.metadata : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Fonts.sans,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 38,
    fontFamily: Fonts.serif,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    fontFamily: Fonts.serif,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
  metadata: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sans,
    letterSpacing: 0.2,
  },
  link: {
    fontSize: 16,
    lineHeight: 30,
    fontFamily: Fonts.sans,
    color: '#0a7ea4',
  },
});
