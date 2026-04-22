import { ScrollView, StyleSheet, View } from 'react-native';

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
        <View style={styles.titleBlock}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            The Feed
          </ThemedText>
          <ThemedText type="title">Community Builds</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, textAlign: 'center' }}>
            Public vehicle profiles shared by other enthusiasts.
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.card,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}>
          <View style={[styles.cardHero, { backgroundColor: palette.surfaceDim }]}>
            <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
              Coming Soon
            </ThemedText>
          </View>
          <View style={styles.cardBody}>
            <ThemedText type="subtitle">Public listings roll in here.</ThemedText>
            <ThemedText
              type="default"
              style={{ color: palette.textMuted, marginTop: 4 }}>
              Once users publish vehicle profiles, their builds will appear as
              cards in this feed — hero photo, stats, and quick links into the
              full spec sheet.
            </ThemedText>
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
  cardHero: { aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 24, gap: 6 },
});
