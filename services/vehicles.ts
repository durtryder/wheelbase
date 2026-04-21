import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
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
