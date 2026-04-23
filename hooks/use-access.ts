import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Shared-password preview gate. Behavior:
 *
 *   - If EXPO_PUBLIC_ACCESS_PASSWORD is not set, the gate is bypassed and the
 *     app renders normally (useful for dev and for post-preview production).
 *   - Otherwise, we check AsyncStorage on mount. If the user has previously
 *     unlocked, they're still in.
 *   - `unlock(password)` compares plain-text (this is a soft gate; anyone with
 *     the source can find the password — don't treat it as real security).
 *
 * This is intentionally above Firebase Auth: the gate is for letting
 * non-technical collaborators see the preview. They can still sign in / save
 * vehicles once past the gate.
 */

const STORAGE_KEY = 'wheelbase:access-ok';
const EXPECTED_PASSWORD = process.env.EXPO_PUBLIC_ACCESS_PASSWORD;

export type AccessState = 'checking' | 'required' | 'granted';

export function useAccess() {
  const [state, setState] = useState<AccessState>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!EXPECTED_PASSWORD) {
      // No gate configured — treat as granted.
      setState('granted');
      return;
    }
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        setState(v === 'true' ? 'granted' : 'required');
      })
      .catch(() => setState('required'));
  }, []);

  async function unlock(password: string): Promise<boolean> {
    setError(null);
    if (!EXPECTED_PASSWORD) {
      // Safety net; shouldn't really hit this path since state=granted already.
      setState('granted');
      return true;
    }
    if (password.trim() === EXPECTED_PASSWORD) {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        /* ignore — still grant this session */
      }
      setState('granted');
      return true;
    }
    setError("That access code isn't right.");
    return false;
  }

  async function lock() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState(EXPECTED_PASSWORD ? 'required' : 'granted');
  }

  return { state, error, unlock, lock };
}
