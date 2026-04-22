import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { watchVehiclesForOwner } from '@/services/vehicles';
import type { Vehicle } from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

export default function GarageScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading: authLoading } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setVehicles(null);
      return;
    }
    setError(null);
    const unsub = watchVehiclesForOwner(
      user.uid,
      (v) => setVehicles(v),
      (e) => setError(e.message),
    );
    return unsub;
  }, [user]);

  const totals = computeTotals(vehicles);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">My Garage</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        {authLoading ? (
          <Centered>
            <ActivityIndicator color={palette.tint} />
          </Centered>
        ) : !user ? (
          <SignedOutEmpty palette={palette} onSignIn={() => router.push('/sign-in')} />
        ) : error ? (
          <ErrorState palette={palette} message={error} />
        ) : vehicles === null ? (
          <Centered>
            <ActivityIndicator color={palette.tint} />
          </Centered>
        ) : vehicles.length === 0 ? (
          <EmptyGarage palette={palette} onAdd={() => router.push('/vehicles/new')} />
        ) : (
          <>
            <View style={styles.addRow}>
              <ThemedText type="metadata" style={{ color: palette.textMuted }}>
                {totals.vehicles} {totals.vehicles === 1 ? 'vehicle' : 'vehicles'}
                {totals.modifications > 0 ? ` · ${totals.modifications} modifications` : ''}
              </ThemedText>
              <Pressable
                onPress={() => router.push('/vehicles/new')}
                style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
                <ThemedText style={styles.primaryButtonText}>Add a vehicle</ThemedText>
              </Pressable>
            </View>

            <View style={styles.grid}>
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function computeTotals(vehicles: Vehicle[] | null) {
  if (!vehicles) return { vehicles: 0, modifications: 0 };
  return {
    vehicles: vehicles.length,
    modifications: vehicles.reduce(
      (sum, v) => sum + (v.modifications?.length ?? 0),
      0,
    ),
  };
}

function SignedOutEmpty({ palette, onSignIn }: { palette: Palette; onSignIn: () => void }) {
  return (
    <ThemedView
      style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <ThemedText type="subtitle">Sign in to see your garage.</ThemedText>
      <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 6 }}>
        Your vehicles, customizations, and history live on your account — create one in a
        minute to start building.
      </ThemedText>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onSignIn}
          style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
          <ThemedText style={styles.primaryButtonText}>Sign in</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function EmptyGarage({ palette, onAdd }: { palette: Palette; onAdd: () => void }) {
  return (
    <ThemedView
      style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <ThemedText type="subtitle">No vehicles yet.</ThemedText>
      <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 6 }}>
        Add a vehicle to begin documenting its specs, customizations, and history.
      </ThemedText>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onAdd}
          style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
          <ThemedText style={styles.primaryButtonText}>Add a vehicle</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function ErrorState({ palette, message }: { palette: Palette; message: string }) {
  return (
    <ThemedView
      style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <ThemedText type="eyebrow" style={{ color: palette.tint }}>
        Couldn&apos;t load your garage
      </ThemedText>
      <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 8 }}>
        {message}
      </ThemedText>
      <ThemedText
        type="metadata"
        style={{ color: palette.textMuted, marginTop: 6, fontStyle: 'italic' }}>
        If this is about a missing index, Firestore usually includes a one-click link to
        create it in the error message above.
      </ThemedText>
    </ThemedView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
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
  titleBlock: {
    gap: 10,
    alignItems: 'center',
  },
  rule: {
    width: 40,
    height: 2,
    marginTop: 2,
  },
  centered: {
    padding: 40,
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 28,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  grid: {
    gap: 20,
  },
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
