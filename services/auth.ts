import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(user, { displayName });
  }
  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Send a password reset email via Firebase. The email contains a link to a
 * Firebase-hosted page where the user sets a new password; after that they
 * can sign in normally.
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Update the currently signed-in user's display name on their Firebase Auth
 * profile. Does NOT rewrite the denormalized `ownerDisplayName` on already-
 * saved vehicles — those refresh opportunistically the next time the owner
 * edits them (or views them, via the auto-backfill in the detail page).
 */
export async function updateDisplayName(name: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Not signed in.');
  await updateProfile(auth.currentUser, { displayName: name.trim() || null });
  // updateProfile mutates currentUser in place, but some hooks (e.g. our
  // useAuth) key off object identity. Force a re-read so listeners see it.
  await auth.currentUser.reload();
}

/**
 * Translate Firebase's auth error codes into something a user can act on.
 */
export function humanizeAuthError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = String((e as { code: unknown }).code);
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/invalid-email':
        return 'That email address looks invalid.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Incorrect email or password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled. In Firebase Console → Authentication → Sign-in method, enable Email/Password.';
      case 'auth/configuration-not-found':
        return 'Firebase Authentication is not initialized for this project. In Firebase Console → Build → Authentication, click "Get started", then enable Email/Password under Sign-in method.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      default:
        return e instanceof Error ? e.message : `Sign-in failed (${code}).`;
    }
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}
