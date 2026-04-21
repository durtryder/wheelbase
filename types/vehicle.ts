import type { Timestamp } from 'firebase/firestore';

/**
 * Core vehicle record owned by a user. OEM specs come from an external source
 * (starting with NHTSA vPIC). User-authored customizations live alongside.
 */
export type Vehicle = {
  id: string;
  ownerId: string;

  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;

  nickname?: string;
  color?: string;
  mileage?: number;
  acquiredAt?: Timestamp;

  oemSpecs?: OemSpecs;
  modifications: Modification[];

  coverPhotoId?: string;
  mediaIds: string[];

  visibility: Visibility;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type OemSpecs = {
  source: 'vpic' | 'manual' | 'other';
  fetchedAt?: Timestamp;
  engine?: string;
  transmission?: string;
  driveType?: string;
  horsepower?: number;
  torque?: number;
  bodyClass?: string;
  raw?: Record<string, unknown>;
};

export type Modification = {
  id: string;
  category: ModCategory;
  title: string;
  description?: string;
  installedAt?: Timestamp;
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
  | 'electronics'
  | 'other';

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
  createdAt: Timestamp;
};
