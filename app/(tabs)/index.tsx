import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function GarageScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandHeader />

        <View style={styles.titleBlock}>
          <ThemedText type="title">Your Garage</ThemedText>
          <ThemedText style={{ color: palette.icon }}>
            Every vehicle in your collection — specs, mods, and memories.
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.emptyCard,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}>
          <View style={[styles.badgeDot, { backgroundColor: palette.accent }]} />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No vehicles yet
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: palette.icon }]}>
            Add your first vehicle to pull OEM specs and start tracking customizations.
          </ThemedText>
          <Pressable
            onPress={() => {
              /* TODO: open Add Vehicle flow */
            }}
            style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
            <ThemedText style={styles.primaryButtonText}>+ Add a vehicle</ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 20,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: {
    gap: 6,
    alignItems: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  badgeDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  emptyTitle: { marginTop: 4 },
  emptyBody: { textAlign: 'center', maxWidth: 360 },
  primaryButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
