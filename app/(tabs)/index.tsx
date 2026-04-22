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
        <BrandHeader height={96} />

        <View style={styles.titleBlock}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            The Garage
          </ThemedText>
          <ThemedText type="title">Your Collection</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          <ThemedText type="metadata" style={{ color: palette.textMuted, textAlign: 'center' }}>
            Specs, customizations, and stories for every vehicle you own.
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.card,
            {
              borderColor: palette.border,
              backgroundColor: palette.surface,
            },
          ]}>
          <View style={[styles.cardHero, { backgroundColor: palette.surfaceDim }]}>
            <ThemedText
              type="eyebrow"
              style={{ color: palette.textMuted, letterSpacing: 2 }}>
              Photo
            </ThemedText>
          </View>

          <View style={styles.cardBody}>
            <ThemedText type="eyebrow" style={{ color: palette.tint }}>
              No vehicles yet
            </ThemedText>
            <ThemedText type="subtitle">Start your garage.</ThemedText>
            <ThemedText
              type="default"
              style={{ color: palette.textMuted, marginTop: 4 }}>
              Add a vehicle to pull its OEM specs from NHTSA and begin
              documenting customizations, service, and provenance — the full
              story, Bring-a-Trailer style.
            </ThemedText>

            <View style={[styles.hairline, { backgroundColor: palette.border }]} />

            <View style={styles.metaRow}>
              <MetaItem label="Vehicles" value="0" palette={palette} />
              <Divider color={palette.border} />
              <MetaItem label="Photos" value="0" palette={palette} />
              <Divider color={palette.border} />
              <MetaItem label="Modifications" value="0" palette={palette} />
            </View>

            <Pressable
              onPress={() => {
                /* TODO: open Add Vehicle flow */
              }}
              style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <ThemedText style={styles.primaryButtonText}>Add a vehicle</ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        <View style={styles.footnote}>
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, textAlign: 'center' }}>
            OEM specs courtesy of the NHTSA vPIC database.
          </ThemedText>
        </View>
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
      <ThemedText
        type="eyebrow"
        style={{ color: palette.textMuted }}>
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
    paddingTop: 32,
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
    marginBottom: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardHero: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 24,
    gap: 6,
  },
  hairline: {
    height: 1,
    width: '100%',
    marginVertical: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
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
  primaryButton: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 2,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  footnote: {
    marginTop: 4,
    alignItems: 'center',
  },
});
