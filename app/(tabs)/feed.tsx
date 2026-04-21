import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function FeedScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Community Feed</ThemedText>
        <ThemedText style={{ color: palette.icon }}>
          Public builds shared by other enthusiasts.
        </ThemedText>
      </View>

      <ThemedView
        style={[styles.placeholder, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <IconSymbol name="square.grid.2x2.fill" size={40} color={palette.accent} />
        <ThemedText type="subtitle">Coming soon</ThemedText>
        <ThemedText style={[styles.placeholderBody, { color: palette.icon }]}>
          Once users start sharing public vehicle profiles, they'll appear here.
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 64, gap: 24 },
  header: { gap: 6 },
  placeholder: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  placeholderBody: { textAlign: 'center', maxWidth: 360 },
});
