import { Image } from 'expo-image';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NEWS_SOURCE_LABELS, type NewsArticle } from '@/types/feed';

export function NewsCard({
  article,
  isGarageMatch,
}: {
  article: NewsArticle;
  isGarageMatch: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const handlePress = async () => {
    if (Platform.OS === 'web') {
      window.open(article.url, '_blank', 'noopener,noreferrer');
      return;
    }
    await openBrowserAsync(article.url, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  };

  const sourceLabel = NEWS_SOURCE_LABELS[article.source] ?? article.source;
  const matchedTag = isGarageMatch ? article.tags[0] : null;

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
      {article.imageUrl ? (
        <View style={[styles.hero, { backgroundColor: palette.surfaceDim }]}>
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.eyebrowRow}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            {sourceLabel}
          </ThemedText>
          {matchedTag ? (
            <View
              style={[
                styles.matchPill,
                { backgroundColor: palette.accent, borderColor: palette.accent },
              ]}>
              <ThemedText
                type="eyebrow"
                style={{ color: '#1a1a1a', fontSize: 10, letterSpacing: 1 }}>
                {`For your ${capitalize(matchedTag)}`}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <ThemedText type="subtitle" style={{ marginTop: 8 }}>
          {article.title}
        </ThemedText>

        {article.excerpt ? (
          <ThemedText
            type="default"
            style={{ color: palette.textMuted, marginTop: 10 }}
            numberOfLines={3}>
            {article.excerpt}
          </ThemedText>
        ) : null}

        <ThemedText
          type="metadata"
          style={{ color: palette.textMuted, marginTop: 14 }}>
          {formatRelativeTime(article.publishedAt.toMillis())}
          {article.author ? ` · ${article.author}` : ''}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s
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
