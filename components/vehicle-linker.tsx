import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { listVehiclesForOwner } from '@/services/vehicles';
import type { Vehicle } from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

/**
 * Single-select chip row for picking a vehicle from the owner's garage.
 * Used by the notebook composer + detail screens to cross-link entries
 * to a specific car. The "None" chip clears the selection. Loads the
 * garage list once on mount; if the user creates a vehicle in another
 * tab during composition, they'd need to revisit the page to pick it
 * up — acceptable for Phase 1.
 */
export function VehicleLinker({
  ownerId,
  value,
  onChange,
  palette,
}: {
  ownerId: string;
  value: string | undefined;
  onChange: (vehicleId: string | undefined) => void;
  palette: Palette;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listVehiclesForOwner(ownerId)
      .then((vs) => {
        if (!cancelled) setVehicles(vs);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load vehicles.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  if (vehicles === null && !error) {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={palette.tint} />
      </View>
    );
  }

  if (error) {
    return (
      <ThemedText type="metadata" style={{ color: palette.tint }}>
        {error}
      </ThemedText>
    );
  }

  if (!vehicles || vehicles.length === 0) {
    return (
      <ThemedText type="metadata" style={{ color: palette.placeholder }}>
        Add a vehicle to your garage to link entries to it.
      </ThemedText>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      <Chip
        label="None"
        active={!value}
        onPress={() => onChange(undefined)}
        palette={palette}
      />
      {vehicles.map((v) => (
        <Chip
          key={v.id}
          label={[v.year, v.make, v.model].filter(Boolean).join(' ')}
          active={value === v.id}
          onPress={() => onChange(v.id)}
          palette={palette}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
  palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        styles.chip,
        active
          ? { backgroundColor: palette.tint, borderColor: palette.tint }
          : { backgroundColor: 'transparent', borderColor: palette.border },
        hovered ? ({ cursor: 'pointer' } as object) : null,
      ]}>
      <ThemedText
        type="metadata"
        style={{
          color: active ? '#fff' : palette.text,
          fontWeight: active ? '700' : '500',
        }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
});
