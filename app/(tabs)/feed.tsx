import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { watchPublicVehicles } from '@/services/vehicles';
import type { Vehicle } from '@/types/vehicle';

export default function FeedScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const unsub = watchPublicVehicles(
      (v) => setVehicles(v),
      (e) => setError(e.message),
    );
    return unsub;
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">Community Builds</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, textAlign: 'center' }}>
            Every vehicle marked Public by its owner shows up here.
          </ThemedText>
        </View>

        {error ? (
          <ErrorCard palette={palette} message={error} />
        ) : vehicles === null ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.tint} />
          </View>
        ) : vehicles.length === 0 ? (
          <EmptyFeed palette={palette} />
        ) : (
          <View style={styles.grid}>
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function EmptyFeed({ palette }: { palette: (typeof Colors)['light'] }) {
  return (
    <ThemedView
      style={[
        styles.card,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <ThemedText type="subtitle">No public builds yet.</ThemedText>
      <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 6 }}>
        Once Wheelbase users flip their vehicles to Public, you&apos;ll see them
        here — specs, photos, build notes, everything.
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
      style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
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
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 64,
    gap: 24,
    maxWidth: 1024,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: { gap: 10, alignItems: 'center' },
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
