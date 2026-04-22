import { ScrollView, StyleSheet, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function FeedScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandHeader height={80} />

        <View style={styles.titleBlock}>
          <ThemedText type="title">Community Feed</ThemedText>
          <ThemedText style={{ color: palette.icon }}>
            Public builds shared by other enthusiasts.
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.placeholder,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}>
          <View style={[styles.badgeDot, { backgroundColor: palette.accent }]} />
          <ThemedText type="subtitle">Coming soon</ThemedText>
          <ThemedText style={[styles.placeholderBody, { color: palette.icon }]}>
            Once users start sharing public vehicle profiles, they&apos;ll appear here.
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 20,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: { gap: 6, alignItems: 'center' },
  placeholder: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  badgeDot: { width: 40, height: 40, borderRadius: 20 },
  placeholderBody: { textAlign: 'center', maxWidth: 360 },
});
