import exifr from 'exifr';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
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
import type { NotebookEntry, NotebookLink, NotebookPhoto } from '@/types/notebook';

const ENTRIES = 'notebookEntries';

/** Subscribe to live updates of the owner's notebook. Returns unsub. */
export function watchNotebookEntries(
  ownerId: string,
  onNext: (entries: NotebookEntry[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, ENTRIES),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NotebookEntry);
      onNext(entries);
    },
    (err) => onError(err),
  );
}

export async function getNotebookEntry(id: string): Promise<NotebookEntry | null> {
  const ref = doc(db, ENTRIES, id);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as NotebookEntry) : null;
}

export async function createNotebookEntry(
  input: Omit<NotebookEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, ENTRIES), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNotebookEntry(
  id: string,
  patch: Partial<Omit<NotebookEntry, 'id' | 'createdAt' | 'ownerId'>>,
): Promise<void> {
  await updateDoc(doc(db, ENTRIES, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an entry and best-effort clean up its uploaded photos from
 * Storage. Storage failures are logged but don't block the doc delete —
 * the source of truth is the Firestore record, and orphaned objects can
 * be reconciled later if it ever matters.
 */
export async function deleteNotebookEntry(entry: NotebookEntry): Promise<void> {
  const cleanupTasks = (entry.photos ?? []).map(async (p) => {
    try {
      await deleteObject(storageRef(storage, p.storagePath));
    } catch (e) {
      console.warn('[notebook] photo cleanup failed', p.storagePath, e);
    }
  });
  await Promise.allSettled(cleanupTasks);
  await deleteDoc(doc(db, ENTRIES, entry.id));
}

/**
 * Upload a single photo to a flat per-user folder in Storage and return
 * the populated NotebookPhoto record. The caller is responsible for
 * splicing the result into the entry's `photos` array (either at create
 * time or via updateNotebookEntry).
 *
 * Path layout:
 *   users/{ownerId}/notebook/{photoId}.{ext}
 */
export async function uploadNotebookPhoto(params: {
  ownerId: string;
  uri: string;
  width?: number;
  height?: number;
  caption?: string;
  onProgress?: (uploaded: number, total: number) => void;
}): Promise<NotebookPhoto> {
  const { ownerId, uri, width, height, caption, onProgress } = params;

  let blob: Blob;
  try {
    const response = await fetch(uri);
    blob = await response.blob();
  } catch (e) {
    throw new Error(
      `Couldn't read the selected file: ${e instanceof Error ? e.message : 'unknown'}`,
    );
  }

  // Pull EXIF capture date when available so the photo's metadata is
  // useful even before the AI agent looks at it.
  let takenAt: Date | undefined;
  try {
    const raw = await exifr.parse(blob, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
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
    }
  } catch {
    /* non-fatal */
  }

  const mimeType = blob.type || 'image/jpeg';
  const extension = extensionFor(mimeType);
  const photoId = generateId();
  const path = `users/${ownerId}/notebook/${photoId}.${extension}`;

  const objectRef = storageRef(storage, path);
  const task = uploadBytesResumable(objectRef, blob, { contentType: mimeType });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => onProgress?.(snapshot.bytesTransferred, snapshot.totalBytes),
      (error) =>
        reject(
          new Error(
            `Storage upload failed (${error.code || 'unknown'}): ${error.message}`,
          ),
        ),
      () => resolve(),
    );
  });

  const downloadUrl = await getDownloadURL(objectRef);

  return {
    id: photoId,
    storagePath: path,
    downloadUrl,
    width,
    height,
    caption: caption?.trim() || undefined,
    takenAt: takenAt ? Timestamp.fromDate(takenAt) : undefined,
  };
}

/**
 * Remove a single photo from an entry — deletes the Storage object and
 * patches the entry's `photos` array.
 */
export async function removePhotoFromEntry(
  entry: NotebookEntry,
  photoId: string,
): Promise<NotebookPhoto[]> {
  const target = entry.photos.find((p) => p.id === photoId);
  if (!target) return entry.photos;
  try {
    await deleteObject(storageRef(storage, target.storagePath));
  } catch (e) {
    console.warn('[notebook] photo cleanup failed', target.storagePath, e);
  }
  const next = entry.photos.filter((p) => p.id !== photoId);
  await updateNotebookEntry(entry.id, { photos: next });
  return next;
}

/**
 * Spawn a new Notebook entry from a Feed item — used by the "+ save"
 * action on news / BaT cards. Builds a single-link entry seeded with
 * the source's title, host display, and hero image so the entry's
 * list card looks rich immediately without a metadata round-trip.
 */
export async function saveFeedItemToNotebook(args: {
  ownerId: string;
  title: string;
  url: string;
  siteName?: string;
  thumbnailUrl?: string;
}): Promise<string> {
  const { ownerId, title, url, siteName, thumbnailUrl } = args;
  const link: NotebookLink = {
    id: generateId(),
    url,
    title: title.trim() || undefined,
    siteName: siteName?.trim() || undefined,
    thumbnailUrl: thumbnailUrl?.trim() || undefined,
    addedAt: Timestamp.now(),
  };
  return createNotebookEntry({
    ownerId,
    title: title.trim() || undefined,
    photos: [],
    links: [link],
  });
}

// ---------- internals ----------

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extensionFor(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  // Fall back to a generic .img — Storage doesn't care about extensions
  // for serving, but it's nicer if a user downloads the file later.
  return 'img';
}
