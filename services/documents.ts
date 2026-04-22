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
  type Timestamp,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';

import { db, storage } from '@/lib/firebase';
import type { DocumentKind, VehicleDocument } from '@/types/vehicle';

const DOCUMENTS = 'documents';

/**
 * Upload a vehicle document (PDF, scanned image, etc.) to Firebase Storage
 * and write its metadata to the /documents Firestore collection. Returns the
 * hydrated record.
 *
 * Path layout: users/{uid}/vehicles/{vehicleId}/documents/{docId}.{ext}
 */
export async function uploadVehicleDocument(params: {
  ownerId: string;
  vehicleId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  title: string;
  kind: DocumentKind;
  description?: string;
  documentDate?: Date;
  onProgress?: (uploaded: number, total: number) => void;
}): Promise<VehicleDocument> {
  const {
    ownerId,
    vehicleId,
    uri,
    fileName,
    mimeType,
    fileSize,
    title,
    kind,
    description,
    documentDate,
    onProgress,
  } = params;

  console.log('[doc] fetching blob from', uri);
  let blob: Blob;
  try {
    const response = await fetch(uri);
    blob = await response.blob();
    console.log('[doc] blob ready', { size: blob.size, type: blob.type });
  } catch (e) {
    console.error('[doc] blob fetch failed', e);
    throw new Error(
      `Couldn't read the selected file: ${e instanceof Error ? e.message : 'unknown'}`,
    );
  }

  const effectiveMime = mimeType || blob.type || 'application/octet-stream';
  const extension = extensionFor(effectiveMime, fileName);
  const docId = generateId();
  const path = `users/${ownerId}/vehicles/${vehicleId}/documents/${docId}.${extension}`;

  const objectRef = storageRef(storage, path);
  console.log('[doc] starting upload to', path);
  const task = uploadBytesResumable(objectRef, blob, {
    contentType: effectiveMime,
    customMetadata: {
      originalName: fileName,
    },
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        console.log(
          '[doc] progress',
          snapshot.bytesTransferred,
          '/',
          snapshot.totalBytes,
        );
        onProgress?.(snapshot.bytesTransferred, snapshot.totalBytes);
      },
      (error) => {
        console.error('[doc] storage upload failed', error.code, error.message, error);
        reject(
          new Error(
            `Storage upload failed (${error.code || 'unknown'}): ${error.message}`,
          ),
        );
      },
      () => {
        console.log('[doc] upload complete');
        resolve();
      },
    );
  });

  const downloadUrl = await getDownloadURL(objectRef);
  console.log('[doc] got download URL');

  let savedId: string;
  try {
    const docRef = await addDoc(collection(db, DOCUMENTS), {
      vehicleId,
      ownerId,
      title: title.trim() || fileName,
      kind,
      description: description?.trim() || undefined,
      storagePath: path,
      downloadUrl,
      mimeType: effectiveMime,
      fileSize: fileSize ?? blob.size,
      documentDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    savedId = docRef.id;
    console.log('[doc] document metadata saved', savedId);
  } catch (e) {
    console.error('[doc] addDoc failed', e);
    throw new Error(
      `Saved the file but couldn't write metadata: ${
        e instanceof Error ? e.message : 'unknown'
      }`,
    );
  }

  return {
    id: savedId,
    vehicleId,
    ownerId,
    title: title.trim() || fileName,
    kind,
    description: description?.trim() || undefined,
    storagePath: path,
    downloadUrl,
    mimeType: effectiveMime,
    fileSize: fileSize ?? blob.size,
  } as VehicleDocument;
}

export function watchDocumentsForVehicle(
  vehicleId: string,
  onNext: (items: VehicleDocument[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, DOCUMENTS),
    where('vehicleId', '==', vehicleId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as VehicleDocument,
      );
      onNext(items);
    },
    (err) => onError(err),
  );
}

export async function updateVehicleDocument(
  id: string,
  patch: Partial<
    Pick<VehicleDocument, 'title' | 'kind' | 'description'> & {
      documentDate?: Date | Timestamp | null;
    }
  >,
): Promise<void> {
  await updateDoc(doc(db, DOCUMENTS, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteVehicleDocument(
  document: Pick<VehicleDocument, 'id' | 'storagePath'>,
): Promise<void> {
  try {
    await deleteObject(storageRef(storage, document.storagePath));
  } catch (e) {
    console.warn('[doc] storage object delete failed:', e);
  }
  await deleteDoc(doc(db, DOCUMENTS, document.id));
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extensionFor(mimeType: string, fileName: string): string {
  const fromName = fileName.includes('.')
    ? fileName.split('.').pop()?.toLowerCase()
    : undefined;
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;

  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/gif': 'gif',
    'image/tiff': 'tiff',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
    'text/csv': 'csv',
  };
  return map[mimeType] ?? 'bin';
}
