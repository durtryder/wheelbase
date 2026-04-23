import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleForm, type VehicleFormValue } from '@/components/vehicle-form';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getVehicle, updateVehicle } from '@/services/vehicles';
import type { Vehicle } from '@/types/vehicle';

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading: authLoading } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLoadError(null);
    getVehicle(id)
      .then((v) => {
        if (!cancelled) setVehicle(v);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load vehicle.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(value: VehicleFormValue) {
    if (!id) throw new Error('Missing vehicle id.');
    if (!user) throw new Error('You need to sign in to save changes.');
    if (vehicle && vehicle.ownerId !== user.uid) {
      throw new Error("You can only edit vehicles you own.");
    }

    const patch: Partial<Vehicle> = {
      year: value.year,
      make: value.make,
      model: value.model,
      trim: value.trim,
      nickname: value.nickname,
      vin: value.vin,
      mileage: value.mileage,
      exteriorColor: value.exteriorColor,
      interiorColor: value.interiorColor,
      location: value.location,
      builder: value.builder,
      modifications: value.modifications ?? [],
      ownershipHistory: value.ownershipHistory,
      buildSheet: value.buildSheet,
      visibility: value.visibility,
      oemSpecs: value.oemSpecs,
    };

    await updateVehicle(id, patch);
    router.replace(`/vehicles/${id}`);
  }

  // Loading
  if (authLoading || (vehicle === undefined && !loadError)) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.tint} />
        </View>
      </ThemedView>
    );
  }

  // Error or not-found
  if (loadError || vehicle === null) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="title">
            {loadError ? 'Something went wrong' : 'Vehicle not found'}
          </ThemedText>
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, textAlign: 'center', marginTop: 8 }}>
            {loadError ?? 'This vehicle may have been deleted or is private.'}
          </ThemedText>
          <View style={{ marginTop: 16 }}>
            <Pressable
              onPress={() => router.replace('/')}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
                Back to garage
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );
  }

  // Not the owner
  if (vehicle && user && vehicle.ownerId !== user.uid) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="title">Not your vehicle</ThemedText>
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, textAlign: 'center', marginTop: 8 }}>
            You can only edit vehicles in your own garage.
          </ThemedText>
          <View style={{ marginTop: 16 }}>
            <Pressable
              onPress={() => router.replace(`/vehicles/${vehicle.id}`)}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
                View vehicle
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );
  }

  if (!vehicle) return null; // satisfies TS

  const v = vehicle;

  return (
    <VehicleForm
      title={`Edit ${v.year} ${v.make} ${v.model}`.trim()}
      submitLabel="Save changes"
      signedIn={!!user}
      initialValue={{
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim,
        nickname: v.nickname,
        vin: v.vin,
        mileage: v.mileage,
        exteriorColor: v.exteriorColor,
        interiorColor: v.interiorColor,
        location: v.location,
        builder: v.builder,
        modifications: v.modifications,
        ownershipHistory: v.ownershipHistory,
        buildSheet: v.buildSheet,
        visibility: v.visibility,
        oemSpecs: v.oemSpecs,
      }}
      onSubmit={handleSubmit}
      onCancel={() => router.replace(`/vehicles/${v.id}`)}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  ghostButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
