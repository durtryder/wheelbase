import type { Timestamp } from 'firebase/firestore';

/**
 * Vehicle — the core record. Field set mirrors the level of detail a serious
 * collector expects on a Bring a Trailer listing: identity, spec, condition,
 * history, and provenance. OEM fields fetched from vPIC land in `oemSpecs`
 * and never overwrite user-authored values.
 */
export type Vehicle = {
  id: string;
  ownerId: string;
  /**
   * Denormalized display name of the owner at last write time. Populated
   * from Firebase Auth's user.displayName on create / update. Not reactive
   * to displayName changes elsewhere — next time the owner saves one of
   * their vehicles, that vehicle's attribution refreshes.
   */
  ownerDisplayName?: string;

  // Identity
  year: number;
  make: string;
  model: string;
  trim?: string;
  nickname?: string;
  /**
   * Instagram handle for this specific build (without the leading "@"). Per
   * vehicle, not per user — many enthusiasts run a dedicated account for one
   * car. Stored normalized: no "@", no URL, no trailing slash.
   */
  instagramHandle?: string;
  vin?: string;
  chassisNumber?: string;

  /**
   * Free-text narrative of this vehicle — where it came from, what it's been
   * through, why it matters. Rendered as a "lede" paragraph near the top of
   * the detail page. Plans to be AI-generated from service records eventually
   * but can always be hand-written.
   */
  story?: string;

  // Spec (user-authored, can be seeded from oemSpecs)
  bodyStyle?: BodyStyle;
  exteriorColor?: string;
  interiorColor?: string;
  interiorMaterial?: InteriorMaterial;
  engine?: EngineSpec;
  transmission?: TransmissionSpec;
  driveType?: DriveType;

  // Condition
  mileage?: number;
  mileageIsTMU?: boolean;
  titleStatus?: TitleStatus;

  // Ownership / location
  acquiredAt?: Timestamp;
  priorOwnerCount?: number;
  location?: Location;

  // History + provenance (free-form entries, ordered)
  knownFlaws?: HistoryEntry[];
  serviceHistory?: HistoryEntry[];
  ownershipHistory?: OwnershipEntry[];
  includedItems?: string[];
  builder?: BuilderInfo;
  // Full build sheet. Every field is optional — the owner fills in
  // what applies to their build. See BuildSheet below for the full structure.
  buildSheet?: BuildSheet;
  // Actual uploaded documents (PDFs, scans) live in the /documents collection
  // and are joined on vehicleId at query time.

  // Customizations (user's mods, categorized)
  modifications: Modification[];

  // OEM data fetched from vPIC (or other sources), non-authoritative
  oemSpecs?: OemSpecs;

  // Media
  coverPhotoId?: string;
  mediaIds: string[];

  // Sharing
  visibility: Visibility;
  publicSlug?: string;

  /**
   * User-controlled sort index for the owner's garage. Lower values
   * appear first. Unset on older records — those fall back to createdAt
   * order. Written as a dense 0..N-1 sequence whenever the user saves a
   * new order, so we never run out of room.
   */
  displayOrder?: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type BodyStyle =
  | 'coupe'
  | 'sedan'
  | 'hatchback'
  | 'wagon'
  | 'convertible'
  | 'roadster'
  | 'targa'
  | 'shooting-brake'
  | 'suv'
  | 'crossover'
  | 'pickup'
  | 'van'
  | 'minivan'
  | 'microcar'
  | 'other';

export type InteriorMaterial =
  | 'leather'
  | 'cloth'
  | 'vinyl'
  | 'alcantara'
  | 'suede'
  | 'two-tone'
  | 'other';

export type EngineSpec = {
  displacementCc?: number;
  displacementCi?: number;
  cylinders?: number;
  configuration?: string; // e.g. "Inline-6", "V8", "Flat-6"
  aspiration?: 'naturally-aspirated' | 'turbocharged' | 'supercharged' | 'twin-turbo' | 'electric';
  fuelType?: 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'plug-in-hybrid' | 'other';
  horsepower?: number;
  torqueLbFt?: number;
  notes?: string;
};

export type TransmissionSpec = {
  type?: 'manual' | 'automatic' | 'dual-clutch' | 'cvt' | 'single-speed' | 'semi-automatic';
  speeds?: number;
  notes?: string;
};

export type DriveType = 'fwd' | 'rwd' | 'awd' | '4wd';

export type TitleStatus = 'clean' | 'salvage' | 'rebuilt' | 'lemon' | 'bonded' | 'parts-only' | 'other';

export type Location = {
  city?: string;
  stateRegion?: string;
  country?: string;
};

/** Free-form entry used for service records and known flaws. */
export type HistoryEntry = {
  id: string;
  date?: Timestamp;
  title: string;
  description?: string;
  mileageAtEntry?: number;
  cost?: number;
  vendor?: string;
  mediaIds?: string[];
};

/**
 * BuildSheet — the comprehensive build record. Every field is
 * optional; most are free-text because builders are precise in ways that
 * don't map cleanly to fixed formats ("390 hp @ 6500 rpm", "1/4 mile
 * 12.34 @ 113 mph", "Garrett GTX3582R"). Fields split into sections that
 * mirror the detail-page and editor UI.
 */
export type BuildSheet = {
  overview?: BuildSheetOverview;
  engine?: BuildSheetEngine;
  drivetrain?: BuildSheetDrivetrain;
  suspension?: BuildSheetSuspension;
  brakes?: BuildSheetBrakes;
  wheelsTires?: BuildSheetWheelsTires;
  exterior?: BuildSheetExterior;
  interior?: BuildSheetInterior;
  performance?: BuildSheetPerformance;
  electrical?: BuildSheetElectrical;
  weight?: BuildSheetWeight;
};

export type PrimaryUse =
  | 'street'
  | 'track'
  | 'show'
  | 'restomod'
  | 'off-road'
  | 'other';

export const PRIMARY_USE_LABELS: Record<PrimaryUse, string> = {
  street: 'Street',
  track: 'Track',
  show: 'Show',
  restomod: 'Restomod',
  'off-road': 'Off-road',
  other: 'Other',
};

export type FinishType =
  | 'gloss'
  | 'matte'
  | 'satin'
  | 'metallic'
  | 'pearlescent'
  | 'other';

export const FINISH_TYPE_LABELS: Record<FinishType, string> = {
  gloss: 'Gloss',
  matte: 'Matte',
  satin: 'Satin',
  metallic: 'Metallic',
  pearlescent: 'Pearlescent',
  other: 'Other',
};

export type BuildSheetOverview = {
  chassisCode?: string;
  buildStartDate?: Timestamp;
  buildCompletionDate?: Timestamp;
  primaryUse?: PrimaryUse;
};

export type BuildSheetEngine = {
  typeCode?: string;
  displacement?: string;
  block?: string;
  pistons?: string;
  rods?: string;
  crankshaft?: string;
  cylinderHead?: string;
  camshafts?: string;
  induction?: string;
  intake?: string;
  throttleBody?: string;
  turboSupercharger?: string;
  boostLevel?: string;
  injectors?: string;
  fuelPump?: string;
  cooling?: string;
  headers?: string;
  midPipe?: string;
  muffler?: string;
  ecu?: string;
  tuning?: string;
  horsepower?: string;
  torque?: string;
};

export type BuildSheetDrivetrain = {
  transmission?: string;
  gearRatios?: string;
  clutchConverter?: string;
  flywheel?: string;
  differentials?: string;
  finalDriveRatio?: string;
  axlesDriveshaft?: string;
};

export type BuildSheetSuspension = {
  front?: string;
  rear?: string;
  coiloverSprings?: string;
  dampers?: string;
  swayBars?: string;
  bushings?: string;
  alignmentSpecs?: string;
  chassisReinforcement?: string;
  bracing?: string;
  seamWelding?: string;
  rollCage?: string;
};

export type BuildSheetBrakes = {
  frontBrakes?: string;
  frontCalipers?: string;
  frontRotors?: string;
  rearBrakes?: string;
  brakeLines?: string;
  masterCylinder?: string;
  brakeBiasSystem?: string;
  padsFluid?: string;
};

export type BuildSheetWheelsTires = {
  wheelBrandModel?: string;
  wheelSizeFront?: string;
  wheelSizeRear?: string;
  offset?: string;
  finish?: string;
  tireBrandModel?: string;
  tireSizeFront?: string;
  tireSizeRear?: string;
};

export type BuildSheetExterior = {
  paintColorCode?: string;
  finishType?: FinishType;
  bodyKit?: string;
  frontSplitter?: string;
  sideSkirts?: string;
  rearDiffuser?: string;
  wingSpoiler?: string;
  badging?: string;
};

export type BuildSheetInterior = {
  seats?: string;
  upholsteryMaterial?: string;
  steeringWheel?: string;
  dashGauges?: string;
  infotainment?: string;
  soundSystem?: string;
  harnesses?: string;
  fireSuppression?: string;
  climateControl?: string;
};

export type BuildSheetPerformance = {
  zeroToSixty?: string;
  quarterMile?: string;
  topSpeed?: string;
  dynoResults?: string;
  trackTimes?: string;
};

export type BuildSheetElectrical = {
  wiringHarness?: string;
  batterySetup?: string;
  alternator?: string;
  dataLogging?: string;
  customElectronics?: string;
};

export type BuildSheetWeight = {
  curbWeight?: string;
  weightDistributionFront?: string;
  weightDistributionRear?: string;
  reductionMeasures?: string;
};

export type BuilderInfo = {
  /** Name of the builder / shop (e.g., "Singer Vehicle Design"). */
  name?: string;
  /** City / state / country of the build. */
  location?: string;
  /** Date the build completed (or was delivered). */
  date?: Timestamp;
  /** Free-form notes about the build, scope, etc. */
  notes?: string;
};

export type OwnershipEntry = {
  id: string;
  ownerName?: string;
  location?: Location;
  acquiredAt?: Timestamp;
  relinquishedAt?: Timestamp;
  notes?: string;
  /**
   * Marks which entry represents the vehicle's current steward. Enforced
   * as single-select by the editor UI. When no row is flagged current, the
   * detail page falls back to "no current owner listed" rather than
   * guessing from dates.
   */
  isCurrent?: boolean;
};

/**
 * A file uploaded to document the vehicle — PDF, scanned image, etc.
 * Lives in its own /documents Firestore collection so we can query by
 * vehicleId without bloating the Vehicle doc.
 */
export type VehicleDocument = {
  id: string;
  vehicleId: string;
  ownerId: string;

  title: string;
  kind: DocumentKind;
  description?: string;

  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  fileSize?: number;

  /** Date that appears on the document itself (e.g., service date). */
  documentDate?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type DocumentKind =
  | 'service-record'
  | 'shop-invoice'
  | 'award'
  | 'window-sticker'
  | 'build-sheet'
  | 'marti-report'
  | 'pozzi-report'
  | 'coa'
  | 'title'
  | 'registration'
  | 'insurance'
  | 'inspection'
  | 'manual'
  | 'correspondence'
  | 'other';

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  'service-record': 'Service Record',
  'shop-invoice': 'Shop Invoice',
  award: 'Award',
  'window-sticker': 'Window Sticker',
  'build-sheet': 'Build Sheet',
  'marti-report': 'Marti Report',
  'pozzi-report': 'Pozzi Report',
  coa: 'Certificate of Authenticity',
  title: 'Title',
  registration: 'Registration',
  insurance: 'Insurance',
  inspection: 'Inspection',
  manual: 'Owner\u2019s Manual',
  correspondence: 'Correspondence',
  other: 'Other',
};

export type Modification = {
  id: string;
  category: ModCategory;
  title: string;
  description?: string;
  installedAt?: Timestamp;
  mileageAtInstall?: number;
  cost?: number;
  vendor?: string;
  mediaIds?: string[];
};

export type ModCategory =
  | 'engine'
  | 'drivetrain'
  | 'suspension'
  | 'brakes'
  | 'wheels-tires'
  | 'exterior'
  | 'interior'
  | 'audio-electronics'
  | 'other';

export type OemSpecs = {
  source: 'vpic' | 'wikidata' | 'carquery' | 'manual' | 'other';
  fetchedAt?: Timestamp;
  // Common normalized fields (mirrors vPIC variables we surface in the UI)
  make?: string;
  model?: string;
  modelYear?: number;
  trim?: string;
  series?: string;
  bodyClass?: string;
  doors?: number;
  engineCylinders?: number;
  displacementCc?: number;
  displacementCi?: number;
  fuelType?: string;
  driveType?: string;
  transmissionStyle?: string;
  transmissionSpeeds?: number;
  plantCity?: string;
  plantState?: string;
  plantCountry?: string;
  manufacturer?: string;
  vehicleType?: string;
  /** Catchall for any vPIC variable we haven't surfaced yet. */
  raw?: Record<string, unknown>;
};

export type Visibility = 'private' | 'unlisted' | 'public';

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: 'Private',
  unlisted: 'Unlisted',
  public: 'Public',
};

export const VISIBILITY_DESCRIPTIONS: Record<Visibility, string> = {
  private: 'Only you can see this vehicle.',
  unlisted: 'Anyone with the link can view. Not shown in the public feed.',
  public: 'Anyone can view. Appears in the public Wheelbase feed.',
};

export type MediaItem = {
  id: string;
  vehicleId: string;
  ownerId: string;
  kind: 'photo' | 'video';
  storagePath: string;
  downloadUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  caption?: string;
  isHero?: boolean;
  order?: number;
  /** When the photo was captured (from EXIF); photos only. */
  takenAt?: Timestamp;
  /** Camera-ish details pulled from EXIF when available. */
  exif?: MediaExif;
  createdAt: Timestamp;
};

export type MediaExif = {
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  focalLengthMm?: number;
  aperture?: number;
  shutterSeconds?: number;
  iso?: number;
  latitude?: number;
  longitude?: number;
};
