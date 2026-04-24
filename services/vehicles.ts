import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Vehicle } from '@/types/vehicle';

const VEHICLES = 'vehicles';

export async function listVehiclesForOwner(ownerId: string): Promise<Vehicle[]> {
  const q = query(
    collection(db, VEHICLES),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehicle);
}

/**
 * Subscribe to live updates of a specific owner's public vehicles (for the
 * /u/<uid> profile page). Unlisted vehicles are intentionally excluded — the
 * profile shows the "public catalog" of a builder's work.
 */
export function watchPublicVehiclesByOwner(
  ownerId: string,
  onNext: (vehicles: Vehicle[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, VEHICLES),
    where('ownerId', '==', ownerId),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const vehicles = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehicle);
      onNext(vehicles);
    },
    (err) => onError(err),
  );
}

/**
 * Subscribe to live updates of every public vehicle (for the Feed page).
 * Ordered newest-first. Returns an unsubscribe fn.
 */
export function watchPublicVehicles(
  onNext: (vehicles: Vehicle[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, VEHICLES),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const vehicles = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehicle);
      onNext(vehicles);
    },
    (err) => onError(err),
  );
}

/**
 * Subscribe to live updates of the owner's vehicles. Returns an unsubscribe
 * fn suitable for React useEffect cleanup.
 */
export function watchVehiclesForOwner(
  ownerId: string,
  onNext: (vehicles: Vehicle[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, VEHICLES),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const vehicles = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehicle);
      onNext(vehicles);
    },
    (err) => onError(err),
  );
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const ref = doc(db, VEHICLES, id);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Vehicle) : null;
}

export async function createVehicle(
  input: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const ref = await addDoc(collection(db, VEHICLES), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVehicle(id: string, patch: Partial<Vehicle>) {
  await updateDoc(doc(db, VEHICLES, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteVehicle(id: string) {
  await deleteDoc(doc(db, VEHICLES, id));
}

/**
 * Persist a new display order for a list of vehicles. Writes `displayOrder`
 * as 0..N-1 in a single batched update so the garage either sees the full
 * new order or the old one — never a half-applied state. Caller is
 * responsible for passing ids in the desired visual order (first → top).
 */
export async function reorderVehicles(orderedIds: string[]) {
  if (orderedIds.length === 0) return;
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, VEHICLES, id), {
      displayOrder: index,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
