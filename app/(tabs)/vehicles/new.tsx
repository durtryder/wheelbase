import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchOemSpecs } from '@/services/oem-lookup';
import { createVehicle } from '@/services/vehicles';
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

export default function VehicleBuilderScreen() {
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
    const vinTrimmed = vin.trim();
    const yr = parseIntOrUndefined(year);
    const hasIdentity = !!yr && !!make.trim() && !!model.trim();

    if (!vinTrimmed && !hasIdentity) {
      setDecodeNote({
        kind: 'error',
        text: 'Enter a VIN, or fill in year / make / model above, before looking up specs.',
      });
      return;
    }

    setDecoding(true);
    setDecodeNote(null);
    try {
      const result = await fetchOemSpecs({
        vin: vinTrimmed || undefined,
        year: yr,
        make: make.trim() || undefined,
        model: model.trim() || undefined,
      });

      if (result.ok) {
        setOemSpecs(result.specs);
        setDecodeNote({
          kind: 'ok',
          text: `Specifications loaded from ${sourceName(result.source)}.`,
        });
      } else {
        setOemSpecs(null);
        const looksPre1981 = vinTrimmed && vinTrimmed.length !== 17;
        const preface = looksPre1981
          ? "NHTSA only covers standardized 17-character VINs from 1981 onward. We then tried other sources:"
          : 'No sources had spec data for this vehicle:';
        const body =
          result.errors.length > 0
            ? result.errors.map((e) => `\u2022 ${e}`).join('\n')
            : 'No lookups were attempted.';
        setDecodeNote({
          kind: 'error',
          text: `${preface}\n${body}\n\nEnter the specs manually above.`,
        });
      }
    } catch (e) {
      setDecodeNote({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Failed to reach any spec source.',
      });
    } finally {
      setDecoding(false);
    }
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
        return 'manual entry';
      default:
        return 'an external source';
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
          <ThemedText type="title">Vehicle Builder</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        {!user ? (
          <View
            style={[
              styles.banner,
              { backgroundColor: palette.surfaceDim, borderColor: palette.border },
            ]}>
            <ThemedText type="eyebrow" style={{ color: palette.tint }}>
              Heads up
            </ThemedText>
            <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 4 }}>
              You aren&apos;t signed in. You can build the form now, but you&apos;ll need an
              account to save this vehicle.
            </ThemedText>
            <View style={styles.bannerAction}>
              <Pressable
                onPress={() => router.push('/sign-in')}
                style={[styles.secondaryButton, { borderColor: palette.tint }]}>
                <ThemedText style={[styles.secondaryButtonText, { color: palette.tint }]}>
                  Sign in or create account
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Section title="Vehicle Details" palette={palette}>
          <Row>
            <Col>
              <FormField
                label="Year"
                required
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
                placeholder="2024"
              />
            </Col>
            <Col>
              <FormField
                label="Make"
                required
                value={make}
                onChangeText={setMake}
                placeholder="Porsche"
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <FormField
                label="Model"
                required
                value={model}
                onChangeText={setModel}
                placeholder="911"
              />
            </Col>
            <Col>
              <FormField
                label="Trim"
                value={trim}
                onChangeText={setTrim}
                placeholder="Carrera S"
              />
            </Col>
          </Row>
          <FormField
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g. Rosso"
          />
          <FormField
            label="Mileage"
            value={mileage}
            onChangeText={setMileage}
            keyboardType="numeric"
            placeholder="24,500"
          />
          <Row>
            <Col>
              <FormField
                label="Exterior Color"
                value={exteriorColor}
                onChangeText={setExteriorColor}
                placeholder="Guards Red"
              />
            </Col>
            <Col>
              <FormField
                label="Interior Color"
                value={interiorColor}
                onChangeText={setInteriorColor}
                placeholder="Black"
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <FormField
                label="City"
                value={city}
                onChangeText={setCity}
                placeholder="Austin"
              />
            </Col>
            <Col>
              <FormField
                label="State / Region"
                value={stateRegion}
                onChangeText={setStateRegion}
                placeholder="TX"
              />
            </Col>
            <Col>
              <FormField
                label="Country"
                value={country}
                onChangeText={setCountry}
                placeholder="United States"
              />
            </Col>
          </Row>
        </Section>

        <Section title="OEM Specifications" palette={palette}>
          <ThemedText type="metadata" style={{ color: palette.textMuted }}>
            Enter a VIN, or fill in year / make / model above, then look up specs. We try NHTSA
            vPIC first (17-char VINs, 1981+), then Wikidata, then CarQuery.
          </ThemedText>
          <FormField
            label="VIN"
            value={vin}
            onChangeText={setVin}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="17-character VIN (optional for pre-1981 vehicles)"
          />
          <View style={styles.rowEnd}>
            <Pressable
              onPress={handleDecode}
              disabled={decoding}
              style={[
                styles.secondaryButton,
                { borderColor: palette.tint, opacity: decoding ? 0.6 : 1 },
              ]}>
              {decoding ? (
                <ActivityIndicator color={palette.tint} />
              ) : (
                <ThemedText style={[styles.secondaryButtonText, { color: palette.tint }]}>
                  Look up specifications
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

          {oemSpecs ? (
            <View style={[styles.specsTable, { borderColor: palette.border }]}>
              <SpecRow label="Model Year" value={oemSpecs.modelYear?.toString()} palette={palette} />
              <SpecRow label="Make" value={oemSpecs.make} palette={palette} />
              <SpecRow label="Model" value={oemSpecs.model} palette={palette} />
              <SpecRow label="Trim" value={oemSpecs.trim} palette={palette} />
              <SpecRow label="Series" value={oemSpecs.series} palette={palette} />
              <SpecRow label="Body Class" value={oemSpecs.bodyClass} palette={palette} />
              <SpecRow label="Doors" value={oemSpecs.doors?.toString()} palette={palette} />
              <SpecRow
                label="Cylinders"
                value={oemSpecs.engineCylinders?.toString()}
                palette={palette}
              />
              <SpecRow
                label="Displacement"
                value={formatDisplacement(oemSpecs.displacementCc, oemSpecs.displacementCi)}
                palette={palette}
              />
              <SpecRow label="Fuel Type" value={oemSpecs.fuelType} palette={palette} />
              <SpecRow label="Drivetrain" value={oemSpecs.driveType} palette={palette} />
              <SpecRow
                label="Transmission"
                value={formatTransmission(oemSpecs.transmissionStyle, oemSpecs.transmissionSpeeds)}
                palette={palette}
              />
              <SpecRow
                label="Plant"
                value={formatPlant(
                  oemSpecs.plantCity,
                  oemSpecs.plantState,
                  oemSpecs.plantCountry,
                )}
                palette={palette}
              />
              <SpecRow label="Manufacturer" value={oemSpecs.manufacturer} palette={palette} />
              <SpecRow label="Vehicle Type" value={oemSpecs.vehicleType} palette={palette} />
            </View>
          ) : (
            <ThemedText type="metadata" style={{ color: palette.placeholder }}>
              No specifications loaded. Decode a VIN above to populate this section.
            </ThemedText>
          )}
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
              <ThemedText style={styles.primaryButtonText}>Save vehicle</ThemedText>
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
        <ThemedText type="subtitle">{title}</ThemedText>
        <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SpecRow({
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
    <View style={[styles.specRow, { borderBottomColor: palette.border }]}>
      <ThemedText
        type="eyebrow"
        style={{ color: palette.textMuted, flex: 1, maxWidth: 180 }}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={{ flex: 2, textAlign: 'right' }}>
        {value}
      </ThemedText>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Col({ children }: { children: React.ReactNode }) {
  return <View style={styles.col}>{children}</View>;
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 64,
    gap: 32,
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
    borderRadius: 6,
    padding: 14,
  },
  bannerAction: {
    flexDirection: 'row',
    marginTop: 10,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    gap: 10,
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
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    minWidth: 140,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  specsTable: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  specRow: {
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
    justifyContent: 'flex-end',
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
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
