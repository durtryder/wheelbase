import type { Timestamp } from 'firebase/firestore';

/**
 * NotebookEntry — a private research note in the owner's notebook.
 *
 * One entry can hold a body of text, a set of photos, or both —
 * whatever the owner is capturing. The shape stays simple intentionally:
 * Phase 1 is plain CRUD with cross-linking to a vehicle in the user's
 * garage. Phase 2 will populate `research` via a Cloud Function that
 * runs Claude with web search; Phase 3 will use `folderId` for
 * organization. Both fields ship as part of the schema now so future
 * work doesn't require a migration.
 */
export type NotebookEntry = {
  id: string;
  ownerId: string;

  /** Optional short title. Falls back to the first line of body or a
   *  default like "Untitled note" when displayed. */
  title?: string;
  /** Free-text body. Markdown not parsed yet — rendered as plain text. */
  body?: string;
  /** Inline photo array (each photo gets its own id within the entry). */
  photos: NotebookPhoto[];

  /** Optional cross-link to a vehicle in the owner's garage. Powers the
   *  "research this caliper for my 996 911" use case for the eventual
   *  AI agent — context multiplier. */
  vehicleId?: string;

  /** Reserved for Phase 3 folders. Empty / undefined = top level. */
  folderId?: string;
  /** Owner-supplied or AI-extracted topical labels. */
  tags?: string[];

  /** Result of the most recent AI research pass. Populated by the
   *  Cloud Function in Phase 2; undefined until first run. */
  research?: ResearchRecord;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type NotebookPhoto = {
  /** Unique within the parent entry — used for stable React keys and
   *  storage cleanup when removed. */
  id: string;
  storagePath: string;
  downloadUrl: string;
  width?: number;
  height?: number;
  /** Optional caption shown beneath the photo in the entry view. */
  caption?: string;
  /** Capture date pulled from EXIF when available. */
  takenAt?: Timestamp;
};

export type ResearchStatus = 'pending' | 'running' | 'complete' | 'error';

export type ResearchSource = {
  title?: string;
  url: string;
};

export type ResearchRecord = {
  status: ResearchStatus;
  /** When this research record was last written. */
  fetchedAt?: Timestamp;
  /** Markdown / plain text summary from Claude. */
  summary?: string;
  /** Web sources Claude cited for the summary. */
  sources?: ResearchSource[];
  /** Error message when status === 'error'. */
  errorMessage?: string;
};
