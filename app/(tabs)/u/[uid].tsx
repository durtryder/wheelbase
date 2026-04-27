import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildInstagramUrl } from '@/lib/instagram';
import { watchPublicVehiclesByOwner } from '@/services/vehicles';
import { watchUserProfile } from '@/services/users';
import type { Vehicle } from '@/types/vehicle';
import type { UserProfile } from '@/types/user';

type Palette = (typeof Colors)['light'];

export default function PublicProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!uid) return;
    setError(null);
    setVehicles(null);
    const unsub = watchPublicVehiclesByOwner(
      uid,
      (v) => setVehicles(v),
      (e) => setError(e.message),
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = watchUserProfile(
      uid,
      (p) => setProfile(p),
      // Profile-load errors aren't fatal — without a profile we just skip the
      // chip. Log so it shows up if rules misfire, but don't block the page.
      (err) => console.warn('[profile] could not load user profile', err),
    );
    return unsub;
  }, [uid]);

  const instagramHandle = profile?.instagramHandle?.trim() || null;

  // Derive the display name from any of the builder's vehicles. All of their
  // vehicles carry the same denormalized ownerDisplayName, so the first one
  // we see is authoritative enough — if no vehicles exist yet we fall back.
  const displayName = useMemo(() => {
    const fromVehicle = vehicles?.[0]?.ownerDisplayName?.trim();
    if (fromVehicle) return fromVehicle;
    return null;
  }, [vehicles]);

  const isSelf = !!user && user.uid === uid;
  const headerName =
    displayName ??
    (isSelf ? (user?.displayName?.trim() || 'You') : 'A Wheelbase member');

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            Public Garage
          </ThemedText>
          <ThemedText type="title">{headerName}</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          {instagramHandle ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open @${instagramHandle} on Instagram`}
              onPress={() => Linking.openURL(buildInstagramUrl(instagramHandle))}
              style={({ hovered, pressed }) => [
                styles.instagramChip,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.surfaceDim,
                  opacity: pressed ? 0.85 : 1,
                },
                hovered ? ({ cursor: 'pointer' } as object) : null,
              ]}>
              <ThemedText
                type="eyebrow"
                style={{ color: palette.textMuted, letterSpacing: 1.5 }}>
                INSTAGRAM
              </ThemedText>
              <ThemedText
                type="metadata"
                style={{ color: palette.tint, fontWeight: '600' }}>
                @{instagramHandle}
              </ThemedText>
            </Pressable>
          ) : null}
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, textAlign: 'center' }}>
            Every vehicle this builder has chosen to make public.
          </ThemedText>
        </View>

        {error ? (
          <ErrorCard palette={palette} message={error} />
        ) : vehicles === null ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.tint} />
          </View>
        ) : vehicles.length === 0 ? (
          <EmptyProfile palette={palette} isSelf={isSelf} />
        ) : (
          <View style={styles.grid}>
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </View>
        )}

        {!user ? (
          <View style={styles.cta}>
            <Pressable
              onPress={() => router.push('/sign-in')}
              style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <ThemedText style={styles.primaryButtonText}>
                Start your own garage
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function EmptyProfile({
  palette,
  isSelf,
}: {
  palette: Palette;
  isSelf: boolean;
}) {
  return (
    <ThemedView
      style={[
        styles.card,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <ThemedText type="subtitle">
        {isSelf ? 'Nothing public yet.' : 'No public builds yet.'}
      </ThemedText>
      <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 6 }}>
        {isSelf
          ? 'Flip any of your vehicles to Public from the Edit page and it\u2019ll appear here.'
          : 'This builder hasn\u2019t made any vehicles public yet. Check back later.'}
      </ThemedText>
    </ThemedView>
  );
}

function ErrorCard({
  palette,
  message,
}: {
  palette: Palette;
  message: string;
}) {
  return (
    <ThemedView
      style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <ThemedText type="eyebrow" style={{ color: palette.tint }}>
        Couldn&apos;t load this profile
      </ThemedText>
      <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 8 }}>
        {message}
      </ThemedText>
      <ThemedText
        type="metadata"
        style={{ color: palette.textMuted, marginTop: 6, fontStyle: 'italic' }}>
        If Firestore mentions a missing index, the error above includes a
        one-click link to create it.
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
  cta: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButton: {
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  instagramChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'center',
  },
});
