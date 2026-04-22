import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function GarageScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">My Garage</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <ThemedView
          style={[
            styles.card,
            {
              borderColor: palette.border,
              backgroundColor: palette.surface,
            },
          ]}>
          <ThemedText type="subtitle">No vehicles yet.</ThemedText>
          <ThemedText
            type="default"
            style={{ color: palette.textMuted, marginTop: 6 }}>
            Add a vehicle to begin documenting its specs, customizations, and
            history.
          </ThemedText>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => router.push('/vehicles/new')}
              style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <ThemedText style={styles.primaryButtonText}>Add a vehicle</ThemedText>
            </Pressable>
          </View>

          <View style={[styles.hairline, { backgroundColor: palette.border }]} />

          <View style={styles.metaRow}>
            <MetaItem label="Vehicles" value="0" palette={palette} />
            <Divider color={palette.border} />
            <MetaItem label="Photos" value="0" palette={palette} />
            <Divider color={palette.border} />
            <MetaItem label="Modifications" value="0" palette={palette} />
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

function MetaItem({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.metaItem}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
        {label}
      </ThemedText>
      <ThemedText type="subtitle" style={{ marginTop: 2 }}>
        {value}
      </ThemedText>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.verticalDivider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 48,
    gap: 24,
    maxWidth: 780,
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
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 28,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 18,
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
  hairline: {
    height: 1,
    width: '100%',
    marginTop: 26,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metaItem: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  verticalDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 16,
  },
});
