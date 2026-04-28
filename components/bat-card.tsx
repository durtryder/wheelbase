import { Image } from 'expo-image';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { feedThumbnailUrl } from '@/lib/feed-image';
import type { BaTListing } from '@/types/feed';

export function BaTCard({
  listing,
  isGarageMatch,
}: {
  listing: BaTListing;
  isGarageMatch: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [imageFailed, setImageFailed] = useState(false);
  const heroSrc = feedThumbnailUrl(listing.imageUrl);

  const handlePress = async () => {
    if (Platform.OS === 'web') {
      window.open(listing.url, '_blank', 'noopener,noreferrer');
      return;
    }
    await openBrowserAsync(listing.url, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  };

  const subtitleParts = [
    listing.year,
    listing.make ? capitalize(listing.make) : null,
    listing.model ? capitalize(listing.model) : null,
  ].filter(Boolean);
  const subtitle = subtitleParts.length ? subtitleParts.join(' ') : null;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: palette.border,
          backgroundColor: palette.surface,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      {heroSrc && !imageFailed ? (
        <View style={[styles.hero, { backgroundColor: palette.surfaceDim }]}>
          <Image
            source={{ uri: heroSrc }}
            style={styles.heroImage}
            contentFit="cover"
            transition={250}
            onError={() => setImageFailed(true)}
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.eyebrowRow}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            Bring a Trailer
          </ThemedText>
          {isGarageMatch && listing.make ? (
            <View
              style={[
                styles.matchPill,
                { backgroundColor: palette.accent, borderColor: palette.accent },
              ]}>
              <ThemedText
                type="eyebrow"
                style={{ color: '#1a1a1a', fontSize: 10, letterSpacing: 1 }}>
                {`For your ${capitalize(listing.make)}`}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <ThemedText type="subtitle" style={{ marginTop: 8 }}>
          {listing.title}
        </ThemedText>

        {subtitle ? (
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, marginTop: 8 }}>
            {subtitle}
          </ThemedText>
        ) : null}

        <ThemedText
          type="metadata"
          style={{ color: palette.textMuted, marginTop: 12 }}>
          {formatRelativeTime(listing.publishedAt.toMillis())}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function capitalize(s: string | number | undefined): string {
  if (s == null) return '';
  const str = String(s);
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  matchPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
