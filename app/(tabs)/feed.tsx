import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { BaTCard } from '@/components/bat-card';
import { MediaCard } from '@/components/media-card';
import { NewsCard } from '@/components/news-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { watchFeedForUser } from '@/services/feed';
import { watchVehiclesForOwner } from '@/services/vehicles';
import type { ScoredFeedItem } from '@/types/feed';
import type { Vehicle } from '@/types/vehicle';

export default function FeedScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const { user, loading: authLoading } = useAuth();
  const [userVehicles, setUserVehicles] = useState<Vehicle[]>([]);
  const [feedItems, setFeedItems] = useState<ScoredFeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUserVehicles([]);
      return;
    }
    setError(null);
    return watchVehiclesForOwner(
      user.uid,
      setUserVehicles,
      (e) => setError(e.message),
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFeedItems(null);
      return;
    }
    setError(null);
    return watchFeedForUser(
      user.uid,
      userVehicles,
      setFeedItems,
      (e) => setError(e.message),
    );
  }, [user, userVehicles]);

  const isLoading = authLoading || (user && feedItems === null);
  const garageEmpty = !!user && userVehicles.length === 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">Your Feed</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, marginTop: 8, textAlign: 'center' }}>
            News, listings & garage moments — last 90 days, tuned to your builds.
          </ThemedText>
        </View>

        {!user && !authLoading ? (
          <SignedOutPrompt palette={palette} />
        ) : error ? (
          <ErrorCard palette={palette} message={error} />
        ) : isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.tint} />
          </View>
        ) : feedItems && feedItems.length === 0 ? (
          <EmptyFeed palette={palette} garageEmpty={garageEmpty} />
        ) : (
          <View style={styles.grid}>
            {garageEmpty ? <GaragePrompt palette={palette} /> : null}
            {feedItems?.map(({ item, relevanceScore }) => {
              const isMatch = relevanceScore > 0;
              switch (item.kind) {
                case 'article':
                  return (
                    <NewsCard
                      key={`article_${item.id}`}
                      article={item}
                      isGarageMatch={isMatch}
                    />
                  );
                case 'bat_listing':
                  return (
                    <BaTCard
                      key={`bat_${item.id}`}
                      listing={item}
                      isGarageMatch={isMatch}
                    />
                  );
                case 'garage_media':
                  return <MediaCard key={`media_${item.id}`} item={item} />;
              }
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function GaragePrompt({ palette }: { palette: (typeof Colors)['light'] }) {
  return (
    <ThemedView
      style={[
        styles.card,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <ThemedText type="eyebrow" style={{ color: palette.tint }}>
        Personalize your feed
      </ThemedText>
      <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 8 }}>
        Add your first vehicle and we&apos;ll surface news and BaT listings that
        match your makes & models.
      </ThemedText>
    </ThemedView>
  );
}

function EmptyFeed({
  palette,
  garageEmpty,
}: {
  palette: (typeof Colors)['light'];
  garageEmpty: boolean;
}) {
  return (
    <ThemedView
      style={[
        styles.card,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <ThemedText type="subtitle">No feed items yet.</ThemedText>
      <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 6 }}>
        {garageEmpty
          ? 'Add a vehicle to your garage to start tuning the feed. Articles and BaT listings sync hourly.'
          : 'Articles and BaT listings sync hourly. Check back shortly.'}
      </ThemedText>
    </ThemedView>
  );
}

function SignedOutPrompt({ palette }: { palette: (typeof Colors)['light'] }) {
  return (
    <ThemedView
      style={[
        styles.card,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <ThemedText type="subtitle">Sign in to see your feed.</ThemedText>
      <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 6 }}>
        Wheelbase tunes the feed to the makes & models in your garage. Sign in
        to start seeing matched news and BaT listings.
      </ThemedText>
    </ThemedView>
  );
}

function ErrorCard({
  palette,
  message,
}: {
  palette: (typeof Colors)['light'];
  message: string;
}) {
  return (
    <ThemedView
      style={[
        styles.card,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <ThemedText type="eyebrow" style={{ color: palette.tint }}>
        Couldn&apos;t load the feed
      </ThemedText>
      <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 8 }}>
        {message}
      </ThemedText>
      <ThemedText
        type="metadata"
        style={{ color: palette.textMuted, marginTop: 6, fontStyle: 'italic' }}>
        If Firestore mentions a missing index, the error includes a one-click
        link to create it.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 56,
    gap: 24,
    maxWidth: 1024,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: { gap: 6, alignItems: 'center' },
  rule: { width: 40, height: 2, marginTop: 2 },
  centered: {
    padding: 40,
    alignItems: 'center',
  },
  grid: { gap: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 28,
  },
});
