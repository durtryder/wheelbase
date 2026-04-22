import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Palette = (typeof Colors)['light'];

type Family = {
  name: string;
  note: string;
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
};

const FAMILIES: Family[] = [
  {
    name: 'Manrope',
    note: 'Currently in use. Geometric with a touch of warmth; reads modern-editorial.',
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
  },
  {
    name: 'Inter',
    note: 'Neutral, ubiquitous on product sites. The safest and most utilitarian of the four.',
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  {
    name: 'IBM Plex Sans',
    note: 'Modern with character. A bit of contrast and a slightly mechanical rhythm.',
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_500Medium',
    semibold: 'IBMPlexSans_600SemiBold',
    bold: 'IBMPlexSans_700Bold',
  },
  {
    name: 'Space Grotesk',
    note: 'Geometric and a little quirky. Design-forward, plays well with automotive-nerdy.',
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
];

export default function FontsComparisonScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">Font comparison</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, textAlign: 'center' }}>
            Same Wheelbase copy rendered in each candidate. Serif headlines
            stay identical — you&apos;re evaluating the sans.
          </ThemedText>
        </View>

        {FAMILIES.map((family) => (
          <FamilyCard key={family.name} family={family} palette={palette} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function FamilyCard({ family, palette }: { family: Family; palette: Palette }) {
  return (
    <ThemedView
      style={[
        styles.card,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.familyName, { color: palette.text, fontFamily: family.bold }]}>
          {family.name}
        </Text>
        <Text
          style={[styles.familyNote, { color: palette.textMuted, fontFamily: family.regular }]}>
          {family.note}
        </Text>
      </View>

      <View style={[styles.hairline, { backgroundColor: palette.border }]} />

      {/* Eyebrow (uppercase tiny) */}
      <Text
        style={[
          styles.eyebrow,
          { color: palette.tint, fontFamily: family.bold },
        ]}>
        The Garage
      </Text>

      {/* Vehicle listing mock */}
      <Text
        style={[
          styles.listingTitle,
          { color: palette.text, fontFamily: family.bold },
        ]}>
        1967 Porsche 911S
      </Text>
      <Text
        style={[
          styles.listingBody,
          { color: palette.text, fontFamily: family.regular },
        ]}>
        Matching-numbers 911S from the famed &ldquo;soft-window&rdquo; era. Irish Green over
        black leatherette. Recent service by a marque specialist, correct Fuchs wheels,
        Blaupunkt Frankfurt still fitted. The running, hard-to-find, and usable kind
        of short-wheelbase 911.
      </Text>

      <View style={[styles.hairline, { backgroundColor: palette.border }]} />

      {/* Stats row */}
      <View style={styles.stats}>
        <Stat family={family} palette={palette} label="Mileage" value="42,180 mi" />
        <Divider color={palette.border} />
        <Stat family={family} palette={palette} label="Exterior" value="Irish Green" />
        <Divider color={palette.border} />
        <Stat family={family} palette={palette} label="Drivetrain" value="RWD, 5-speed" />
      </View>

      <View style={[styles.hairline, { backgroundColor: palette.border }]} />

      {/* Metadata line */}
      <Text
        style={[
          styles.metadata,
          { color: palette.textMuted, fontFamily: family.regular },
        ]}>
        Taken March 12, 2024  ·  iPhone 15 Pro  ·  35 mm · f/1.8 · 1/250s · ISO 100
      </Text>

      {/* Form label + input sample */}
      <View style={styles.formMock}>
        <Text
          style={[
            styles.formLabel,
            { color: palette.textMuted, fontFamily: family.bold },
          ]}>
          VIN
        </Text>
        <Text
          style={[
            styles.formInputPlaceholder,
            {
              color: palette.placeholder,
              borderColor: palette.border,
              fontFamily: family.regular,
            },
          ]}>
          17-character VIN (optional for pre-1981 vehicles)
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <View
          style={[
            styles.primaryButton,
            { backgroundColor: palette.tint },
          ]}>
          <Text style={[styles.primaryButtonText, { fontFamily: family.semibold }]}>
            Save vehicle
          </Text>
        </View>
        <View
          style={[
            styles.ghostButton,
            { borderColor: palette.border },
          ]}>
          <Text
            style={[
              styles.ghostButtonText,
              { color: palette.text, fontFamily: family.semibold },
            ]}>
            Cancel
          </Text>
        </View>
      </View>

      {/* Weight ladder */}
      <View style={[styles.hairline, { backgroundColor: palette.border }]} />
      <Text
        style={[
          styles.ladderLabel,
          { color: palette.textMuted, fontFamily: family.bold },
        ]}>
        WEIGHTS
      </Text>
      <Text style={[styles.ladderSample, { color: palette.text, fontFamily: family.regular }]}>
        Regular 400 — The quick brown fox jumps over the lazy dog.
      </Text>
      <Text style={[styles.ladderSample, { color: palette.text, fontFamily: family.medium }]}>
        Medium 500 — The quick brown fox jumps over the lazy dog.
      </Text>
      <Text style={[styles.ladderSample, { color: palette.text, fontFamily: family.semibold }]}>
        SemiBold 600 — The quick brown fox jumps over the lazy dog.
      </Text>
      <Text style={[styles.ladderSample, { color: palette.text, fontFamily: family.bold }]}>
        Bold 700 — The quick brown fox jumps over the lazy dog.
      </Text>
    </ThemedView>
  );
}

function Stat({
  family,
  palette,
  label,
  value,
}: {
  family: Family;
  palette: Palette;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Text
        style={[
          styles.statLabel,
          { color: palette.textMuted, fontFamily: family.bold },
        ]}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={[
          styles.statValue,
          { color: palette.text, fontFamily: family.semibold },
        ]}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 64,
    gap: 28,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: { gap: 10, alignItems: 'center' },
  rule: { width: 40, height: 2, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 28,
    gap: 12,
  },
  cardHeader: {
    gap: 2,
  },
  familyName: {
    fontSize: 28,
  },
  familyNote: {
    fontSize: 14,
    lineHeight: 20,
  },
  hairline: {
    height: 1,
    width: '100%',
    marginVertical: 4,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  listingTitle: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  listingBody: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 1.3,
  },
  statValue: {
    fontSize: 15,
    marginTop: 2,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 12,
  },
  metadata: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  formMock: {
    gap: 6,
    marginTop: 6,
  },
  formLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  formInputPlaceholder: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  ghostButton: {
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  ghostButtonText: {
    fontSize: 14,
  },
  ladderLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: 4,
  },
  ladderSample: {
    fontSize: 15,
    lineHeight: 22,
  },
});
