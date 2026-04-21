import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function GarageScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Your Garage</ThemedText>
        <ThemedText style={{ color: palette.icon }}>
          Every vehicle in your collection — specs, mods, and memories.
        </ThemedText>
      </View>

      <ThemedView
        style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <IconSymbol name="car.fill" size={48} color={palette.accent} />
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
          <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
          <ThemedText style={styles.primaryButtonText}>Add a vehicle</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    gap: 24,
  },
  header: {
    gap: 6,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    marginTop: 4,
  },
  emptyBody: {
    textAlign: 'center',
    maxWidth: 360,
  },
  primaryButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
