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
  uploadBytes,
} from 'firebase/storage';

import { db, storage } from '@/lib/firebase';
import type { MediaItem } from '@/types/vehicle';

const MEDIA = 'media';
const VEHICLES = 'vehicles';

/**
 * Upload a single photo from a local/blob URI to Firebase Storage, write a
 * MediaItem metadata row to Firestore, and return the hydrated record.
 *
 * Path layout: users/{uid}/vehicles/{vehicleId}/photos/{mediaId}.{ext}
 */
export async function uploadVehiclePhoto(params: {
  ownerId: string;
  vehicleId: string;
  uri: string;
  width?: number;
  height?: number;
}): Promise<MediaItem> {
  const { ownerId, vehicleId, uri, width, height } = params;

  const response = await fetch(uri);
  const blob = await response.blob();

  const mimeType = blob.type || 'image/jpeg';
  const extension = extensionFor(mimeType);
  const mediaId = generateId();
  const path = `users/${ownerId}/vehicles/${vehicleId}/photos/${mediaId}.${extension}`;

  const objectRef = storageRef(storage, path);
  await uploadBytes(objectRef, blob, { contentType: mimeType });
  const downloadUrl = await getDownloadURL(objectRef);

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

  return {
    id: docRef.id,
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
    // Storage object may have already been deleted; keep going so the
    // orphaned metadata doesn't get stuck.
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
