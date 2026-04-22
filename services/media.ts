import exifr from 'exifr';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';

import { db, storage } from '@/lib/firebase';
import type { MediaExif, MediaItem } from '@/types/vehicle';

const MEDIA = 'media';
const VEHICLES = 'vehicles';

export type UploadKind = 'photo' | 'video';

/**
 * Upload a single media file (photo or video) from a local/blob URI to
 * Firebase Storage, write a MediaItem metadata row to Firestore, and return
 * the hydrated record.
 *
 * Uses uploadBytesResumable so we can surface progress and distinguish
 * cleanly between Storage errors and Firestore errors. Each step is logged
 * to the console so stalls are diagnosable from DevTools.
 *
 * Path layout:
 *   users/{uid}/vehicles/{vehicleId}/photos/{mediaId}.{ext}
 *   users/{uid}/vehicles/{vehicleId}/videos/{mediaId}.{ext}
 */
export async function uploadVehicleMedia(params: {
  kind: UploadKind;
  ownerId: string;
  vehicleId: string;
  uri: string;
  width?: number;
  height?: number;
  durationMs?: number;
  onProgress?: (uploaded: number, total: number) => void;
}): Promise<MediaItem> {
  const {
    kind,
    ownerId,
    vehicleId,
    uri,
    width,
    height,
    durationMs,
    onProgress,
  } = params;

  console.log(`[media] fetching ${kind} blob from`, uri);
  let blob: Blob;
  try {
    const response = await fetch(uri);
    blob = await response.blob();
    console.log('[media] blob ready', { size: blob.size, type: blob.type });
  } catch (e) {
    console.error('[media] blob fetch failed', e);
    throw new Error(
      `Couldn't read the selected file: ${e instanceof Error ? e.message : 'unknown'}`,
    );
  }

  // For photos, try to read EXIF so we can attach a real "taken on" date
  // (plus camera/lens/exposure if we have it). Failures are non-fatal.
  let takenAt: Date | undefined;
  let exifData: MediaExif | undefined;
  if (kind === 'photo') {
    try {
      const raw = await exifr.parse(blob, {
        pick: [
          'DateTimeOriginal',
          'CreateDate',
          'ModifyDate',
          'Make',
          'Model',
          'LensModel',
          'FocalLength',
          'FNumber',
          'ExposureTime',
          'ISO',
          'latitude',
          'longitude',
        ],
      });
      if (raw) {
        const d =
          raw.DateTimeOriginal instanceof Date
            ? raw.DateTimeOriginal
            : raw.CreateDate instanceof Date
              ? raw.CreateDate
              : raw.ModifyDate instanceof Date
                ? raw.ModifyDate
                : undefined;
        if (d && !Number.isNaN(d.getTime())) takenAt = d;

        const candidate: MediaExif = {
          cameraMake: typeof raw.Make === 'string' ? raw.Make.trim() : undefined,
          cameraModel: typeof raw.Model === 'string' ? raw.Model.trim() : undefined,
          lensModel:
            typeof raw.LensModel === 'string' ? raw.LensModel.trim() : undefined,
          focalLengthMm: typeof raw.FocalLength === 'number' ? raw.FocalLength : undefined,
          aperture: typeof raw.FNumber === 'number' ? raw.FNumber : undefined,
          shutterSeconds:
            typeof raw.ExposureTime === 'number' ? raw.ExposureTime : undefined,
          iso: typeof raw.ISO === 'number' ? raw.ISO : undefined,
          latitude: typeof raw.latitude === 'number' ? raw.latitude : undefined,
          longitude: typeof raw.longitude === 'number' ? raw.longitude : undefined,
        };
        const hasAny = Object.values(candidate).some((v) => v !== undefined);
        if (hasAny) exifData = candidate;
        console.log('[media] EXIF parsed', { takenAt, exifData });
      }
    } catch (e) {
      console.warn('[media] EXIF parse failed; proceeding without', e);
    }
  }

  const defaultMime = kind === 'video' ? 'video/mp4' : 'image/jpeg';
  const mimeType = blob.type || defaultMime;
  const extension = extensionFor(mimeType, kind);
  const mediaId = generateId();
  const folder = kind === 'video' ? 'videos' : 'photos';
  const path = `users/${ownerId}/vehicles/${vehicleId}/${folder}/${mediaId}.${extension}`;

  const objectRef = storageRef(storage, path);

  console.log(`[media] starting ${kind} upload to`, path);
  const task = uploadBytesResumable(objectRef, blob, { contentType: mimeType });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        console.log(
          '[media] progress',
          snapshot.bytesTransferred,
          '/',
          snapshot.totalBytes,
        );
        onProgress?.(snapshot.bytesTransferred, snapshot.totalBytes);
      },
      (error) => {
        console.error('[media] storage upload failed', error.code, error.message, error);
        reject(
          new Error(
            `Storage upload failed (${error.code || 'unknown'}): ${error.message}`,
          ),
        );
      },
      () => {
        console.log('[media] upload complete');
        resolve();
      },
    );
  });

  let downloadUrl: string;
  try {
    downloadUrl = await getDownloadURL(objectRef);
    console.log('[media] got download URL');
  } catch (e) {
    console.error('[media] getDownloadURL failed', e);
    throw new Error(
      `Couldn't get download URL: ${e instanceof Error ? e.message : 'unknown'}`,
    );
  }

  let docId: string;
  try {
    const docRef = await addDoc(collection(db, MEDIA), {
      vehicleId,
      ownerId,
      kind,
      storagePath: path,
      downloadUrl,
      width,
      height,
      durationMs,
      takenAt,
      exif: exifData,
      createdAt: serverTimestamp(),
    });
    docId = docRef.id;
    console.log('[media] MediaItem saved', docId);
  } catch (e) {
    console.error('[media] addDoc failed', e);
    throw new Error(
      `Saved the file to storage but couldn't write metadata: ${
        e instanceof Error ? e.message : 'unknown'
      }`,
    );
  }

  return {
    id: docId,
    vehicleId,
    ownerId,
    kind,
    storagePath: path,
    downloadUrl,
    width,
    height,
    durationMs,
    // takenAt/exif intentionally omitted from optimistic return — the real
    // Firestore Timestamp + round-tripped object come in via onSnapshot
  } as MediaItem;
}

/** Thin compatibility wrapper for the photo-only call site. */
export function uploadVehiclePhoto(params: {
  ownerId: string;
  vehicleId: string;
  uri: string;
  width?: number;
  height?: number;
  onProgress?: (uploaded: number, total: number) => void;
}) {
  return uploadVehicleMedia({ ...params, kind: 'photo' });
}

export function watchMediaForVehicle(
  vehicleId: string,
  onNext: (items: MediaItem[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, MEDIA),
    where('vehicleId', '==', vehicleId),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MediaItem);
      onNext(items);
    },
    (err) => onError(err),
  );
}

export async function deleteMediaItem(item: MediaItem): Promise<void> {
  try {
    await deleteObject(storageRef(storage, item.storagePath));
  } catch (e) {
    console.warn('[media] storage object delete failed:', e);
  }
  await deleteDoc(doc(db, MEDIA, item.id));
}

export async function setVehicleCoverPhoto(vehicleId: string, mediaId: string | null) {
  await updateDoc(doc(db, VEHICLES, vehicleId), {
    coverPhotoId: mediaId,
    updatedAt: serverTimestamp(),
  });
}

/** Update (or clear) a MediaItem's caption. Owner-only at the rules layer. */
export async function updateMediaCaption(
  mediaId: string,
  caption: string,
): Promise<void> {
  await updateDoc(doc(db, MEDIA, mediaId), {
    caption: caption.trim() || '',
  });
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extensionFor(mimeType: string, kind: UploadKind): string {
  if (kind === 'video') {
    const map: Record<string, string> = {
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-m4v': 'm4v',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'video/3gpp': '3gp',
    };
    return map[mimeType] ?? 'mp4';
  }
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  return map[mimeType] ?? 'jpg';
}
