import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { humanizeAuthError, signOutUser } from '@/services/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading } = useAuth();

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      await signOutUser();
      router.replace('/');
    } catch (e) {
      setError(humanizeAuthError(e));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">Profile</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <ThemedView
          style={[
            styles.card,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}>
          {loading ? (
            <ThemedText>Loading…</ThemedText>
          ) : user ? (
            <>
              <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
                Signed in
              </ThemedText>
              <ThemedText type="subtitle">
                {user.displayName ?? user.email ?? 'Account'}
              </ThemedText>
              {user.email ? (
                <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 4 }}>
                  {user.email}
                </ThemedText>
              ) : null}
              <ThemedText type="metadata" style={{ color: palette.placeholder, marginTop: 8 }}>
                UID: {user.uid}
              </ThemedText>

              <View style={[styles.hairline, { backgroundColor: palette.border }]} />

              {error ? (
                <ThemedText
                  type="metadata"
                  style={{ color: palette.tint, marginBottom: 8 }}>
                  {error}
                </ThemedText>
              ) : null}

              <View style={styles.buttonRow}>
                <Pressable
                  onPress={handleSignOut}
                  disabled={signingOut}
                  style={[
                    styles.ghostButton,
                    { borderColor: palette.border, opacity: signingOut ? 0.6 : 1 },
                  ]}>
                  {signingOut ? (
                    <ActivityIndicator color={palette.textMuted} />
                  ) : (
                    <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
                      Sign out
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
                Not signed in
              </ThemedText>
              <ThemedText type="subtitle">Welcome to Wheelbase.</ThemedText>
              <ThemedText
                type="default"
                style={{ color: palette.textMuted, marginTop: 4 }}>
                Sign in or create an account to save vehicles, upload photos, and share your
                builds.
              </ThemedText>

              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => router.push('/sign-in')}
                  style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
                  <ThemedText style={styles.primaryButtonText}>Sign in</ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 48,
    gap: 24,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: { gap: 10, alignItems: 'center' },
  rule: { width: 40, height: 2, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 28,
  },
  hairline: {
    height: 1,
    width: '100%',
    marginTop: 20,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ghostButton: {
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
