/**
 * VehicleForm — the Vehicle Builder UI, reusable for both Create (on
 * `/vehicles/new`) and Edit (on `/vehicles/edit/[id]`).
 *
 * Three sections:
 *   1. Vehicle Overview   — who / what / where (year / make / model, colors,
 *                            mileage, location, VIN).
 *   2. Vehicle Details    — build-sheet content: builder, modifications,
 *                            ownership chain. Rough-out for now — more
 *                            fields can land as the user's template evolves.
 *   3. OEM Specifications — NHTSA vPIC / Wikidata / CarQuery cascade plus
 *                            manual entry for vehicles too old or obscure
 *                            to appear in any of the above.
 *
 * The parent owns persistence; this component owns form state and emits a
 * typed VehicleFormValue via onSubmit.
 */

import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { BuildSheetForm } from '@/components/build-sheet-form';
import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchOemSpecs } from '@/services/oem-lookup';
import {
  VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS,
  type BuilderInfo,
  type BuildSheet,
  type ModCategory,
  type Modification,
  type OemSpecs,
  type OwnershipEntry,
  type Vehicle,
  type Visibility,
} from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

export type VehicleFormValue = {
  year: number;
  make: string;
  model: string;
  trim?: string;
  nickname?: string;
  vin?: string;
  story?: string;
  mileage?: number;
  exteriorColor?: string;
  interiorColor?: string;
  location?: Vehicle['location'];

  builder?: BuilderInfo;
  modifications?: Modification[];
  ownershipHistory?: OwnershipEntry[];
  buildSheet?: BuildSheet;
  visibility?: Visibility;

  oemSpecs?: OemSpecs;
};

type Props = {
  title: string;
  initialValue?: Partial<VehicleFormValue>;
  submitLabel: string;
  signedIn: boolean;
  onSubmit: (value: VehicleFormValue) => Promise<void>;
  onCancel?: () => void;
};

const MOD_CATEGORIES: { value: ModCategory; label: string }[] = [
  { value: 'engine', label: 'Engine' },
  { value: 'drivetrain', label: 'Drivetrain' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'brakes', label: 'Brakes' },
  { value: 'wheels-tires', label: 'Wheels & Tires' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'interior', label: 'Interior' },
  { value: 'audio-electronics', label: 'Audio / Electronics' },
  { value: 'other', label: 'Other' },
];

// ---------- Parsing helpers ----------

function parseIntOrUndefined(s: string) {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseFloatOrUndefined(s: string) {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse a YYYY-MM-DD string into a Firestore Timestamp. Empty → undefined. */
function parseDateToTimestamp(s: string): Timestamp | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return undefined;
  return Timestamp.fromDate(d);
}

function formatTimestampAsDate(ts: Timestamp | undefined): string {
  if (!ts) return '';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : (ts as unknown as Date);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function generateRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------- Main form ----------

export function VehicleForm({
  title,
  initialValue,
  submitLabel,
  signedIn,
  onSubmit,
  onCancel,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  // --- Vehicle Overview ---
  const [vin, setVin] = useState(initialValue?.vin ?? '');
  const [year, setYear] = useState(
    initialValue?.year ? String(initialValue.year) : '',
  );
  const [make, setMake] = useState(initialValue?.make ?? '');
  const [model, setModel] = useState(initialValue?.model ?? '');
  const [trim, setTrim] = useState(initialValue?.trim ?? '');
  const [nickname, setNickname] = useState(initialValue?.nickname ?? '');
  const [story, setStory] = useState(initialValue?.story ?? '');
  const [mileage, setMileage] = useState(
    initialValue?.mileage != null ? String(initialValue.mileage) : '',
  );
  const [exteriorColor, setExteriorColor] = useState(
    initialValue?.exteriorColor ?? '',
  );
  const [interiorColor, setInteriorColor] = useState(
    initialValue?.interiorColor ?? '',
  );
  const [city, setCity] = useState(initialValue?.location?.city ?? '');
  const [stateRegion, setStateRegion] = useState(
    initialValue?.location?.stateRegion ?? '',
  );
  const [country, setCountry] = useState(initialValue?.location?.country ?? '');

  // --- Vehicle Details (build sheet) ---
  const [builderName, setBuilderName] = useState(
    initialValue?.builder?.name ?? '',
  );
  const [builderLocation, setBuilderLocation] = useState(
    initialValue?.builder?.location ?? '',
  );
  const [builderDate, setBuilderDate] = useState(
    formatTimestampAsDate(initialValue?.builder?.date),
  );
  const [builderNotes, setBuilderNotes] = useState(
    initialValue?.builder?.notes ?? '',
  );

  const [mods, setMods] = useState<Modification[]>(
    initialValue?.modifications ?? [],
  );
  const [owners, setOwners] = useState<OwnershipEntry[]>(
    initialValue?.ownershipHistory ?? [],
  );
  const [buildSheet, setBuildSheet] = useState<BuildSheet>(
    initialValue?.buildSheet ?? {},
  );
  const [visibility, setVisibility] = useState<Visibility>(
    initialValue?.visibility ?? 'private',
  );

  // --- OEM Specifications ---
  const [oemSpecs, setOemSpecs] = useState<OemSpecs | null>(
    initialValue?.oemSpecs ?? null,
  );
  const [oemBodyClass, setOemBodyClass] = useState(
    initialValue?.oemSpecs?.bodyClass ?? '',
  );
  const [oemCylinders, setOemCylinders] = useState(
    initialValue?.oemSpecs?.engineCylinders?.toString() ?? '',
  );
  const [oemDisplacementCc, setOemDisplacementCc] = useState(
    initialValue?.oemSpecs?.displacementCc?.toString() ?? '',
  );
  const [oemFuelType, setOemFuelType] = useState(
    initialValue?.oemSpecs?.fuelType ?? '',
  );
  const [oemDriveType, setOemDriveType] = useState(
    initialValue?.oemSpecs?.driveType ?? '',
  );
  const [oemTransmissionStyle, setOemTransmissionStyle] = useState(
    initialValue?.oemSpecs?.transmissionStyle ?? '',
  );
  const [oemTransmissionSpeeds, setOemTransmissionSpeeds] = useState(
    initialValue?.oemSpecs?.transmissionSpeeds?.toString() ?? '',
  );
  const [oemManufacturer, setOemManufacturer] = useState(
    initialValue?.oemSpecs?.manufacturer ?? '',
  );

  const [decoding, setDecoding] = useState(false);
  const [decodeNote, setDecodeNote] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function applySpecsToManualFields(s: OemSpecs) {
    if (s.bodyClass) setOemBodyClass(s.bodyClass);
    if (s.engineCylinders != null) setOemCylinders(String(s.engineCylinders));
    if (s.displacementCc != null) setOemDisplacementCc(String(s.displacementCc));
    if (s.fuelType) setOemFuelType(s.fuelType);
    if (s.driveType) setOemDriveType(s.driveType);
    if (s.transmissionStyle) setOemTransmissionStyle(s.transmissionStyle);
    if (s.transmissionSpeeds != null)
      setOemTransmissionSpeeds(String(s.transmissionSpeeds));
    if (s.manufacturer) setOemManufacturer(s.manufacturer);
  }

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
        applySpecsToManualFields(result.specs);
        setDecodeNote({
          kind: 'ok',
          text: `Specifications loaded from ${sourceName(result.specs.source)}. Edit below if needed.`,
        });
      } else {
        const looksPre1981 = vinTrimmed && vinTrimmed.length !== 17;
        const preface = looksPre1981
          ? "NHTSA only covers standardized 17-character VINs from 1981 onward. We tried other sources:"
          : 'No sources had spec data for this vehicle:';
        const body =
          result.errors.length > 0
            ? result.errors.map((e) => `\u2022 ${e}`).join('\n')
            : 'No lookups were attempted.';
        setDecodeNote({
          kind: 'error',
          text: `${preface}\n${body}\n\nEnter the specs manually below.`,
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

  async function handleSubmit() {
    setSubmitError(null);

    const yr = parseIntOrUndefined(year);
    if (!yr || !make.trim() || !model.trim()) {
      setSubmitError('Year, make, and model are required.');
      return;
    }

    setSubmitting(true);
    try {
      const location =
        city.trim() || stateRegion.trim() || country.trim()
          ? {
              city: city.trim() || undefined,
              stateRegion: stateRegion.trim() || undefined,
              country: country.trim() || undefined,
            }
          : undefined;

      // Assemble BuilderInfo only if any field is populated.
      const builderDateTs = parseDateToTimestamp(builderDate);
      const builder: BuilderInfo | undefined =
        builderName.trim() ||
        builderLocation.trim() ||
        builderNotes.trim() ||
        builderDateTs
          ? {
              name: builderName.trim() || undefined,
              location: builderLocation.trim() || undefined,
              date: builderDateTs,
              notes: builderNotes.trim() || undefined,
            }
          : undefined;

      // Build OemSpecs from manual fields. Prefer manual values; fall back to
      // whatever the lookup gave us.
      const assembledOem = assembleOemSpecs({
        lookup: oemSpecs,
        bodyClass: oemBodyClass,
        cylinders: oemCylinders,
        displacementCc: oemDisplacementCc,
        fuelType: oemFuelType,
        driveType: oemDriveType,
        transmissionStyle: oemTransmissionStyle,
        transmissionSpeeds: oemTransmissionSpeeds,
        manufacturer: oemManufacturer,
      });

      // Only include buildSheet if at least one sub-section has content
      const buildSheetHasContent = Object.values(buildSheet).some(
        (section) =>
          section && Object.values(section).some((v) => v !== undefined && v !== ''),
      );

      const value: VehicleFormValue = {
        year: yr,
        make: make.trim(),
        model: model.trim(),
        trim: trim.trim() || undefined,
        nickname: nickname.trim() || undefined,
        vin: vin.trim() || undefined,
        story: story.trim() || undefined,
        mileage: parseIntOrUndefined(mileage),
        exteriorColor: exteriorColor.trim() || undefined,
        interiorColor: interiorColor.trim() || undefined,
        location,
        builder,
        modifications: mods.length ? mods : undefined,
        ownershipHistory: owners.length ? owners : undefined,
        buildSheet: buildSheetHasContent ? buildSheet : undefined,
        visibility,
        oemSpecs: assembledOem,
      };

      await onSubmit(value);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'Save failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">{title}</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        {!signedIn ? (
          <View
            style={[
              styles.banner,
              { backgroundColor: palette.surfaceDim, borderColor: palette.border },
            ]}>
            <ThemedText type="eyebrow" style={{ color: palette.tint }}>
              Heads up
            </ThemedText>
            <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 4 }}>
              You aren&apos;t signed in. Saving requires a Wheelbase account.
            </ThemedText>
          </View>
        ) : null}

        {/* ========== Sharing ========== */}
        <Section title="Sharing" palette={palette}>
          <View style={styles.visibilityRow}>
            {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => {
              const active = v === visibility;
              return (
                <Pressable
                  key={v}
                  onPress={() => setVisibility(v)}
                  style={[
                    styles.visibilityChip,
                    active
                      ? { backgroundColor: palette.tint, borderColor: palette.tint }
                      : {
                          backgroundColor: 'transparent',
                          borderColor: palette.border,
                        },
                  ]}>
                  <ThemedText
                    type="metadata"
                    style={{
                      color: active ? '#fff' : palette.text,
                      fontWeight: active ? '700' : '500',
                    }}>
                    {VISIBILITY_LABELS[v]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="metadata" style={{ color: palette.textMuted }}>
            {VISIBILITY_DESCRIPTIONS[visibility]}
          </ThemedText>
        </Section>

        {/* ========== Vehicle Overview ========== */}
        <Section title="Vehicle Overview" palette={palette}>
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
            label="VIN / Chassis Number"
            value={vin}
            onChangeText={setVin}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="17-character VIN (or chassis # for pre-1981 vehicles)"
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
              <FormField label="City" value={city} onChangeText={setCity} placeholder="Austin" />
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

        {/* ========== Vehicle Story ========== */}
        <Section title="Vehicle Story" palette={palette}>
          <ThemedText type="metadata" style={{ color: palette.textMuted }}>
            A short narrative — where the car came from, what it&apos;s been
            through, why it matters. Will eventually be seeded from your
            service records; for now, write or paste as you like.
          </ThemedText>
          <FormField
            label="Story"
            value={story}
            onChangeText={setStory}
            placeholder="Known history, memorable events, ownership chain highlights, anything worth telling."
            multiline
            numberOfLines={10}
          />
        </Section>

        {/* ========== Vehicle Details ========== */}
        <Section title="Vehicle Details" palette={palette}>
          <ThemedText type="metadata" style={{ color: palette.textMuted }}>
            Builder info, modifications, and ownership history. This is a
            rough build sheet — more fields will land as the template develops.
          </ThemedText>

          {/* Builder */}
          <SubSectionHeader title="Builder" palette={palette} />
          <Row>
            <Col>
              <FormField
                label="Builder / Shop"
                value={builderName}
                onChangeText={setBuilderName}
                placeholder="Singer Vehicle Design"
              />
            </Col>
            <Col>
              <FormField
                label="Location"
                value={builderLocation}
                onChangeText={setBuilderLocation}
                placeholder="Los Angeles, CA"
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <DateField
                label="Build Date"
                value={builderDate}
                onChangeText={setBuilderDate}
              />
            </Col>
          </Row>
          <FormField
            label="Builder Notes"
            value={builderNotes}
            onChangeText={setBuilderNotes}
            placeholder="Build scope, specialization, one-off details"
          />

          {/* Modifications */}
          <SubSectionHeader title="Modifications" palette={palette} />
          <ModificationsRepeater value={mods} onChange={setMods} palette={palette} />

          {/* Ownership */}
          <SubSectionHeader title="Ownership History" palette={palette} />
          <OwnershipRepeater value={owners} onChange={setOwners} palette={palette} />
        </Section>

        {/* ========== Build Sheet ========== */}
        <Section title="Build Sheet" palette={palette}>
          <BuildSheetForm value={buildSheet} onChange={setBuildSheet} />
        </Section>

        {/* ========== OEM Specifications ========== */}
        <Section title="OEM Specifications" palette={palette}>
          <ThemedText type="metadata" style={{ color: palette.textMuted }}>
            We try NHTSA vPIC first (17-char VINs, 1981+), then Wikidata, then
            CarQuery. If your vehicle is too old or too obscure to be in any of
            them, fill the fields in manually — they all save with the same
            vehicle record.
          </ThemedText>
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

          <Row>
            <Col>
              <FormField
                label="Body Class"
                value={oemBodyClass}
                onChangeText={setOemBodyClass}
                placeholder="Coupe"
              />
            </Col>
            <Col>
              <FormField
                label="Manufacturer"
                value={oemManufacturer}
                onChangeText={setOemManufacturer}
                placeholder="Porsche AG"
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <FormField
                label="Cylinders"
                value={oemCylinders}
                onChangeText={setOemCylinders}
                keyboardType="numeric"
                placeholder="6"
              />
            </Col>
            <Col>
              <FormField
                label="Displacement (cc)"
                value={oemDisplacementCc}
                onChangeText={setOemDisplacementCc}
                keyboardType="numeric"
                placeholder="1991"
              />
            </Col>
            <Col>
              <FormField
                label="Fuel Type"
                value={oemFuelType}
                onChangeText={setOemFuelType}
                placeholder="Gasoline"
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <FormField
                label="Drivetrain"
                value={oemDriveType}
                onChangeText={setOemDriveType}
                placeholder="RWD"
              />
            </Col>
            <Col>
              <FormField
                label="Transmission"
                value={oemTransmissionStyle}
                onChangeText={setOemTransmissionStyle}
                placeholder="Manual"
              />
            </Col>
            <Col>
              <FormField
                label="Speeds"
                value={oemTransmissionSpeeds}
                onChangeText={setOemTransmissionSpeeds}
                keyboardType="numeric"
                placeholder="5"
              />
            </Col>
          </Row>
        </Section>

        {submitError ? (
          <ThemedText type="metadata" style={{ color: palette.tint, textAlign: 'center' }}>
            {submitError}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          {onCancel ? (
            <Pressable
              onPress={onCancel}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText style={[styles.ghostButtonText, { color: palette.textMuted }]}>
                Cancel
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[
              styles.primaryButton,
              { backgroundColor: palette.tint, opacity: submitting ? 0.6 : 1 },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>{submitLabel}</ThemedText>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// ---------- Repeater: Modifications ----------

function ModificationsRepeater({
  value,
  onChange,
  palette,
}: {
  value: Modification[];
  onChange: (next: Modification[]) => void;
  palette: Palette;
}) {
  function update(index: number, patch: Partial<Modification>) {
    const next = [...value];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function add() {
    const newMod: Modification = {
      id: generateRowId(),
      category: 'other',
      title: '',
    };
    onChange([...value, newMod]);
  }

  if (value.length === 0) {
    return (
      <View style={styles.emptyRepeater}>
        <ThemedText type="metadata" style={{ color: palette.placeholder }}>
          No modifications added yet.
        </ThemedText>
        <AddRowButton label="+ Add modification" onPress={add} palette={palette} />
      </View>
    );
  }

  return (
    <View style={styles.repeaterWrap}>
      {value.map((mod, i) => (
        <View
          key={mod.id}
          style={[styles.repeaterRow, { borderColor: palette.border }]}>
          <View style={styles.repeaterRowHeader}>
            <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
              Modification {i + 1}
            </ThemedText>
            <Pressable onPress={() => remove(i)} hitSlop={10}>
              <ThemedText type="metadata" style={{ color: palette.tint, fontWeight: '600' }}>
                Remove
              </ThemedText>
            </Pressable>
          </View>

          <Row>
            <Col>
              <CategorySelector
                value={mod.category}
                onChange={(c) => update(i, { category: c })}
                palette={palette}
              />
            </Col>
            <Col>
              <FormField
                label="Title"
                value={mod.title}
                onChangeText={(t) => update(i, { title: t })}
                placeholder="e.g. Ohlins TTX40 coilovers"
              />
            </Col>
          </Row>
          <FormField
            label="Description"
            value={mod.description ?? ''}
            onChangeText={(t) => update(i, { description: t || undefined })}
            placeholder="Details, part numbers, what changed"
          />
          <Row>
            <Col>
              <DateField
                label="Installed Date"
                value={formatTimestampAsDate(mod.installedAt)}
                onChangeText={(t) =>
                  update(i, { installedAt: parseDateToTimestamp(t) })
                }
              />
            </Col>
            <Col>
              <FormField
                label="Installed At (Miles)"
                value={mod.mileageAtInstall != null ? String(mod.mileageAtInstall) : ''}
                onChangeText={(t) =>
                  update(i, { mileageAtInstall: parseIntOrUndefined(t) })
                }
                keyboardType="numeric"
                placeholder="42,000"
              />
            </Col>
            <Col>
              <FormField
                label="Cost"
                value={mod.cost != null ? String(mod.cost) : ''}
                onChangeText={(t) => update(i, { cost: parseFloatOrUndefined(t) })}
                keyboardType="numeric"
                placeholder="3500"
              />
            </Col>
          </Row>
          <FormField
            label="Vendor / Shop"
            value={mod.vendor ?? ''}
            onChangeText={(t) => update(i, { vendor: t || undefined })}
            placeholder="Who did the work"
          />
        </View>
      ))}
      <AddRowButton label="+ Add modification" onPress={add} palette={palette} />
    </View>
  );
}

function CategorySelector({
  value,
  onChange,
  palette,
}: {
  value: ModCategory;
  onChange: (next: ModCategory) => void;
  palette: Palette;
}) {
  return (
    <View style={styles.catWrap}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted, marginBottom: 6 }}>
        Category
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}>
        {MOD_CATEGORIES.map((c) => {
          const active = c.value === value;
          return (
            <Pressable
              key={c.value}
              onPress={() => onChange(c.value)}
              style={[
                styles.catChip,
                active
                  ? { backgroundColor: palette.tint, borderColor: palette.tint }
                  : { backgroundColor: 'transparent', borderColor: palette.border },
              ]}>
              <ThemedText
                type="metadata"
                style={{
                  color: active ? '#fff' : palette.text,
                  fontWeight: active ? '700' : '500',
                }}>
                {c.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------- Repeater: Ownership ----------

function OwnershipRepeater({
  value,
  onChange,
  palette,
}: {
  value: OwnershipEntry[];
  onChange: (next: OwnershipEntry[]) => void;
  palette: Palette;
}) {
  function update(index: number, patch: Partial<OwnershipEntry>) {
    const next = [...value];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }
  /**
   * Mark one row as the current owner. Single-select — any other row with
   * isCurrent flagged gets cleared so the detail page has an unambiguous
   * answer to "who owns this today?"
   */
  function markCurrent(index: number) {
    const next = value.map((entry, i) => ({
      ...entry,
      isCurrent: i === index ? true : undefined,
    }));
    onChange(next);
  }
  function clearCurrent(index: number) {
    update(index, { isCurrent: undefined });
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function add() {
    const entry: OwnershipEntry = {
      id: generateRowId(),
    };
    onChange([...value, entry]);
  }

  const currentOwner = value.find((e) => e.isCurrent);
  const previousOwners = value.filter((e) => !e.isCurrent);
  // "Most recent" previous owner = whichever non-current row has the latest
  // relinquished date; fall back to latest acquired; finally fall back to
  // the last entry in the list (usually the most recently added).
  const mostRecentPrevious = pickMostRecentPrevious(previousOwners);

  if (value.length === 0) {
    return (
      <View style={styles.emptyRepeater}>
        <ThemedText type="metadata" style={{ color: palette.placeholder }}>
          No previous owners listed yet.
        </ThemedText>
        <AddRowButton label="+ Add owner" onPress={add} palette={palette} />
      </View>
    );
  }

  return (
    <View style={styles.repeaterWrap}>
      {value.map((entry, i) => (
        <View
          key={entry.id}
          style={[
            styles.repeaterRow,
            {
              borderColor: entry.isCurrent ? palette.tint : palette.border,
              borderWidth: entry.isCurrent ? 2 : 1,
            },
          ]}>
          <View style={styles.repeaterRowHeader}>
            <View style={styles.ownerHeaderLeft}>
              <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
                Owner {i + 1}
              </ThemedText>
              {entry.isCurrent ? (
                <View style={[styles.currentBadge, { backgroundColor: palette.tint }]}>
                  <ThemedText
                    type="metadata"
                    style={{ color: '#fff', fontWeight: '700', letterSpacing: 1 }}>
                    CURRENT
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <Pressable onPress={() => remove(i)} hitSlop={10}>
              <ThemedText type="metadata" style={{ color: palette.tint, fontWeight: '600' }}>
                Remove
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={() => (entry.isCurrent ? clearCurrent(i) : markCurrent(i))}
            style={[
              styles.currentToggle,
              {
                borderColor: entry.isCurrent ? palette.tint : palette.border,
                backgroundColor: entry.isCurrent
                  ? palette.tint
                  : palette.surfaceDim,
              },
            ]}>
            <View
              style={[
                styles.currentCheckbox,
                {
                  borderColor: entry.isCurrent ? '#fff' : palette.border,
                  backgroundColor: entry.isCurrent ? '#fff' : 'transparent',
                },
              ]}>
              {entry.isCurrent ? (
                <ThemedText
                  style={{ color: palette.tint, fontSize: 12, fontWeight: '700', lineHeight: 14 }}>
                  ✓
                </ThemedText>
              ) : null}
            </View>
            <ThemedText
              type="metadata"
              style={{
                color: entry.isCurrent ? '#fff' : palette.text,
                fontWeight: '600',
              }}>
              Current owner
            </ThemedText>
          </Pressable>

          <FormField
            label="Owner Name"
            value={entry.ownerName ?? ''}
            onChangeText={(t) => update(i, { ownerName: t || undefined })}
            placeholder="First previous owner, collector name, or dealership"
          />
          <Row>
            <Col>
              <DateField
                label="Acquired"
                value={formatTimestampAsDate(entry.acquiredAt)}
                onChangeText={(t) =>
                  update(i, { acquiredAt: parseDateToTimestamp(t) })
                }
              />
            </Col>
            <Col>
              <DateField
                label="Relinquished"
                value={formatTimestampAsDate(entry.relinquishedAt)}
                onChangeText={(t) =>
                  update(i, { relinquishedAt: parseDateToTimestamp(t) })
                }
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <FormField
                label="City"
                value={entry.location?.city ?? ''}
                onChangeText={(t) =>
                  update(i, {
                    location: { ...entry.location, city: t || undefined },
                  })
                }
              />
            </Col>
            <Col>
              <FormField
                label="State / Region"
                value={entry.location?.stateRegion ?? ''}
                onChangeText={(t) =>
                  update(i, {
                    location: { ...entry.location, stateRegion: t || undefined },
                  })
                }
              />
            </Col>
            <Col>
              <FormField
                label="Country"
                value={entry.location?.country ?? ''}
                onChangeText={(t) =>
                  update(i, {
                    location: { ...entry.location, country: t || undefined },
                  })
                }
              />
            </Col>
          </Row>
          <FormField
            label="Notes"
            value={entry.notes ?? ''}
            onChangeText={(t) => update(i, { notes: t || undefined })}
            placeholder="Anything notable about this owner's stewardship"
          />
        </View>
      ))}
      <AddRowButton label="+ Add owner" onPress={add} palette={palette} />

      {/* Live summary — mirrors what will render on the public detail page so
          the owner can sanity-check their selection without saving first. */}
      <View
        style={[
          styles.ownershipSummary,
          { borderColor: palette.border, backgroundColor: palette.surfaceDim },
        ]}>
        <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
          Summary
        </ThemedText>
        <View style={styles.ownershipSummaryRow}>
          <ThemedText type="metadata" style={{ color: palette.textMuted, width: 90 }}>
            Current
          </ThemedText>
          <ThemedText
            type="metadata"
            style={{
              color: currentOwner ? palette.text : palette.placeholder,
              flex: 1,
              fontWeight: currentOwner ? '600' : '400',
            }}>
            {currentOwner
              ? currentOwner.ownerName || '(unnamed)'
              : 'No current owner selected'}
          </ThemedText>
        </View>
        <View style={styles.ownershipSummaryRow}>
          <ThemedText type="metadata" style={{ color: palette.textMuted, width: 90 }}>
            Previous
          </ThemedText>
          <ThemedText
            type="metadata"
            style={{
              color: mostRecentPrevious ? palette.text : palette.placeholder,
              flex: 1,
            }}>
            {mostRecentPrevious
              ? mostRecentPrevious.ownerName || '(unnamed)'
              : '—'}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

/**
 * Pick the most recent previous owner from a list of ownership entries.
 * Priority: latest relinquishedAt, then latest acquiredAt, then list order
 * (last added wins). Returns undefined if the list is empty.
 */
function pickMostRecentPrevious(
  previous: OwnershipEntry[],
): OwnershipEntry | undefined {
  if (previous.length === 0) return undefined;
  const tsMillis = (ts: OwnershipEntry['acquiredAt']) => {
    if (!ts) return 0;
    try {
      const d = typeof ts.toDate === 'function' ? ts.toDate() : (ts as unknown as Date);
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    } catch {
      return 0;
    }
  };
  let best = previous[0];
  let bestScore = -Infinity;
  previous.forEach((entry, i) => {
    const rel = tsMillis(entry.relinquishedAt);
    const acq = tsMillis(entry.acquiredAt);
    // Blend the two — relinquished wins if present, else acquired, else
    // rely on the positional tiebreak so freshly-added rows still surface.
    const score = rel || acq || i;
    if (score >= bestScore) {
      bestScore = score;
      best = entry;
    }
  });
  return best;
}

// ---------- Misc small components ----------

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

function SubSectionHeader({ title, palette }: { title: string; palette: Palette }) {
  return (
    <View style={styles.subSectionHeader}>
      <ThemedText type="eyebrow" style={{ color: palette.tint }}>
        {title}
      </ThemedText>
      <View style={[styles.subRule, { backgroundColor: palette.border }]} />
    </View>
  );
}

function AddRowButton({
  label,
  onPress,
  palette,
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.addRowButton,
        { borderColor: palette.border, backgroundColor: palette.surfaceDim },
      ]}>
      <ThemedText
        type="metadata"
        style={{ color: palette.tint, fontWeight: '600' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Col({ children }: { children: React.ReactNode }) {
  return <View style={styles.col}>{children}</View>;
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

/**
 * Build the final OemSpecs record from the manual form fields, falling back
 * to the last successful API lookup for anything the user left blank.
 */
function assembleOemSpecs(input: {
  lookup: OemSpecs | null;
  bodyClass: string;
  cylinders: string;
  displacementCc: string;
  fuelType: string;
  driveType: string;
  transmissionStyle: string;
  transmissionSpeeds: string;
  manufacturer: string;
}): OemSpecs | undefined {
  const {
    lookup,
    bodyClass,
    cylinders,
    displacementCc,
    fuelType,
    driveType,
    transmissionStyle,
    transmissionSpeeds,
    manufacturer,
  } = input;

  const fields = {
    bodyClass: bodyClass.trim() || lookup?.bodyClass,
    engineCylinders: parseIntOrUndefined(cylinders) ?? lookup?.engineCylinders,
    displacementCc: parseFloatOrUndefined(displacementCc) ?? lookup?.displacementCc,
    fuelType: fuelType.trim() || lookup?.fuelType,
    driveType: driveType.trim() || lookup?.driveType,
    transmissionStyle: transmissionStyle.trim() || lookup?.transmissionStyle,
    transmissionSpeeds:
      parseIntOrUndefined(transmissionSpeeds) ?? lookup?.transmissionSpeeds,
    manufacturer: manufacturer.trim() || lookup?.manufacturer,
  };

  const anyPresent = Object.values(fields).some((v) => v !== undefined && v !== '');
  if (!anyPresent) return undefined;

  // If the user has overridden ANY field that came from the lookup, flag the
  // record as manual so we don't mislabel it as vPIC / etc.
  const anyOverride =
    !!bodyClass.trim() ||
    !!cylinders.trim() ||
    !!displacementCc.trim() ||
    !!fuelType.trim() ||
    !!driveType.trim() ||
    !!transmissionStyle.trim() ||
    !!transmissionSpeeds.trim() ||
    !!manufacturer.trim();

  const source: OemSpecs['source'] = lookup && !anyOverride ? lookup.source : 'manual';

  return {
    ...lookup,
    ...fields,
    source,
  };
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
  subSectionHeader: {
    gap: 6,
    marginTop: 6,
  },
  subRule: {
    height: 1,
    width: 60,
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
  emptyRepeater: {
    gap: 10,
    alignItems: 'flex-start',
  },
  repeaterWrap: {
    gap: 12,
  },
  repeaterRow: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 14,
    gap: 12,
  },
  repeaterRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ownerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  currentBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  currentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  currentCheckbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownershipSummary: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  ownershipSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addRowButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    borderStyle: 'dashed',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  catWrap: {
    gap: 2,
  },
  catRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 6,
  },
  catChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  visibilityChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
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
