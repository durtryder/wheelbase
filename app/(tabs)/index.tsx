import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { reorderVehicles, watchVehiclesForOwner } from '@/services/vehicles';
import type { Vehicle } from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

export default function GarageScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading: authLoading } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState(false);
  // Local override so the user sees their reorder reflected immediately;
  // the subscription will catch up in a beat but the optimistic list keeps
  // arrow taps feeling instantaneous.
  const [orderOverride, setOrderOverride] = useState<Vehicle[] | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // If the viewer is signed out, skip the Garage entirely and send them
  // straight to /sign-in. (The access gate has already let them past the
  // preview wall by this point.)
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/sign-in');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) {
      setVehicles(null);
      return;
    }
    setError(null);
    const unsub = watchVehiclesForOwner(
      user.uid,
      (v) => {
        setVehicles(v);
        // Drop any optimistic override once the authoritative snapshot
        // arrives — at that point the real order matches our local view.
        setOrderOverride(null);
      },
      (e) => setError(e.message),
    );
    return unsub;
  }, [user]);

  // Sort client-side so vehicles without a displayOrder (older records)
  // still appear, falling back to createdAt desc. Firestore can't orderBy
  // a missing field without dropping those docs, so we do it here.
  const sortedVehicles = useMemo(
    () => (orderOverride ?? (vehicles ? sortVehiclesByDisplayOrder(vehicles) : null)),
    [vehicles, orderOverride],
  );

  const totals = computeTotals(sortedVehicles);

  async function persistOrder(next: Vehicle[]) {
    setOrderOverride(next);
    setOrderSaving(true);
    setOrderError(null);
    try {
      await reorderVehicles(next.map((v) => v.id));
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : 'Could not save new order.');
    } finally {
      setOrderSaving(false);
    }
  }

  function moveVehicle(index: number, delta: -1 | 1) {
    if (!sortedVehicles) return;
    const target = index + delta;
    if (target < 0 || target >= sortedVehicles.length) return;
    const next = [...sortedVehicles];
    [next[index], next[target]] = [next[target], next[index]];
    void persistOrder(next);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">My Garage</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        {authLoading || !user ? (
          // authLoading: we don't know yet. no user: redirect effect above is
          // about to send them to /sign-in. Either way, render a spinner so
          // the "Your vehicles..." card is never flashed at signed-out users.
          <Centered>
            <ActivityIndicator color={palette.tint} />
          </Centered>
        ) : error ? (
          <ErrorState palette={palette} message={error} />
        ) : sortedVehicles === null ? (
          <Centered>
            <ActivityIndicator color={palette.tint} />
          </Centered>
        ) : sortedVehicles.length === 0 ? (
          <EmptyGarage palette={palette} onAdd={() => router.push('/vehicles/new')} />
        ) : (
          <>
            <View style={styles.addRow}>
              <ThemedText type="metadata" style={{ color: palette.textMuted }}>
                {totals.vehicles} {totals.vehicles === 1 ? 'vehicle' : 'vehicles'}
                {editingOrder && orderSaving ? ' · saving order…' : ''}
              </ThemedText>
              <View style={styles.headerActions}>
                {sortedVehicles.length > 1 ? (
                  <Pressable
                    onPress={() => setEditingOrder((e) => !e)}
                    style={[
                      styles.ghostButton,
                      {
                        borderColor: editingOrder ? palette.tint : palette.border,
                        backgroundColor: editingOrder ? palette.tint : 'transparent',
                      },
                    ]}>
                    <ThemedText
                      style={[
                        styles.ghostButtonText,
                        { color: editingOrder ? '#fff' : palette.text },
                      ]}>
                      {editingOrder ? 'Done' : 'Reorder'}
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => router.push('/vehicles/new')}
                  style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
                  <ThemedText style={styles.primaryButtonText}>Add a vehicle</ThemedText>
                </Pressable>
              </View>
            </View>

            {editingOrder ? (
              <ThemedText type="metadata" style={{ color: palette.textMuted }}>
                Tap the arrows on a card to move it up or down. Changes save
                as you go.
              </ThemedText>
            ) : null}
            {orderError ? (
              <ThemedText type="metadata" style={{ color: palette.tint }}>
                {orderError}
              </ThemedText>
            ) : null}

            <View style={styles.grid}>
              {sortedVehicles.map((v, i) => (
                <View key={v.id} style={styles.cardSlot}>
                  <View pointerEvents={editingOrder ? 'none' : 'auto'}>
                    <VehicleCard vehicle={v} />
                  </View>
                  {editingOrder ? (
                    <View style={styles.reorderControls}>
                      <Pressable
                        disabled={i === 0}
                        onPress={() => moveVehicle(i, -1)}
                        style={[
                          styles.reorderButton,
                          {
                            borderColor: palette.border,
                            backgroundColor: palette.surface,
                            opacity: i === 0 ? 0.4 : 1,
                          },
                        ]}>
                        <ThemedText
                          style={[styles.reorderButtonText, { color: palette.text }]}>
                          ↑
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        disabled={i === sortedVehicles.length - 1}
                        onPress={() => moveVehicle(i, 1)}
                        style={[
                          styles.reorderButton,
                          {
                            borderColor: palette.border,
                            backgroundColor: palette.surface,
                            opacity:
                              i === sortedVehicles.length - 1 ? 0.4 : 1,
                          },
                        ]}>
                        <ThemedText
                          style={[styles.reorderButtonText, { color: palette.text }]}>
                          ↓
                        </ThemedText>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

/**
 * Sort the garage: vehicles with an explicit displayOrder come first in
 * ascending order; anything without falls back to createdAt descending
 * (newest first, matching the original server order). Stable enough
 * that moving one card doesn't shuffle the unordered tail.
 */
function sortVehiclesByDisplayOrder(vehicles: Vehicle[]): Vehicle[] {
  const tsMillis = (ts: Vehicle['createdAt']) => {
    if (!ts) return 0;
    try {
      const d = typeof ts.toDate === 'function' ? ts.toDate() : (ts as unknown as Date);
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    } catch {
      return 0;
    }
  };
  return [...vehicles].sort((a, b) => {
    const aHas = typeof a.displayOrder === 'number';
    const bHas = typeof b.displayOrder === 'number';
    if (aHas && bHas) return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    if (aHas) return -1;
    if (bHas) return 1;
    return tsMillis(b.createdAt) - tsMillis(a.createdAt);
  });
}

function computeTotals(vehicles: Vehicle[] | null) {
  return { vehicles: vehicles?.length ?? 0 };
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
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 56,
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
  cardSlot: {
    position: 'relative',
  },
  reorderControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  reorderButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  ghostButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
