import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createVehicle } from '@/services/vehicles';
import { decodeVin } from '@/services/vpic';
import type { OemSpecs, Vehicle } from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

function parseIntOrUndefined(s: string) {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseFloatOrUndefined(s: string) {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export default function NewVehicleScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user } = useAuth();

  const [vin, setVin] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeNote, setDecodeNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [nickname, setNickname] = useState('');

  const [mileage, setMileage] = useState('');
  const [exteriorColor, setExteriorColor] = useState('');
  const [interiorColor, setInteriorColor] = useState('');

  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [country, setCountry] = useState('');

  const [oemSpecs, setOemSpecs] = useState<OemSpecs | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleDecode() {
    const trimmed = vin.trim();
    if (!trimmed) {
      setDecodeNote({ kind: 'error', text: 'Enter a VIN first.' });
      return;
    }
    setDecoding(true);
    setDecodeNote(null);
    try {
      const result = await decodeVin(trimmed);

      if (result['Model Year']) setYear(result['Model Year']);
      if (result['Make']) setMake(toTitleCase(result['Make']));
      if (result['Model']) setModel(result['Model']);
      if (result['Trim']) setTrim(result['Trim']);

      const specs: OemSpecs = {
        source: 'vpic',
        make: result['Make'],
        model: result['Model'],
        modelYear: parseIntOrUndefined(result['Model Year'] ?? ''),
        trim: result['Trim'],
        series: result['Series'],
        bodyClass: result['Body Class'],
        doors: parseIntOrUndefined(result['Doors'] ?? ''),
        engineCylinders: parseIntOrUndefined(result['Engine Number of Cylinders'] ?? ''),
        displacementCc: parseFloatOrUndefined(result['Displacement (CC)'] ?? ''),
        displacementCi: parseFloatOrUndefined(result['Displacement (CI)'] ?? ''),
        fuelType: result['Fuel Type - Primary'],
        driveType: result['Drive Type'],
        transmissionStyle: result['Transmission Style'],
        transmissionSpeeds: parseIntOrUndefined(result['Transmission Speeds'] ?? ''),
        plantCity: result['Plant City'],
        plantState: result['Plant State'],
        plantCountry: result['Plant Country'],
        manufacturer: result['Manufacturer Name'],
        vehicleType: result['Vehicle Type'],
        raw: result,
      };
      setOemSpecs(specs);

      const decoded = [result['Model Year'], result['Make'], result['Model']].filter(Boolean).join(' ');
      setDecodeNote({
        kind: 'ok',
        text: decoded ? `Decoded: ${decoded}. Review and edit as needed.` : 'No fields returned — edit manually below.',
      });
    } catch (e) {
      setDecodeNote({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Failed to decode VIN.',
      });
    } finally {
      setDecoding(false);
    }
  }

  async function handleSave() {
    setSaveError(null);

    const yr = parseIntOrUndefined(year);
    if (!yr || !make.trim() || !model.trim()) {
      setSaveError('Year, make, and model are required.');
      return;
    }
    if (!user) {
      setSaveError(
        'Sign in required before saving. Enable Email/Password in Firebase Auth, then sign in.',
      );
      return;
    }

    setSaving(true);
    try {
      const location =
        city.trim() || stateRegion.trim() || country.trim()
          ? {
              city: city.trim() || undefined,
              stateRegion: stateRegion.trim() || undefined,
              country: country.trim() || undefined,
            }
          : undefined;

      const input: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'> = {
        ownerId: user.uid,
        year: yr,
        make: make.trim(),
        model: model.trim(),
        trim: trim.trim() || undefined,
        nickname: nickname.trim() || undefined,
        vin: vin.trim() || undefined,
        mileage: parseIntOrUndefined(mileage),
        exteriorColor: exteriorColor.trim() || undefined,
        interiorColor: interiorColor.trim() || undefined,
        location,
        modifications: [],
        oemSpecs: oemSpecs ?? undefined,
        mediaIds: [],
        visibility: 'private',
      };

      await createVehicle(input);
      router.replace('/');
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? `Save failed: ${e.message}`
          : 'Save failed. Make sure Firestore is enabled in the Firebase Console.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">Add a Vehicle</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          <ThemedText type="metadata" style={{ color: palette.textMuted, textAlign: 'center' }}>
            Start with a VIN to auto-fill from NHTSA, or enter details manually.
          </ThemedText>
        </View>

        {!user ? (
          <View
            style={[styles.banner, { backgroundColor: palette.surfaceDim, borderColor: palette.border }]}>
            <ThemedText type="eyebrow" style={{ color: palette.tint }}>Heads up</ThemedText>
            <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 4 }}>
              You aren&apos;t signed in. You can build the form now, but saving requires Firebase Auth
              and Firestore to be enabled.
            </ThemedText>
          </View>
        ) : null}

        <Section title="VIN Decode" palette={palette}>
          <FormField
            label="VIN"
            value={vin}
            onChangeText={setVin}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="17-character VIN"
          />
          <View style={styles.rowEnd}>
            <Pressable
              onPress={handleDecode}
              disabled={decoding}
              style={[styles.secondaryButton, { borderColor: palette.tint, opacity: decoding ? 0.6 : 1 }]}>
              {decoding ? (
                <ActivityIndicator color={palette.tint} />
              ) : (
                <ThemedText style={[styles.secondaryButtonText, { color: palette.tint }]}>
                  Decode VIN
                </ThemedText>
              )}
            </Pressable>
          </View>
          {decodeNote ? (
            <ThemedText
              type="metadata"
              style={{ color: decodeNote.kind === 'error' ? palette.tint : palette.textMuted }}>
              {decodeNote.text}
            </ThemedText>
          ) : null}
        </Section>

        <Section title="Identity" palette={palette}>
          <Row>
            <Col><FormField label="Year" required value={year} onChangeText={setYear} keyboardType="numeric" placeholder="2024" /></Col>
            <Col><FormField label="Make" required value={make} onChangeText={setMake} placeholder="Porsche" /></Col>
          </Row>
          <Row>
            <Col><FormField label="Model" required value={model} onChangeText={setModel} placeholder="911" /></Col>
            <Col><FormField label="Trim" value={trim} onChangeText={setTrim} placeholder="Carrera S" /></Col>
          </Row>
          <FormField label="Nickname" value={nickname} onChangeText={setNickname} placeholder="e.g. Rosso" />
        </Section>

        <Section title="Condition" palette={palette}>
          <FormField label="Mileage" value={mileage} onChangeText={setMileage} keyboardType="numeric" placeholder="24,500" />
          <Row>
            <Col><FormField label="Exterior Color" value={exteriorColor} onChangeText={setExteriorColor} placeholder="Guards Red" /></Col>
            <Col><FormField label="Interior Color" value={interiorColor} onChangeText={setInteriorColor} placeholder="Black" /></Col>
          </Row>
        </Section>

        <Section title="Location" palette={palette}>
          <Row>
            <Col><FormField label="City" value={city} onChangeText={setCity} /></Col>
            <Col><FormField label="State / Region" value={stateRegion} onChangeText={setStateRegion} /></Col>
          </Row>
          <FormField label="Country" value={country} onChangeText={setCountry} placeholder="United States" />
        </Section>

        {saveError ? (
          <ThemedText type="metadata" style={{ color: palette.tint, textAlign: 'center' }}>
            {saveError}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.ghostButton, { borderColor: palette.border }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.textMuted }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[
              styles.primaryButton,
              { backgroundColor: palette.tint, opacity: saving ? 0.6 : 1 },
            ]}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Save Vehicle</ThemedText>
            )}
          </Pressable>
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
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
          {title}
        </ThemedText>
        <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Col({ children }: { children: React.ReactNode }) {
  return <View style={styles.col}>{children}</View>;
}

function toTitleCase(s: string) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 64,
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
  banner: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    gap: 8,
  },
  sectionRule: {
    height: 1,
    width: '100%',
  },
  sectionBody: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  col: {
    flex: 1,
  },
  rowEnd: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 2,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 140,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  ghostButton: {
    borderWidth: 1,
    borderRadius: 2,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
