import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';

const LOGO = require('@/assets/images/logo.png');
const WORDMARK = require('@/assets/images/wordmark.png');

const NAV_BG = '#f6f1e8';
const NAV_BORDER = '#d6cfbf';
const NAV_TEXT = '#1a1a1a';
const NAV_TEXT_MUTED = '#5a5751';
const NAV_ACCENT = '#c9a24a';
const NAV_RED = '#c1272d';

const LINKS = [
  { href: '/', label: 'Garage' },
  { href: '/feed', label: 'Feed' },
  { href: '/profile', label: 'Profile' },
] as const;

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <Pressable
          onPress={() => router.push('/')}
          style={styles.brand}
          accessibilityRole="link"
          accessibilityLabel="Wheelbase home">
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
          <Image source={WORDMARK} style={styles.wordmark} contentFit="contain" />
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

          {!loading && (
            <View style={styles.divider} />
          )}

          {!loading &&
            (user ? (
              <Pressable
                onPress={() => router.push('/profile')}
                accessibilityRole="link"
                style={styles.link}>
                <Text style={styles.linkMuted} numberOfLines={1}>
                  {user.displayName ?? user.email ?? 'Account'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/sign-in')}
                accessibilityRole="link"
                style={styles.link}>
                <Text style={styles.linkCta}>Sign in</Text>
              </Pressable>
            ))}
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
    width: 240,
    height: 76,
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
  linkMuted: {
    color: NAV_TEXT_MUTED,
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 180,
  },
  linkCta: {
    color: NAV_RED,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginVertical: 18,
    backgroundColor: NAV_BORDER,
  },
});
