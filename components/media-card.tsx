import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { GarageMediaFeedItem } from '@/types/feed';

export function MediaCard({ item }: { item: GarageMediaFeedItem }) {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <Pressable
      onPress={() =>
        router.push(`/vehicles/${item.vehicleId}?media=${encodeURIComponent(item.id)}`)
      }
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: palette.border,
          backgroundColor: palette.surface,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      {item.imageUrl ? (
        <View style={[styles.hero, { backgroundColor: palette.surfaceDim }]}>
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <ThemedText type="eyebrow" style={{ color: palette.tint }}>
          From your garage
        </ThemedText>
        <ThemedText type="subtitle" style={{ marginTop: 8 }}>
          {item.vehicleName}
        </ThemedText>

        {item.caption ? (
          <ThemedText
            type="default"
            style={{ color: palette.textMuted, marginTop: 10 }}
            numberOfLines={3}>
            {item.caption}
          </ThemedText>
        ) : null}

        <ThemedText
          type="metadata"
          style={{ color: palette.textMuted, marginTop: 12 }}>
          {formatRelativeTime(item.publishedAt.toMillis())}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(ms).toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  hero: {
    aspectRatio: 16 / 9,
    width: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: 20,
  },
});
