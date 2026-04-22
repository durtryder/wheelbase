import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  doc,
  getDoc,
} from 'firebase/firestore';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MediaItem, Vehicle } from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // Fetch just the cover photo's download URL when the vehicle has one. We
  // avoid subscribing to the whole /media collection per card so the Garage
  // stays cheap to render.
  useEffect(() => {
    let cancelled = false;
    if (!vehicle.coverPhotoId) {
      setCoverUrl(null);
      return;
    }
    getDoc(doc(db, 'media', vehicle.coverPhotoId))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.exists() ? (snap.data() as Partial<MediaItem>) : null;
        setCoverUrl(data?.downloadUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setCoverUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle.coverPhotoId]);

  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(' ');

  const locationLine = formatLocation(vehicle.location);

  return (
    <Pressable
      onPress={() => router.push(`/vehicles/${vehicle.id}`)}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: palette.border,
          backgroundColor: palette.surface,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={[styles.hero, { backgroundColor: palette.surfaceDim }]}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.heroImage} contentFit="cover" />
        ) : (
          <ThemedText type="eyebrow" style={{ color: palette.placeholder, letterSpacing: 2 }}>
            No photo
          </ThemedText>
        )}
      </View>

      <View style={styles.body}>
        {vehicle.nickname ? (
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            {vehicle.nickname}
          </ThemedText>
        ) : null}
        <ThemedText type="subtitle">{title}</ThemedText>

        <View style={[styles.hairline, { backgroundColor: palette.border }]} />

        <View style={styles.stats}>
          <Stat label="Mileage" value={formatMileage(vehicle.mileage)} palette={palette} />
          <Divider color={palette.border} />
          <Stat label="Exterior" value={vehicle.exteriorColor ?? '—'} palette={palette} />
          <Divider color={palette.border} />
          <Stat
            label="Mods"
            value={String(vehicle.modifications?.length ?? 0)}
            palette={palette}
          />
        </View>

        {locationLine ? (
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, marginTop: 12 }}>
            {locationLine}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: Palette;
}) {
  return (
    <View style={styles.stat}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={{ marginTop: 2, fontWeight: '600' }}>
        {value}
      </ThemedText>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

function formatMileage(m: number | undefined): string {
  if (m == null) return '—';
  return `${m.toLocaleString()} mi`;
}

function formatLocation(loc: Vehicle['location']): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.stateRegion, loc.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  hero: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: 20,
  },
  hairline: {
    height: 1,
    width: '100%',
    marginTop: 14,
    marginBottom: 14,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 12,
  },
});
