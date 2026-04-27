import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { UserProfile } from '@/types/user';

const USERS = 'users';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UserProfile, 'uid'>) };
}

export function watchUserProfile(
  uid: string,
  onNext: (profile: UserProfile | null) => void,
  onError: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, USERS, uid),
    (snap) =>
      onNext(snap.exists() ? { uid, ...(snap.data() as Omit<UserProfile, 'uid'>) } : null),
    (err) => onError(err),
  );
}

/**
 * Save (or clear) the user's Instagram handle. Pass `null` to clear — we
 * write `null` rather than relying on `ignoreUndefinedProperties` so the
 * field is explicitly cleared on the server.
 */
export async function setUserInstagramHandle(
  uid: string,
  handle: string | null,
): Promise<void> {
  await setDoc(
    doc(db, USERS, uid),
    {
      instagramHandle: handle,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
