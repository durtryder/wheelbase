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
import type { MediaItem } from '@/types/vehicle';

const MEDIA = 'media';
const VEHICLES = 'vehicles';

/**
 * Upload a single photo from a local/blob URI to Firebase Storage, write a
 * MediaItem metadata row to Firestore, and return the hydrated record.
 *
 * Uses uploadBytesResumable so we can surface progress and distinguish
 * cleanly between Storage errors and Firestore errors. Each step is logged
 * to the console so stalls are diagnosable from DevTools.
 *
 * Path layout: users/{uid}/vehicles/{vehicleId}/photos/{mediaId}.{ext}
 */
export async function uploadVehiclePhoto(params: {
  ownerId: string;
  vehicleId: string;
  uri: string;
  width?: number;
  height?: number;
  onProgress?: (uploaded: number, total: number) => void;
}): Promise<MediaItem> {
  const { ownerId, vehicleId, uri, width, height, onProgress } = params;

  console.log('[media] fetching blob from', uri);
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

  const mimeType = blob.type || 'image/jpeg';
  const extension = extensionFor(mimeType);
  const mediaId = generateId();
  const path = `users/${ownerId}/vehicles/${vehicleId}/photos/${mediaId}.${extension}`;

  const objectRef = storageRef(storage, path);

  console.log('[media] starting upload to', path);
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
      kind: 'photo',
      storagePath: path,
      downloadUrl,
      width,
      height,
      createdAt: serverTimestamp(),
    });
    docId = docRef.id;
    console.log('[media] MediaItem saved', docId);
  } catch (e) {
    console.error('[media] addDoc failed', e);
    throw new Error(
      `Saved the photo to storage but couldn't write metadata: ${
        e instanceof Error ? e.message : 'unknown'
      }`,
    );
  }

  return {
    id: docId,
    vehicleId,
    ownerId,
    kind: 'photo',
    storagePath: path,
    downloadUrl,
    width,
    height,
  } as MediaItem;
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

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extensionFor(mimeType: string): string {
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
