import { Image } from 'expo-image';
import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const LOGO = require('@/assets/images/logo.png');

const NAV_BG = '#0b0b0b';
const NAV_BORDER = '#2a2a2a';
const NAV_TEXT = '#bbb5a6';
const NAV_TEXT_ACTIVE = '#f4e4bc';
const NAV_ACCENT = '#c9a24a';

const LINKS = [
  { href: '/', label: 'Garage' },
  { href: '/feed', label: 'Feed' },
  { href: '/profile', label: 'Profile' },
] as const;

export function TopNav() {
  const pathname = usePathname();

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <Link href="/" asChild>
          <Pressable style={styles.brand} accessibilityLabel="Wheelbase home">
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
            <ThemedText style={styles.wordmark}>WHEELBASE</ThemedText>
          </Pressable>
        </Link>

        <View style={styles.links}>
          {LINKS.map((link) => {
            const isActive =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} asChild>
                <Pressable
                  style={[
                    styles.link,
                    isActive && { borderBottomColor: NAV_ACCENT },
                  ]}>
                  <ThemedText
                    type="eyebrow"
                    style={{ color: isActive ? NAV_TEXT_ACTIVE : NAV_TEXT }}>
                    {link.label}
                  </ThemedText>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: NAV_BG,
    borderBottomWidth: 1,
    borderBottomColor: NAV_BORDER,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 8,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 44,
    height: 44,
  },
  wordmark: {
    color: NAV_TEXT_ACTIVE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  link: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    justifyContent: 'center',
  },
});
