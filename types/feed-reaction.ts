import type { Timestamp } from 'firebase/firestore';

export type ReactionKind = 'like' | 'dislike';

/**
 * Per-(user, feed item) record that tracks how the user reacted to an
 * item in their Feed. Holds three pieces of state — the thumb-up/down
 * reaction, whether they saved it to their Notebook, and an
 * updated-at timestamp — in a single doc so we only read one
 * collection at feed-render time.
 *
 * Doc ID is `<userId>_<feedItemId>` for fast lookup without a query.
 */
export type FeedReaction = {
  id: string;
  userId: string;
  feedItemId: string;
  /** Discriminator — limited to surfaces that show actions (we don't
   *  render the bar on the user's own garage media). */
  feedItemKind: 'article' | 'bat_listing';
  reaction?: ReactionKind;
  /** When the user has saved this item to their Notebook, the
   *  resulting NotebookEntry id. Undefined when not saved (or after
   *  the entry was later deleted — we don't reconcile that). */
  savedNotebookEntryId?: string;
  updatedAt: Timestamp;
};
