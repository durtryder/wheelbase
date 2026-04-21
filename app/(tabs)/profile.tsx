import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
        <ThemedText style={{ color: palette.icon }}>Your Wheelbase account and settings.</ThemedText>
      </View>

      <ThemedView
        style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <IconSymbol name="person.crop.circle.fill" size={48} color={palette.accent} />
        {loading ? (
          <ThemedText>Loading…</ThemedText>
        ) : user ? (
          <>
            <ThemedText type="subtitle">{user.displayName ?? user.email ?? 'Signed in'}</ThemedText>
            <ThemedText style={{ color: palette.icon }}>UID: {user.uid}</ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="subtitle">Not signed in</ThemedText>
            <ThemedText style={[styles.body, { color: palette.icon }]}>
              Sign-in flow is wired to Firebase Auth — add your Firebase env vars to enable it.
            </ThemedText>
          </>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 64, gap: 24 },
  header: { gap: 6 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  body: { textAlign: 'center', maxWidth: 360 },
});
