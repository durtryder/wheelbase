import type { Timestamp } from 'firebase/firestore';

/**
 * UserProfile — per-user data that doesn't fit on Firebase Auth's user
 * object. Lives at /users/{uid}. Display name still comes from Auth; this
 * doc holds everything else (social links to start, bio later).
 */
export type UserProfile = {
  uid: string;
  /** Personal Instagram handle, normalized (no "@", no URL, no trailing slash). */
  instagramHandle?: string;
  updatedAt?: Timestamp;
};
