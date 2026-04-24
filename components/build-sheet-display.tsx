/**
 * BuildSheetDisplay — read-only render of a vehicle's BuildSheet. Each
 * section is a table of label/value rows; rows with empty values are
 * hidden. Entire sections that would be empty are hidden too. A global
 * "Show advanced details" toggle reveals the lower-signal fields for
 * whoever wants the full picture.
 */

import type { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  FINISH_TYPE_LABELS,
  PRIMARY_USE_LABELS,
  type BuildSheet,
  type FinishType,
  type PrimaryUse,
} from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

type Props = {
  buildSheet: BuildSheet | undefined;
  isOwner: boolean;
};

type Row = {
  label: string;
  value: string | undefined;
  advanced?: boolean;
};

function formatDate(ts: Timestamp | undefined): string | undefined {
  if (!ts) return undefined;
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : (ts as unknown as Date);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return undefined;
  }
}

function formatPrimaryUse(v: PrimaryUse | undefined): string | undefined {
  return v ? PRIMARY_USE_LABELS[v] : undefined;
}

function formatFinishType(v: FinishType | undefined): string | undefined {
  return v ? FINISH_TYPE_LABELS[v] : undefined;
}

export function BuildSheetDisplay({ buildSheet, isOwner }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [showAdvanced, setShowAdvanced] = useState(false);

  const sheet = buildSheet ?? {};

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'Overview',
      rows: [
        { label: 'Primary Use', value: formatPrimaryUse(sheet.overview?.primaryUse) },
        {
          label: 'Chassis Code',
          value: sheet.overview?.chassisCode,
          advanced: true,
        },
        {
          label: 'Build Start',
          value: formatDate(sheet.overview?.buildStartDate),
          advanced: true,
        },
        {
          label: 'Build Completion',
          value: formatDate(sheet.overview?.buildCompletionDate),
          advanced: true,
        },
      ],
    },
    {
      title: 'Engine & Performance',
      rows: [
        { label: 'Engine Type / Code', value: sheet.engine?.typeCode },
        { label: 'Displacement', value: sheet.engine?.displacement },
        { label: 'Turbo / Supercharger', value: sheet.engine?.turboSupercharger },
        { label: 'Boost Level', value: sheet.engine?.boostLevel, advanced: true },
        { label: 'Horsepower', value: sheet.engine?.horsepower },
        { label: 'Torque', value: sheet.engine?.torque },
        { label: 'Block / Internals', value: sheet.engine?.block, advanced: true },
        { label: 'Pistons', value: sheet.engine?.pistons, advanced: true },
        { label: 'Rods', value: sheet.engine?.rods, advanced: true },
        { label: 'Crankshaft', value: sheet.engine?.crankshaft, advanced: true },
        { label: 'Cylinder Head', value: sheet.engine?.cylinderHead, advanced: true },
        { label: 'Camshaft(s)', value: sheet.engine?.camshafts, advanced: true },
        { label: 'Induction System', value: sheet.engine?.induction, advanced: true },
        { label: 'Intake', value: sheet.engine?.intake, advanced: true },
        { label: 'Throttle Body', value: sheet.engine?.throttleBody, advanced: true },
        { label: 'Injectors', value: sheet.engine?.injectors, advanced: true },
        { label: 'Fuel Pump', value: sheet.engine?.fuelPump, advanced: true },
        { label: 'Cooling System', value: sheet.engine?.cooling, advanced: true },
        { label: 'Headers', value: sheet.engine?.headers, advanced: true },
        { label: 'Mid-pipe', value: sheet.engine?.midPipe, advanced: true },
        { label: 'Muffler', value: sheet.engine?.muffler, advanced: true },
        { label: 'ECU', value: sheet.engine?.ecu, advanced: true },
        { label: 'Tuning', value: sheet.engine?.tuning, advanced: true },
      ],
    },
    {
      title: 'Drivetrain',
      rows: [
        { label: 'Transmission', value: sheet.drivetrain?.transmission },
        { label: 'Differential(s)', value: sheet.drivetrain?.differentials },
        { label: 'Gear Ratios', value: sheet.drivetrain?.gearRatios, advanced: true },
        {
          label: 'Final Drive Ratio',
          value: sheet.drivetrain?.finalDriveRatio,
          advanced: true,
        },
        {
          label: 'Clutch / Torque Converter',
          value: sheet.drivetrain?.clutchConverter,
          advanced: true,
        },
        { label: 'Flywheel', value: sheet.drivetrain?.flywheel, advanced: true },
        {
          label: 'Axles / Driveshaft',
          value: sheet.drivetrain?.axlesDriveshaft,
          advanced: true,
        },
      ],
    },
    {
      title: 'Suspension & Handling',
      rows: [
        { label: 'Front Suspension', value: sheet.suspension?.front },
        { label: 'Rear Suspension', value: sheet.suspension?.rear },
        { label: 'Coilovers / Springs', value: sheet.suspension?.coiloverSprings },
        { label: 'Sway Bars', value: sheet.suspension?.swayBars },
        { label: 'Roll Cage', value: sheet.suspension?.rollCage },
        { label: 'Dampers', value: sheet.suspension?.dampers, advanced: true },
        { label: 'Bushings', value: sheet.suspension?.bushings, advanced: true },
        {
          label: 'Alignment Specs',
          value: sheet.suspension?.alignmentSpecs,
          advanced: true,
        },
        {
          label: 'Chassis Reinforcement',
          value: sheet.suspension?.chassisReinforcement,
          advanced: true,
        },
        { label: 'Bracing', value: sheet.suspension?.bracing, advanced: true },
        { label: 'Seam Welding', value: sheet.suspension?.seamWelding, advanced: true },
      ],
    },
    {
      title: 'Braking System',
      rows: [
        { label: 'Front Brakes', value: sheet.brakes?.frontBrakes },
        { label: 'Front Calipers', value: sheet.brakes?.frontCalipers },
        { label: 'Front Rotors', value: sheet.brakes?.frontRotors },
        { label: 'Rear Brakes', value: sheet.brakes?.rearBrakes },
        { label: 'Brake Lines', value: sheet.brakes?.brakeLines, advanced: true },
        {
          label: 'Master Cylinder',
          value: sheet.brakes?.masterCylinder,
          advanced: true,
        },
        {
          label: 'Brake Bias System',
          value: sheet.brakes?.brakeBiasSystem,
          advanced: true,
        },
        { label: 'Pads / Fluid', value: sheet.brakes?.padsFluid, advanced: true },
      ],
    },
    {
      title: 'Wheels & Tires',
      rows: [
        { label: 'Wheel Brand / Model', value: sheet.wheelsTires?.wheelBrandModel },
        { label: 'Wheel Size (Front)', value: sheet.wheelsTires?.wheelSizeFront },
        { label: 'Wheel Size (Rear)', value: sheet.wheelsTires?.wheelSizeRear },
        { label: 'Offset', value: sheet.wheelsTires?.offset, advanced: true },
        { label: 'Finish', value: sheet.wheelsTires?.finish, advanced: true },
        { label: 'Tire Brand / Model', value: sheet.wheelsTires?.tireBrandModel },
        { label: 'Tire Size (Front)', value: sheet.wheelsTires?.tireSizeFront },
        { label: 'Tire Size (Rear)', value: sheet.wheelsTires?.tireSizeRear },
      ],
    },
    {
      title: 'Exterior',
      rows: [
        { label: 'Paint Color / Code', value: sheet.exterior?.paintColorCode },
        { label: 'Finish Type', value: formatFinishType(sheet.exterior?.finishType) },
        { label: 'Body Kit / Modifications', value: sheet.exterior?.bodyKit },
        { label: 'Badging', value: sheet.exterior?.badging },
        {
          label: 'Front Splitter',
          value: sheet.exterior?.frontSplitter,
          advanced: true,
        },
        { label: 'Side Skirts', value: sheet.exterior?.sideSkirts, advanced: true },
        { label: 'Rear Diffuser', value: sheet.exterior?.rearDiffuser, advanced: true },
        { label: 'Wing / Spoiler', value: sheet.exterior?.wingSpoiler, advanced: true },
      ],
    },
    {
      title: 'Interior',
      rows: [
        { label: 'Seats', value: sheet.interior?.seats },
        { label: 'Upholstery Material', value: sheet.interior?.upholsteryMaterial },
        { label: 'Steering Wheel', value: sheet.interior?.steeringWheel },
        { label: 'Dash / Gauges', value: sheet.interior?.dashGauges },
        { label: 'Infotainment', value: sheet.interior?.infotainment },
        { label: 'Sound System', value: sheet.interior?.soundSystem },
        { label: 'Climate Control', value: sheet.interior?.climateControl },
        { label: 'Harnesses', value: sheet.interior?.harnesses, advanced: true },
        {
          label: 'Fire Suppression',
          value: sheet.interior?.fireSuppression,
          advanced: true,
        },
      ],
    },
    {
      title: 'Performance Metrics',
      rows: [
        { label: '0–60 mph', value: sheet.performance?.zeroToSixty },
        { label: '1/4 Mile', value: sheet.performance?.quarterMile },
        { label: 'Top Speed', value: sheet.performance?.topSpeed },
        { label: 'Dyno Results', value: sheet.performance?.dynoResults },
        { label: 'Track Times', value: sheet.performance?.trackTimes, advanced: true },
      ],
    },
    {
      title: 'Electrical & Technology',
      rows: [
        { label: 'Wiring Harness', value: sheet.electrical?.wiringHarness, advanced: true },
        { label: 'Battery Setup', value: sheet.electrical?.batterySetup, advanced: true },
        { label: 'Alternator', value: sheet.electrical?.alternator, advanced: true },
        {
          label: 'Data Logging / Telemetry',
          value: sheet.electrical?.dataLogging,
          advanced: true,
        },
        {
          label: 'Custom Electronics',
          value: sheet.electrical?.customElectronics,
          advanced: true,
        },
      ],
    },
    {
      title: 'Weight & Balance',
      rows: [
        { label: 'Curb Weight', value: sheet.weight?.curbWeight },
        {
          label: 'Weight Distribution (F)',
          value: sheet.weight?.weightDistributionFront,
          advanced: true,
        },
        {
          label: 'Weight Distribution (R)',
          value: sheet.weight?.weightDistributionRear,
          advanced: true,
        },
        {
          label: 'Weight Reduction',
          value: sheet.weight?.reductionMeasures,
          advanced: true,
        },
      ],
    },
  ];

  // Determine which sections have any rendered rows, given the advanced toggle.
  const renderableSections = sections
    .map((sec) => ({
      ...sec,
      rendered: sec.rows.filter(
        (r) => !!r.value && (showAdvanced || !r.advanced),
      ),
    }))
    .filter((sec) => sec.rendered.length > 0);

  const hasAnyData = sections.some((sec) => sec.rows.some((r) => !!r.value));

  return (
    <View style={styles.root}>
      <View style={styles.toggleRow}>
        <ThemedText type="metadata" style={{ color: palette.textMuted, flex: 1 }}>
          Full build sheet.
          {hasAnyData ? '' : (isOwner ? ' Fill this in from the Edit page to surface it here.' : ' No details yet.')}
        </ThemedText>
        {hasAnyData ? (
          <Pressable
            onPress={() => setShowAdvanced((s) => !s)}
            style={[
              styles.toggle,
              {
                borderColor: showAdvanced ? palette.tint : palette.border,
                backgroundColor: showAdvanced ? palette.tint : 'transparent',
              },
            ]}>
            <ThemedText
              type="metadata"
              style={{
                color: showAdvanced ? '#fff' : palette.text,
                fontWeight: '600',
              }}>
              {showAdvanced ? 'Hide advanced details' : 'Show advanced details'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {renderableSections.map((sec) => (
        <View key={sec.title} style={styles.subSection}>
          <View style={styles.subHeader}>
            <ThemedText type="eyebrow" style={{ color: palette.tint }}>
              {sec.title}
            </ThemedText>
            <View style={[styles.subRule, { backgroundColor: palette.border }]} />
          </View>
          <View style={[styles.table, { borderColor: palette.border }]}>
            {sec.rendered.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.row,
                  i === sec.rendered.length - 1
                    ? null
                    : { borderBottomColor: palette.border, borderBottomWidth: 1 },
                ]}>
                <ThemedText
                  type="eyebrow"
                  style={{ color: palette.textMuted, flex: 1, maxWidth: 200 }}>
                  {row.label}
                </ThemedText>
                <ThemedText type="default" style={{ flex: 2, textAlign: 'right' }}>
                  {row.value}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  toggle: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  subSection: {
    gap: 8,
  },
  subHeader: {
    gap: 6,
  },
  subRule: {
    height: 1,
    width: 60,
  },
  table: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
});
