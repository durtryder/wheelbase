import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { FeedReaction, ReactionKind } from '@/types/feed-reaction';

const COLL = 'feedReactions';

function makeDocId(userId: string, feedItemId: string): string {
  return `${userId}_${feedItemId}`;
}

/**
 * Subscribe to every feed reaction the user has authored. Returns a
 * Map keyed by feedItemId so card components can look up their own
 * record in O(1). Returns unsub.
 */
export function watchUserFeedReactions(
  userId: string,
  onNext: (map: Map<string, FeedReaction>) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLL), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const map = new Map<string, FeedReaction>();
      snap.forEach((d) => {
        const data = d.data() as Omit<FeedReaction, 'id'>;
        map.set(data.feedItemId, { id: d.id, ...data });
      });
      onNext(map);
    },
    (err) => onError(err),
  );
}

/**
 * Persist a thumbs-up or thumbs-down. Passing `null` for `reaction`
 * clears any existing reaction via FieldValue.delete() (which is the
 * only way to remove a single field on merge:true).
 *
 * Other state on the doc (savedNotebookEntryId) is preserved.
 */
export async function setFeedReaction(args: {
  userId: string;
  feedItemId: string;
  feedItemKind: 'article' | 'bat_listing';
  reaction: ReactionKind | null;
}): Promise<void> {
  const { userId, feedItemId, feedItemKind, reaction } = args;
  const id = makeDocId(userId, feedItemId);
  await setDoc(
    doc(db, COLL, id),
    {
      userId,
      feedItemId,
      feedItemKind,
      reaction: reaction === null ? deleteField() : reaction,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Mark a feed item as saved to the Notebook, pointing at the new
 * entry doc. Idempotent on the (userId, feedItemId) pair — overwrites
 * the prior pointer if the user saves the same item twice.
 */
export async function markFeedItemSaved(args: {
  userId: string;
  feedItemId: string;
  feedItemKind: 'article' | 'bat_listing';
  savedNotebookEntryId: string;
}): Promise<void> {
  const { userId, feedItemId, feedItemKind, savedNotebookEntryId } = args;
  const id = makeDocId(userId, feedItemId);
  await setDoc(
    doc(db, COLL, id),
    {
      userId,
      feedItemId,
      feedItemKind,
      savedNotebookEntryId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Clear the saved pointer (e.g., if the user removed the notebook entry). */
export async function clearFeedItemSaved(args: {
  userId: string;
  feedItemId: string;
  feedItemKind: 'article' | 'bat_listing';
}): Promise<void> {
  const { userId, feedItemId, feedItemKind } = args;
  const id = makeDocId(userId, feedItemId);
  await setDoc(
    doc(db, COLL, id),
    {
      userId,
      feedItemId,
      feedItemKind,
      savedNotebookEntryId: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
