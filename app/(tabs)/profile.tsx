import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            The Driver
          </ThemedText>
          <ThemedText type="title">Your Profile</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <ThemedView
          style={[
            styles.card,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}>
          <View style={styles.cardBody}>
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
                <ThemedText
                  type="metadata"
                  style={{ color: palette.textMuted, marginTop: 6 }}>
                  UID: {user.uid}
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
                  Not signed in
                </ThemedText>
                <ThemedText type="subtitle">Create your Wheelbase account.</ThemedText>
                <ThemedText
                  type="default"
                  style={{ color: palette.textMuted, marginTop: 4 }}>
                  Sign-in is wired to Firebase Auth. Enable Email/Password in
                  the Firebase Console to activate it.
                </ThemedText>
              </>
            )}
          </View>
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
  rule: { width: 40, height: 2, marginTop: 2, marginBottom: 2 },
  card: { borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  cardBody: { padding: 24, gap: 6 },
});
