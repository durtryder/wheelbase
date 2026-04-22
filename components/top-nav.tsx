import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const LOGO = require('@/assets/images/logo.png');

const NAV_BG = '#f6f1e8';
const NAV_BORDER = '#d6cfbf';
const NAV_TEXT = '#1a1a1a';
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
                  {link.label}
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
    paddingVertical: 10,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 88,
    height: 88,
  },
  wordmark: {
    color: NAV_TEXT,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  link: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    justifyContent: 'center',
  },
  linkActive: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 2,
    borderBottomColor: NAV_ACCENT,
    justifyContent: 'center',
  },
  linkText: {
    color: NAV_TEXT,
    fontSize: 15,
    fontWeight: '500',
  },
  linkTextActive: {
    color: NAV_TEXT,
    fontSize: 15,
    fontWeight: '700',
  },
});
