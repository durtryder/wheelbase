import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteVehicle, getVehicle } from '@/services/vehicles';
import type { OemSpecs, Vehicle } from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setError(null);
    getVehicle(id)
      .then((v) => {
        if (!cancelled) setVehicle(v);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load vehicle.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this vehicle? This cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      await deleteVehicle(id);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  if (vehicle === undefined && !error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.tint} />
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Something went wrong</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.tint }}>
            {error}
          </ThemedText>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => router.replace('/')}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
                Back to garage
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  if (vehicle === null) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Vehicle not found</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.textMuted }}>
            This vehicle may have been deleted or is private.
          </ThemedText>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => router.replace('/')}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
                Back to garage
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  const v = vehicle!;
  const isOwner = !!user && user.uid === v.ownerId;
  const title = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: palette.surfaceDim, borderColor: palette.border }]}>
          <ThemedText type="eyebrow" style={{ color: palette.placeholder, letterSpacing: 2 }}>
            Photo — coming in Step 4
          </ThemedText>
        </View>

        <View style={styles.titleBlock}>
          {v.nickname ? (
            <ThemedText type="eyebrow" style={{ color: palette.tint }}>
              {v.nickname}
            </ThemedText>
          ) : null}
          <ThemedText type="title">{title}</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <View style={styles.headlineStats}>
          <HeadlineStat label="Mileage" value={formatMileage(v.mileage)} palette={palette} />
          <HeadlineDivider color={palette.border} />
          <HeadlineStat label="Exterior" value={v.exteriorColor ?? '—'} palette={palette} />
          <HeadlineDivider color={palette.border} />
          <HeadlineStat label="Interior" value={v.interiorColor ?? '—'} palette={palette} />
          <HeadlineDivider color={palette.border} />
          <HeadlineStat
            label="Location"
            value={formatLocation(v.location) ?? '—'}
            palette={palette}
          />
        </View>

        <Section title="Vehicle Details" palette={palette}>
          <DetailRow label="Year" value={String(v.year)} palette={palette} />
          <DetailRow label="Make" value={v.make} palette={palette} />
          <DetailRow label="Model" value={v.model} palette={palette} />
          {v.trim ? <DetailRow label="Trim" value={v.trim} palette={palette} /> : null}
          {v.vin ? <DetailRow label="VIN" value={v.vin} palette={palette} /> : null}
          {v.chassisNumber ? (
            <DetailRow label="Chassis Number" value={v.chassisNumber} palette={palette} />
          ) : null}
          {v.titleStatus ? (
            <DetailRow label="Title Status" value={v.titleStatus} palette={palette} />
          ) : null}
        </Section>

        {v.oemSpecs ? (
          <Section title={`OEM Specifications (${sourceName(v.oemSpecs.source)})`} palette={palette}>
            <DetailRow label="Body Class" value={v.oemSpecs.bodyClass} palette={palette} />
            <DetailRow
              label="Cylinders"
              value={v.oemSpecs.engineCylinders?.toString()}
              palette={palette}
            />
            <DetailRow
              label="Displacement"
              value={formatDisplacement(v.oemSpecs.displacementCc, v.oemSpecs.displacementCi)}
              palette={palette}
            />
            <DetailRow label="Fuel Type" value={v.oemSpecs.fuelType} palette={palette} />
            <DetailRow label="Drivetrain" value={v.oemSpecs.driveType} palette={palette} />
            <DetailRow
              label="Transmission"
              value={formatTransmission(
                v.oemSpecs.transmissionStyle,
                v.oemSpecs.transmissionSpeeds,
              )}
              palette={palette}
            />
            <DetailRow
              label="Plant"
              value={formatPlant(
                v.oemSpecs.plantCity,
                v.oemSpecs.plantState,
                v.oemSpecs.plantCountry,
              )}
              palette={palette}
            />
            <DetailRow label="Manufacturer" value={v.oemSpecs.manufacturer} palette={palette} />
            <DetailRow label="Vehicle Type" value={v.oemSpecs.vehicleType} palette={palette} />
          </Section>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.replace('/')}
            style={[styles.ghostButton, { borderColor: palette.border }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              Back to garage
            </ThemedText>
          </Pressable>
          {isOwner ? (
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={[
                styles.dangerButton,
                { borderColor: palette.tint, opacity: deleting ? 0.6 : 1 },
              ]}>
              {deleting ? (
                <ActivityIndicator color={palette.tint} />
              ) : (
                <ThemedText style={[styles.dangerButtonText, { color: palette.tint }]}>
                  Delete vehicle
                </ThemedText>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: Palette;
  children: React.ReactNode;
}) {
  const filtered = filterNonEmpty(children);
  if (filtered.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
      </View>
      <View style={[styles.detailTable, { borderColor: palette.border }]}>{filtered}</View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string | undefined;
  palette: Palette;
}) {
  if (!value) return null;
  return (
    <View style={[styles.detailRow, { borderBottomColor: palette.border }]}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted, flex: 1, maxWidth: 200 }}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={{ flex: 2, textAlign: 'right' }}>
        {value}
      </ThemedText>
    </View>
  );
}

function HeadlineStat({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: Palette;
}) {
  return (
    <View style={styles.headlineStat}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={{ marginTop: 4, fontWeight: '600' }}>
        {value}
      </ThemedText>
    </View>
  );
}

function HeadlineDivider({ color }: { color: string }) {
  return <View style={[styles.headlineDivider, { backgroundColor: color }]} />;
}

function filterNonEmpty(children: React.ReactNode) {
  const arr = Array.isArray(children) ? children : [children];
  return arr.filter(Boolean);
}

function formatMileage(m: number | undefined) {
  if (m == null) return '—';
  return `${m.toLocaleString()} mi`;
}

function formatLocation(loc: Vehicle['location']): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.stateRegion, loc.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function formatDisplacement(cc: number | undefined, ci: number | undefined) {
  if (cc) return `${(cc / 1000).toFixed(1)}L (${Math.round(cc)} cc)`;
  if (ci) return `${ci} CI`;
  return undefined;
}

function formatTransmission(style: string | undefined, speeds: number | undefined) {
  if (style && speeds) return `${speeds}-speed ${style}`;
  return style || (speeds ? `${speeds}-speed` : undefined);
}

function formatPlant(city?: string, state?: string, country?: string) {
  const parts = [city, state, country].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function sourceName(source: OemSpecs['source']) {
  switch (source) {
    case 'vpic':
      return 'NHTSA vPIC';
    case 'wikidata':
      return 'Wikidata';
    case 'carquery':
      return 'CarQuery';
    case 'manual':
      return 'Manual';
    default:
      return 'External';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 64,
    gap: 28,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  hero: {
    aspectRatio: 16 / 9,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: 8,
    alignItems: 'center',
  },
  rule: {
    width: 40,
    height: 2,
    marginTop: 6,
  },
  headlineStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 6,
  },
  headlineStat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headlineDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 14,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    gap: 10,
  },
  sectionRule: {
    height: 1,
    width: '100%',
  },
  detailTable: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
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
  dangerButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
});
