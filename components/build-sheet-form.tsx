/**
 * BuildSheetForm — the editable build sheet. Rendered inside the
 * Vehicle Builder form. Fields are organized into 11 sections; a global
 * "Show advanced fields" toggle expands every section's lower-signal rows.
 *
 * Fields are almost all free-text strings (builders format values wildly
 * differently). Dates use YYYY-MM-DD text inputs that parse to Firestore
 * Timestamps on save. Two fields — Primary Use and Finish Type — are
 * enums rendered as horizontal chip selectors.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateFieldTs } from '@/components/date-field-ts';
import { FormField } from '@/components/form-field';
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
  value: BuildSheet;
  onChange: (next: BuildSheet) => void;
};

export function BuildSheetForm({ value, onChange }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [showAdvanced, setShowAdvanced] = useState(false);

  function update<K extends keyof BuildSheet>(
    section: K,
    patch: Partial<NonNullable<BuildSheet[K]>>,
  ) {
    onChange({
      ...value,
      [section]: {
        ...(value[section] ?? {}),
        ...patch,
      },
    });
  }

  const overview = value.overview ?? {};
  const engine = value.engine ?? {};
  const drivetrain = value.drivetrain ?? {};
  const suspension = value.suspension ?? {};
  const brakes = value.brakes ?? {};
  const wheelsTires = value.wheelsTires ?? {};
  const exterior = value.exterior ?? {};
  const interior = value.interior ?? {};
  const performance = value.performance ?? {};
  const electrical = value.electrical ?? {};
  const weight = value.weight ?? {};

  return (
    <View style={styles.root}>
      <View style={styles.toggleRow}>
        <ThemedText type="metadata" style={{ color: palette.textMuted, flex: 1 }}>
          A full spec sheet for this build. Fill in what applies —
          everything is optional.
        </ThemedText>
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
            {showAdvanced ? 'Hide advanced fields' : 'Show advanced fields'}
          </ThemedText>
        </Pressable>
      </View>

      {/* =============== Vehicle Overview =============== */}
      <SubSection title="Vehicle Overview" palette={palette}>
        <PrimaryUseSelector
          palette={palette}
          value={overview.primaryUse}
          onChange={(v) => update('overview', { primaryUse: v })}
        />
        {showAdvanced ? (
          <>
            <FormField
              label="Chassis Code"
              value={overview.chassisCode ?? ''}
              onChangeText={(t) => update('overview', { chassisCode: t || undefined })}
              placeholder="e.g. E46, W204, 996"
            />
            <Row>
              <Col>
                <DateFieldTs
                  label="Build Start Date"
                  value={overview.buildStartDate}
                  onChange={(ts) =>
                    update('overview', { buildStartDate: ts })
                  }
                />
              </Col>
              <Col>
                <DateFieldTs
                  label="Build Completion Date"
                  value={overview.buildCompletionDate}
                  onChange={(ts) =>
                    update('overview', { buildCompletionDate: ts })
                  }
                />
              </Col>
            </Row>
          </>
        ) : null}
      </SubSection>

      {/* =============== Engine & Performance =============== */}
      <SubSection title="Engine & Performance" palette={palette}>
        <Row>
          <Col>
            <FormField
              label="Engine Type / Code"
              value={engine.typeCode ?? ''}
              onChangeText={(t) => update('engine', { typeCode: t || undefined })}
              placeholder="e.g. M96/03, 2JZ-GTE, LS3"
            />
          </Col>
          <Col>
            <FormField
              label="Displacement"
              value={engine.displacement ?? ''}
              onChangeText={(t) => update('engine', { displacement: t || undefined })}
              placeholder="3.6L / 3600cc"
            />
          </Col>
        </Row>

        <SubLabel text="Forced Induction" palette={palette} />
        <FormField
          label="Turbo / Supercharger"
          value={engine.turboSupercharger ?? ''}
          onChangeText={(t) => update('engine', { turboSupercharger: t || undefined })}
          placeholder="e.g. Garrett GTX3582R, Whipple 3.0L"
        />
        {showAdvanced ? (
          <FormField
            label="Boost Level"
            value={engine.boostLevel ?? ''}
            onChangeText={(t) => update('engine', { boostLevel: t || undefined })}
            placeholder="e.g. 18 psi"
          />
        ) : null}

        <SubLabel text="Output" palette={palette} />
        <Row>
          <Col>
            <FormField
              label="Horsepower"
              value={engine.horsepower ?? ''}
              onChangeText={(t) => update('engine', { horsepower: t || undefined })}
              placeholder="e.g. 425 hp @ 7000 rpm"
            />
          </Col>
          <Col>
            <FormField
              label="Torque"
              value={engine.torque ?? ''}
              onChangeText={(t) => update('engine', { torque: t || undefined })}
              placeholder="e.g. 317 lb-ft @ 5200 rpm"
            />
          </Col>
        </Row>

        {showAdvanced ? (
          <>
            <SubLabel text="Block / Internals" palette={palette} />
            <FormField
              label="Block / Internals"
              value={engine.block ?? ''}
              onChangeText={(t) => update('engine', { block: t || undefined })}
            />
            <Row>
              <Col>
                <FormField
                  label="Pistons"
                  value={engine.pistons ?? ''}
                  onChangeText={(t) => update('engine', { pistons: t || undefined })}
                />
              </Col>
              <Col>
                <FormField
                  label="Rods"
                  value={engine.rods ?? ''}
                  onChangeText={(t) => update('engine', { rods: t || undefined })}
                />
              </Col>
              <Col>
                <FormField
                  label="Crankshaft"
                  value={engine.crankshaft ?? ''}
                  onChangeText={(t) => update('engine', { crankshaft: t || undefined })}
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <FormField
                  label="Cylinder Head"
                  value={engine.cylinderHead ?? ''}
                  onChangeText={(t) => update('engine', { cylinderHead: t || undefined })}
                />
              </Col>
              <Col>
                <FormField
                  label="Camshaft(s)"
                  value={engine.camshafts ?? ''}
                  onChangeText={(t) => update('engine', { camshafts: t || undefined })}
                />
              </Col>
            </Row>

            <SubLabel text="Induction" palette={palette} />
            <FormField
              label="Induction System"
              value={engine.induction ?? ''}
              onChangeText={(t) => update('engine', { induction: t || undefined })}
            />
            <Row>
              <Col>
                <FormField
                  label="Intake"
                  value={engine.intake ?? ''}
                  onChangeText={(t) => update('engine', { intake: t || undefined })}
                />
              </Col>
              <Col>
                <FormField
                  label="Throttle Body"
                  value={engine.throttleBody ?? ''}
                  onChangeText={(t) => update('engine', { throttleBody: t || undefined })}
                />
              </Col>
            </Row>

            <SubLabel text="Fuel System" palette={palette} />
            <Row>
              <Col>
                <FormField
                  label="Injectors"
                  value={engine.injectors ?? ''}
                  onChangeText={(t) => update('engine', { injectors: t || undefined })}
                />
              </Col>
              <Col>
                <FormField
                  label="Fuel Pump"
                  value={engine.fuelPump ?? ''}
                  onChangeText={(t) => update('engine', { fuelPump: t || undefined })}
                />
              </Col>
            </Row>

            <FormField
              label="Cooling System"
              value={engine.cooling ?? ''}
              onChangeText={(t) => update('engine', { cooling: t || undefined })}
              placeholder="e.g. Mishimoto full aluminum, Setrab 19-row"
            />

            <SubLabel text="Exhaust" palette={palette} />
            <Row>
              <Col>
                <FormField
                  label="Headers"
                  value={engine.headers ?? ''}
                  onChangeText={(t) => update('engine', { headers: t || undefined })}
                />
              </Col>
              <Col>
                <FormField
                  label="Mid-pipe"
                  value={engine.midPipe ?? ''}
                  onChangeText={(t) => update('engine', { midPipe: t || undefined })}
                />
              </Col>
              <Col>
                <FormField
                  label="Muffler"
                  value={engine.muffler ?? ''}
                  onChangeText={(t) => update('engine', { muffler: t || undefined })}
                />
              </Col>
            </Row>

            <SubLabel text="Engine Management" palette={palette} />
            <Row>
              <Col>
                <FormField
                  label="ECU"
                  value={engine.ecu ?? ''}
                  onChangeText={(t) => update('engine', { ecu: t || undefined })}
                />
              </Col>
              <Col>
                <FormField
                  label="Tuning"
                  value={engine.tuning ?? ''}
                  onChangeText={(t) => update('engine', { tuning: t || undefined })}
                />
              </Col>
            </Row>
          </>
        ) : null}
      </SubSection>

      {/* =============== Drivetrain =============== */}
      <SubSection title="Drivetrain" palette={palette}>
        <Row>
          <Col>
            <FormField
              label="Transmission"
              value={drivetrain.transmission ?? ''}
              onChangeText={(t) =>
                update('drivetrain', { transmission: t || undefined })
              }
              placeholder="e.g. 6-speed Getrag 420G"
            />
          </Col>
          <Col>
            <FormField
              label="Differential(s)"
              value={drivetrain.differentials ?? ''}
              onChangeText={(t) =>
                update('drivetrain', { differentials: t || undefined })
              }
              placeholder="e.g. Wavetrac LSD 3.73"
            />
          </Col>
        </Row>
        {showAdvanced ? (
          <>
            <Row>
              <Col>
                <FormField
                  label="Gear Ratios"
                  value={drivetrain.gearRatios ?? ''}
                  onChangeText={(t) =>
                    update('drivetrain', { gearRatios: t || undefined })
                  }
                />
              </Col>
              <Col>
                <FormField
                  label="Final Drive Ratio"
                  value={drivetrain.finalDriveRatio ?? ''}
                  onChangeText={(t) =>
                    update('drivetrain', { finalDriveRatio: t || undefined })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <FormField
                  label="Clutch / Torque Converter"
                  value={drivetrain.clutchConverter ?? ''}
                  onChangeText={(t) =>
                    update('drivetrain', { clutchConverter: t || undefined })
                  }
                />
              </Col>
              <Col>
                <FormField
                  label="Flywheel"
                  value={drivetrain.flywheel ?? ''}
                  onChangeText={(t) =>
                    update('drivetrain', { flywheel: t || undefined })
                  }
                />
              </Col>
            </Row>
            <FormField
              label="Axles / Driveshaft"
              value={drivetrain.axlesDriveshaft ?? ''}
              onChangeText={(t) =>
                update('drivetrain', { axlesDriveshaft: t || undefined })
              }
            />
          </>
        ) : null}
      </SubSection>

      {/* =============== Suspension & Handling =============== */}
      <SubSection title="Suspension & Handling" palette={palette}>
        <Row>
          <Col>
            <FormField
              label="Front Suspension"
              value={suspension.front ?? ''}
              onChangeText={(t) => update('suspension', { front: t || undefined })}
            />
          </Col>
          <Col>
            <FormField
              label="Rear Suspension"
              value={suspension.rear ?? ''}
              onChangeText={(t) => update('suspension', { rear: t || undefined })}
            />
          </Col>
        </Row>
        <FormField
          label="Coilovers / Springs"
          value={suspension.coiloverSprings ?? ''}
          onChangeText={(t) => update('suspension', { coiloverSprings: t || undefined })}
          placeholder="e.g. Öhlins TTX40, H&R Race Springs"
        />
        <FormField
          label="Sway Bars"
          value={suspension.swayBars ?? ''}
          onChangeText={(t) => update('suspension', { swayBars: t || undefined })}
        />
        <FormField
          label="Roll Cage"
          value={suspension.rollCage ?? ''}
          onChangeText={(t) => update('suspension', { rollCage: t || undefined })}
          placeholder="if applicable — e.g. Autopower 6-point bolt-in"
        />
        {showAdvanced ? (
          <>
            <FormField
              label="Dampers"
              value={suspension.dampers ?? ''}
              onChangeText={(t) => update('suspension', { dampers: t || undefined })}
            />
            <FormField
              label="Bushings"
              value={suspension.bushings ?? ''}
              onChangeText={(t) => update('suspension', { bushings: t || undefined })}
            />
            <FormField
              label="Alignment Specs"
              value={suspension.alignmentSpecs ?? ''}
              onChangeText={(t) =>
                update('suspension', { alignmentSpecs: t || undefined })
              }
              placeholder="e.g. -2.8° camber F, -1.8° rear, 1/16&apos; toe-in"
            />
            <SubLabel text="Chassis Reinforcement" palette={palette} />
            <FormField
              label="Chassis Reinforcement"
              value={suspension.chassisReinforcement ?? ''}
              onChangeText={(t) =>
                update('suspension', { chassisReinforcement: t || undefined })
              }
            />
            <Row>
              <Col>
                <FormField
                  label="Bracing"
                  value={suspension.bracing ?? ''}
                  onChangeText={(t) =>
                    update('suspension', { bracing: t || undefined })
                  }
                />
              </Col>
              <Col>
                <FormField
                  label="Seam Welding"
                  value={suspension.seamWelding ?? ''}
                  onChangeText={(t) =>
                    update('suspension', { seamWelding: t || undefined })
                  }
                />
              </Col>
            </Row>
          </>
        ) : null}
      </SubSection>

      {/* =============== Brakes =============== */}
      <SubSection title="Braking System" palette={palette}>
        <SubLabel text="Front" palette={palette} />
        <FormField
          label="Front Brakes"
          value={brakes.frontBrakes ?? ''}
          onChangeText={(t) => update('brakes', { frontBrakes: t || undefined })}
        />
        <Row>
          <Col>
            <FormField
              label="Calipers"
              value={brakes.frontCalipers ?? ''}
              onChangeText={(t) => update('brakes', { frontCalipers: t || undefined })}
              placeholder="e.g. Brembo 6-pot"
            />
          </Col>
          <Col>
            <FormField
              label="Rotors"
              value={brakes.frontRotors ?? ''}
              onChangeText={(t) => update('brakes', { frontRotors: t || undefined })}
              placeholder="e.g. 380mm 2-piece"
            />
          </Col>
        </Row>

        <SubLabel text="Rear" palette={palette} />
        <FormField
          label="Rear Brakes"
          value={brakes.rearBrakes ?? ''}
          onChangeText={(t) => update('brakes', { rearBrakes: t || undefined })}
        />

        {showAdvanced ? (
          <>
            <FormField
              label="Brake Lines"
              value={brakes.brakeLines ?? ''}
              onChangeText={(t) => update('brakes', { brakeLines: t || undefined })}
            />
            <Row>
              <Col>
                <FormField
                  label="Master Cylinder"
                  value={brakes.masterCylinder ?? ''}
                  onChangeText={(t) =>
                    update('brakes', { masterCylinder: t || undefined })
                  }
                />
              </Col>
              <Col>
                <FormField
                  label="Brake Bias System"
                  value={brakes.brakeBiasSystem ?? ''}
                  onChangeText={(t) =>
                    update('brakes', { brakeBiasSystem: t || undefined })
                  }
                />
              </Col>
            </Row>
            <FormField
              label="Pads / Fluid"
              value={brakes.padsFluid ?? ''}
              onChangeText={(t) => update('brakes', { padsFluid: t || undefined })}
              placeholder="e.g. Pagid RS29 / Motul RBF 660"
            />
          </>
        ) : null}
      </SubSection>

      {/* =============== Wheels & Tires =============== */}
      <SubSection title="Wheels & Tires" palette={palette}>
        <SubLabel text="Wheels" palette={palette} />
        <FormField
          label="Wheel Brand / Model"
          value={wheelsTires.wheelBrandModel ?? ''}
          onChangeText={(t) =>
            update('wheelsTires', { wheelBrandModel: t || undefined })
          }
          placeholder="e.g. BBS E88, Forgeline GA1R"
        />
        <Row>
          <Col>
            <FormField
              label="Wheel Size (Front)"
              value={wheelsTires.wheelSizeFront ?? ''}
              onChangeText={(t) =>
                update('wheelsTires', { wheelSizeFront: t || undefined })
              }
              placeholder="18x9.5"
            />
          </Col>
          <Col>
            <FormField
              label="Wheel Size (Rear)"
              value={wheelsTires.wheelSizeRear ?? ''}
              onChangeText={(t) =>
                update('wheelsTires', { wheelSizeRear: t || undefined })
              }
              placeholder="18x10.5"
            />
          </Col>
        </Row>
        {showAdvanced ? (
          <Row>
            <Col>
              <FormField
                label="Offset"
                value={wheelsTires.offset ?? ''}
                onChangeText={(t) =>
                  update('wheelsTires', { offset: t || undefined })
                }
                placeholder="ET +22 / +35"
              />
            </Col>
            <Col>
              <FormField
                label="Finish"
                value={wheelsTires.finish ?? ''}
                onChangeText={(t) =>
                  update('wheelsTires', { finish: t || undefined })
                }
                placeholder="Gold, Satin Black, Diamond Cut"
              />
            </Col>
          </Row>
        ) : null}

        <SubLabel text="Tires" palette={palette} />
        <FormField
          label="Tire Brand / Model"
          value={wheelsTires.tireBrandModel ?? ''}
          onChangeText={(t) =>
            update('wheelsTires', { tireBrandModel: t || undefined })
          }
          placeholder="e.g. Michelin Pilot Sport Cup 2"
        />
        <Row>
          <Col>
            <FormField
              label="Tire Size (Front)"
              value={wheelsTires.tireSizeFront ?? ''}
              onChangeText={(t) =>
                update('wheelsTires', { tireSizeFront: t || undefined })
              }
              placeholder="265/35R18"
            />
          </Col>
          <Col>
            <FormField
              label="Tire Size (Rear)"
              value={wheelsTires.tireSizeRear ?? ''}
              onChangeText={(t) =>
                update('wheelsTires', { tireSizeRear: t || undefined })
              }
              placeholder="295/30R18"
            />
          </Col>
        </Row>
      </SubSection>

      {/* =============== Exterior =============== */}
      <SubSection title="Exterior" palette={palette}>
        <Row>
          <Col>
            <FormField
              label="Paint Color / Code"
              value={exterior.paintColorCode ?? ''}
              onChangeText={(t) =>
                update('exterior', { paintColorCode: t || undefined })
              }
              placeholder="Guards Red / 028"
            />
          </Col>
          <Col>
            <FinishTypeSelector
              palette={palette}
              value={exterior.finishType}
              onChange={(v) => update('exterior', { finishType: v })}
            />
          </Col>
        </Row>
        <FormField
          label="Body Kit / Modifications"
          value={exterior.bodyKit ?? ''}
          onChangeText={(t) => update('exterior', { bodyKit: t || undefined })}
          placeholder="e.g. RWB widebody, TRD aero"
        />
        <FormField
          label="Badging / Branding"
          value={exterior.badging ?? ''}
          onChangeText={(t) => update('exterior', { badging: t || undefined })}
          placeholder="Custom emblems, delete chrome, etc."
        />
        {showAdvanced ? (
          <>
            <SubLabel text="Aero Components" palette={palette} />
            <Row>
              <Col>
                <FormField
                  label="Front Splitter"
                  value={exterior.frontSplitter ?? ''}
                  onChangeText={(t) =>
                    update('exterior', { frontSplitter: t || undefined })
                  }
                />
              </Col>
              <Col>
                <FormField
                  label="Side Skirts"
                  value={exterior.sideSkirts ?? ''}
                  onChangeText={(t) =>
                    update('exterior', { sideSkirts: t || undefined })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <FormField
                  label="Rear Diffuser"
                  value={exterior.rearDiffuser ?? ''}
                  onChangeText={(t) =>
                    update('exterior', { rearDiffuser: t || undefined })
                  }
                />
              </Col>
              <Col>
                <FormField
                  label="Wing / Spoiler"
                  value={exterior.wingSpoiler ?? ''}
                  onChangeText={(t) =>
                    update('exterior', { wingSpoiler: t || undefined })
                  }
                />
              </Col>
            </Row>
          </>
        ) : null}
      </SubSection>

      {/* =============== Interior =============== */}
      <SubSection title="Interior" palette={palette}>
        <Row>
          <Col>
            <FormField
              label="Seats"
              value={interior.seats ?? ''}
              onChangeText={(t) => update('interior', { seats: t || undefined })}
              placeholder="e.g. Recaro Pole Position"
            />
          </Col>
          <Col>
            <FormField
              label="Upholstery Material"
              value={interior.upholsteryMaterial ?? ''}
              onChangeText={(t) =>
                update('interior', { upholsteryMaterial: t || undefined })
              }
              placeholder="e.g. Leather, Alcantara, cloth"
            />
          </Col>
        </Row>
        <Row>
          <Col>
            <FormField
              label="Steering Wheel"
              value={interior.steeringWheel ?? ''}
              onChangeText={(t) => update('interior', { steeringWheel: t || undefined })}
            />
          </Col>
          <Col>
            <FormField
              label="Dash / Gauges"
              value={interior.dashGauges ?? ''}
              onChangeText={(t) => update('interior', { dashGauges: t || undefined })}
            />
          </Col>
        </Row>
        <Row>
          <Col>
            <FormField
              label="Infotainment"
              value={interior.infotainment ?? ''}
              onChangeText={(t) => update('interior', { infotainment: t || undefined })}
            />
          </Col>
          <Col>
            <FormField
              label="Sound System"
              value={interior.soundSystem ?? ''}
              onChangeText={(t) => update('interior', { soundSystem: t || undefined })}
            />
          </Col>
        </Row>
        <FormField
          label="Climate Control"
          value={interior.climateControl ?? ''}
          onChangeText={(t) => update('interior', { climateControl: t || undefined })}
          placeholder="e.g. OEM auto, Vintage Air retrofit"
        />
        {showAdvanced ? (
          <>
            <SubLabel text="Safety Equipment" palette={palette} />
            <Row>
              <Col>
                <FormField
                  label="Harnesses"
                  value={interior.harnesses ?? ''}
                  onChangeText={(t) =>
                    update('interior', { harnesses: t || undefined })
                  }
                />
              </Col>
              <Col>
                <FormField
                  label="Fire Suppression"
                  value={interior.fireSuppression ?? ''}
                  onChangeText={(t) =>
                    update('interior', { fireSuppression: t || undefined })
                  }
                />
              </Col>
            </Row>
          </>
        ) : null}
      </SubSection>

      {/* =============== Performance Metrics =============== */}
      <SubSection title="Performance Metrics" palette={palette}>
        <Row>
          <Col>
            <FormField
              label="0–60 mph"
              value={performance.zeroToSixty ?? ''}
              onChangeText={(t) =>
                update('performance', { zeroToSixty: t || undefined })
              }
              placeholder="3.2 sec"
            />
          </Col>
          <Col>
            <FormField
              label="1/4 Mile"
              value={performance.quarterMile ?? ''}
              onChangeText={(t) =>
                update('performance', { quarterMile: t || undefined })
              }
              placeholder="11.42 @ 123 mph"
            />
          </Col>
        </Row>
        <Row>
          <Col>
            <FormField
              label="Top Speed"
              value={performance.topSpeed ?? ''}
              onChangeText={(t) => update('performance', { topSpeed: t || undefined })}
              placeholder="187 mph"
            />
          </Col>
          <Col>
            <FormField
              label="Dyno Results"
              value={performance.dynoResults ?? ''}
              onChangeText={(t) =>
                update('performance', { dynoResults: t || undefined })
              }
              placeholder="425whp / 400wtq at 11 psi"
            />
          </Col>
        </Row>
        {showAdvanced ? (
          <FormField
            label="Track Times"
            value={performance.trackTimes ?? ''}
            onChangeText={(t) =>
              update('performance', { trackTimes: t || undefined })
            }
            placeholder="Laguna Seca 1:38.2, VIR 1:52.4"
          />
        ) : null}
      </SubSection>

      {/* =============== Electrical & Technology =============== */}
      {showAdvanced ? (
        <SubSection title="Electrical & Technology" palette={palette}>
          <Row>
            <Col>
              <FormField
                label="Wiring Harness"
                value={electrical.wiringHarness ?? ''}
                onChangeText={(t) =>
                  update('electrical', { wiringHarness: t || undefined })
                }
              />
            </Col>
            <Col>
              <FormField
                label="Battery Setup"
                value={electrical.batterySetup ?? ''}
                onChangeText={(t) =>
                  update('electrical', { batterySetup: t || undefined })
                }
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <FormField
                label="Alternator"
                value={electrical.alternator ?? ''}
                onChangeText={(t) =>
                  update('electrical', { alternator: t || undefined })
                }
              />
            </Col>
            <Col>
              <FormField
                label="Data Logging / Telemetry"
                value={electrical.dataLogging ?? ''}
                onChangeText={(t) =>
                  update('electrical', { dataLogging: t || undefined })
                }
              />
            </Col>
          </Row>
          <FormField
            label="Custom Electronics"
            value={electrical.customElectronics ?? ''}
            onChangeText={(t) =>
              update('electrical', { customElectronics: t || undefined })
            }
          />
        </SubSection>
      ) : null}

      {/* =============== Weight & Balance =============== */}
      <SubSection title="Weight & Balance" palette={palette}>
        <FormField
          label="Curb Weight"
          value={weight.curbWeight ?? ''}
          onChangeText={(t) => update('weight', { curbWeight: t || undefined })}
          placeholder="e.g. 3,200 lbs / 1,451 kg"
        />
        {showAdvanced ? (
          <>
            <Row>
              <Col>
                <FormField
                  label="Weight Distribution (F)"
                  value={weight.weightDistributionFront ?? ''}
                  onChangeText={(t) =>
                    update('weight', { weightDistributionFront: t || undefined })
                  }
                  placeholder="52%"
                />
              </Col>
              <Col>
                <FormField
                  label="Weight Distribution (R)"
                  value={weight.weightDistributionRear ?? ''}
                  onChangeText={(t) =>
                    update('weight', { weightDistributionRear: t || undefined })
                  }
                  placeholder="48%"
                />
              </Col>
            </Row>
            <FormField
              label="Weight Reduction Measures"
              value={weight.reductionMeasures ?? ''}
              onChangeText={(t) => update('weight', { reductionMeasures: t || undefined })}
              placeholder="Lexan rear glass, CF hood, deleted AC..."
            />
          </>
        ) : null}
      </SubSection>
    </View>
  );
}

// ---------- Small components ----------

function SubSection({
  title,
  palette,
  children,
}: {
  title: string;
  palette: Palette;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.subSection}>
      <View style={styles.subSectionHeader}>
        <ThemedText type="eyebrow" style={{ color: palette.tint }}>
          {title}
        </ThemedText>
        <View style={[styles.subRule, { backgroundColor: palette.border }]} />
      </View>
      <View style={styles.subSectionBody}>{children}</View>
    </View>
  );
}

function SubLabel({ text, palette }: { text: string; palette: Palette }) {
  return (
    <ThemedText
      type="eyebrow"
      style={{ color: palette.textMuted, marginTop: 6 }}>
      {text}
    </ThemedText>
  );
}

function PrimaryUseSelector({
  value,
  onChange,
  palette,
}: {
  value: PrimaryUse | undefined;
  onChange: (v: PrimaryUse | undefined) => void;
  palette: Palette;
}) {
  return (
    <ChipRow
      label="Primary Use"
      palette={palette}
      options={Object.keys(PRIMARY_USE_LABELS) as PrimaryUse[]}
      renderLabel={(k) => PRIMARY_USE_LABELS[k]}
      value={value}
      onChange={onChange}
    />
  );
}

function FinishTypeSelector({
  value,
  onChange,
  palette,
}: {
  value: FinishType | undefined;
  onChange: (v: FinishType | undefined) => void;
  palette: Palette;
}) {
  return (
    <ChipRow
      label="Finish Type"
      palette={palette}
      options={Object.keys(FINISH_TYPE_LABELS) as FinishType[]}
      renderLabel={(k) => FINISH_TYPE_LABELS[k]}
      value={value}
      onChange={onChange}
    />
  );
}

function ChipRow<T extends string>({
  label,
  palette,
  options,
  renderLabel,
  value,
  onChange,
}: {
  label: string;
  palette: Palette;
  options: T[];
  renderLabel: (v: T) => string;
  value: T | undefined;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted, marginBottom: 6 }}>
        {label}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(active ? undefined : opt)}
              style={[
                styles.chip,
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
                {renderLabel(opt)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Col({ children }: { children: React.ReactNode }) {
  return <View style={styles.col}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    gap: 20,
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
    gap: 12,
  },
  subSectionHeader: {
    gap: 6,
    marginTop: 6,
  },
  subRule: {
    height: 1,
    width: 60,
  },
  subSectionBody: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  col: {
    flex: 1,
  },
  chipWrap: {
    gap: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
});
