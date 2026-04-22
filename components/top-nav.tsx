import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <Pressable
          onPress={() => router.push('/')}
          style={styles.brand}
          accessibilityRole="link"
          accessibilityLabel="Wheelbase home">
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
          <Text style={styles.wordmark}>WHEELBASE</Text>
        </Pressable>

        <View style={styles.links}>
          {LINKS.map((link) => {
            const isActive =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Pressable
                key={link.href}
                onPress={() => router.push(link.href)}
                accessibilityRole="link"
                style={isActive ? styles.linkActive : styles.link}>
                <Text style={isActive ? styles.linkTextActive : styles.linkText}>
                  {link.label.toUpperCase()}
                </Text>
              </Pressable>
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
  },
  link: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    justifyContent: 'center',
  },
  linkActive: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: NAV_ACCENT,
    justifyContent: 'center',
  },
  linkText: {
    color: NAV_TEXT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  linkTextActive: {
    color: NAV_TEXT_ACTIVE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
});
