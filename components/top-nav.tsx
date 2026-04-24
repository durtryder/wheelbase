import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoints } from '@/hooks/use-breakpoints';

const LOGO = require('@/assets/images/logo.png');

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
  const { isNarrow } = useBreakpoints();

  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  function nav(href: string) {
    setMenuOpen(false);
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.inner, isNarrow ? styles.innerNarrow : null]}>
        <Pressable
          onPress={() => nav('/')}
          style={isNarrow ? styles.brandNarrow : styles.brand}
          accessibilityRole="link"
          accessibilityLabel="Wheelbase home">
          <Image
            source={LOGO}
            style={isNarrow ? styles.logoNarrow : styles.logo}
            contentFit="contain"
          />
        </Pressable>

        {isNarrow ? (
          // Narrow: single hamburger button that opens a full overlay menu.
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={styles.hamburger}
            accessibilityLabel="Open menu"
            accessibilityRole="button"
            hitSlop={8}>
            <View style={[styles.hamburgerBar, { backgroundColor: NAV_TEXT }]} />
            <View style={[styles.hamburgerBar, { backgroundColor: NAV_TEXT }]} />
            <View style={[styles.hamburgerBar, { backgroundColor: NAV_TEXT }]} />
          </Pressable>
        ) : (
          // Wide: inline nav links + auth chip.
          <View style={styles.links}>
            {LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Pressable
                  key={link.href}
                  onPress={() => nav(link.href)}
                  accessibilityRole="link"
                  style={active ? styles.linkActive : styles.link}>
                  <Text style={active ? styles.linkTextActive : styles.linkText}>
                    {link.label}
                  </Text>
                </Pressable>
              );
            })}

            {!loading && <View style={styles.divider} />}

            {!loading &&
              (user ? (
                <Pressable
                  onPress={() => nav('/profile')}
                  accessibilityRole="link"
                  style={styles.link}>
                  <Text style={styles.linkMuted} numberOfLines={1}>
                    {user.displayName ?? user.email ?? 'Account'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => nav('/sign-in')}
                  accessibilityRole="link"
                  style={styles.link}>
                  <Text style={styles.linkCta}>Sign in</Text>
                </Pressable>
              ))}
          </View>
        )}
      </View>

      {/* Mobile full-screen menu */}
      {isNarrow ? (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
          statusBarTranslucent>
          <View style={menuStyles.backdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setMenuOpen(false)}
              accessibilityLabel="Close menu"
            />
            <View style={menuStyles.sheet}>
              <View style={menuStyles.sheetHeader}>
                <Image source={LOGO} style={styles.logoNarrow} contentFit="contain" />
                <Pressable
                  onPress={() => setMenuOpen(false)}
                  hitSlop={10}
                  accessibilityLabel="Close menu">
                  <Text style={menuStyles.close}>Close</Text>
                </Pressable>
              </View>

              <View style={menuStyles.links}>
                {LINKS.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Pressable
                      key={link.href}
                      onPress={() => nav(link.href)}
                      style={menuStyles.linkItem}
                      accessibilityRole="link">
                      <Text
                        style={[
                          menuStyles.linkText,
                          active ? menuStyles.linkTextActive : null,
                        ]}>
                        {link.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {!loading ? (
                <View style={menuStyles.authRow}>
                  {user ? (
                    <Pressable
                      onPress={() => nav('/profile')}
                      style={menuStyles.linkItem}>
                      <Text style={menuStyles.authLabel}>
                        {user.displayName ?? user.email ?? 'Account'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => nav('/sign-in')}
                      style={menuStyles.linkItem}>
                      <Text style={menuStyles.authCta}>Sign in</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
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
  innerNarrow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandNarrow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 88,
    height: 88,
  },
  logoNarrow: {
    width: 56,
    height: 56,
  },
  hamburger: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  hamburgerBar: {
    width: 22,
    height: 2,
    borderRadius: 2,
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
    fontFamily: Fonts.sans.medium,
  },
  linkTextActive: {
    color: NAV_TEXT,
    fontSize: 15,
    fontFamily: Fonts.sans.bold,
  },
  linkMuted: {
    color: NAV_TEXT_MUTED,
    fontSize: 14,
    fontFamily: Fonts.sans.medium,
    maxWidth: 180,
  },
  linkCta: {
    color: NAV_RED,
    fontSize: 15,
    fontFamily: Fonts.sans.semibold,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginVertical: 18,
    backgroundColor: NAV_BORDER,
  },
});

const menuStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,11,0.55)',
  },
  sheet: {
    backgroundColor: NAV_BG,
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: NAV_BORDER,
    // subtle elevation on Android / shadow on iOS / nothing on web
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  close: {
    color: NAV_TEXT,
    fontSize: 15,
    fontFamily: Fonts.sans.semibold,
    padding: 8,
  },
  links: {
    gap: 2,
  },
  linkItem: {
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  linkText: {
    color: NAV_TEXT,
    fontSize: 20,
    fontFamily: Fonts.sans.medium,
  },
  linkTextActive: {
    fontFamily: Fonts.sans.bold,
  },
  authRow: {
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: NAV_BORDER,
  },
  authLabel: {
    color: NAV_TEXT_MUTED,
    fontSize: 16,
    fontFamily: Fonts.sans.medium,
  },
  authCta: {
    color: NAV_RED,
    fontSize: 18,
    fontFamily: Fonts.sans.semibold,
  },
});
