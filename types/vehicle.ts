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

  // Identity
  year: number;
  make: string;
  model: string;
  trim?: string;
  nickname?: string;
  vin?: string;
  chassisNumber?: string;

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
