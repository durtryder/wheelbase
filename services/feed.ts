import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type {
  BaTListing,
  FeedItem,
  GarageMediaFeedItem,
  NewsArticle,
  ScoredFeedItem,
} from '@/types/feed';
import type { Vehicle } from '@/types/vehicle';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function cutoffTimestamp(): Timestamp {
  return Timestamp.fromMillis(Date.now() - NINETY_DAYS_MS);
}

/**
 * Score a feed item against the user's garage.
 *  1.0 — make+model match
 *  0.5 — make-only match
 *  0   — no match (or empty garage)
 * Garage media is always 1.0 — own builds always belong at the top.
 */
function scoreItem(
  item: FeedItem,
  garageMakes: string[],
  garageTokens: string[],
): number {
  if (item.kind === 'garage_media') return 1.0;

  const searchText =
    item.kind === 'article'
      ? item.tags.join(' ')
      : `${item.make ?? ''} ${item.model ?? ''}`;

  const lower = searchText.toLowerCase();

  if (garageTokens.some((t) => t && lower.includes(t))) return 1.0;
  if (garageMakes.some((m) => m && lower.includes(m))) return 0.5;
  return 0;
}

/**
 * Subscribe to a live mixed feed for a given user. Merges:
 *   • news articles (last 90 days)
 *   • Bring a Trailer listings (last 90 days)
 *   • the user's own garage media (last 90 days)
 *
 * Items are scored by garage relevance and sorted relevance-then-recency.
 * Returns an unsubscribe function suitable for useEffect cleanup.
 */
export function watchFeedForUser(
  userId: string,
  userVehicles: Vehicle[],
  onNext: (items: ScoredFeedItem[]) => void,
  onError: (err: Error) => void,
): () => void {
  const garageMakes = [
    ...new Set(userVehicles.map((v) => v.make.toLowerCase().trim()).filter(Boolean)),
  ];
  const garageTokens = [
    ...new Set(
      userVehicles
        .map((v) => `${v.make} ${v.model}`.toLowerCase().trim())
        .filter(Boolean),
    ),
  ];

  const cutoff = cutoffTimestamp();
  let articles: NewsArticle[] = [];
  let listings: BaTListing[] = [];
  let mediaItems: GarageMediaFeedItem[] = [];

  function emit() {
    const all: FeedItem[] = [...articles, ...listings, ...mediaItems];

    const scored: ScoredFeedItem[] = all.map((item) => ({
      item,
      relevanceScore: scoreItem(item, garageMakes, garageTokens),
    }));

    scored.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      // Defensive: the Firestore queries already filter to docs that have a
      // publishedAt Timestamp, but a malformed doc (manual insert, partial
      // sync) shouldn't blow up the whole sort. Treat missing dates as epoch.
      const aMs = a.item.publishedAt?.toMillis?.() ?? 0;
      const bMs = b.item.publishedAt?.toMillis?.() ?? 0;
      return bMs - aMs;
    });

    onNext(scored);
  }

  const articlesUnsub = onSnapshot(
    query(
      collection(db, 'feed_articles'),
      where('publishedAt', '>=', cutoff),
      orderBy('publishedAt', 'desc'),
      limit(100),
    ),
    (snap) => {
      articles = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as NewsArticle,
      );
      emit();
    },
    onError,
  );

  const batUnsub = onSnapshot(
    query(
      collection(db, 'bat_listings'),
      where('publishedAt', '>=', cutoff),
      orderBy('publishedAt', 'desc'),
      limit(50),
    ),
    (snap) => {
      listings = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as BaTListing,
      );
      emit();
    },
    onError,
  );

  const mediaUnsub = onSnapshot(
    query(
      collection(db, 'media'),
      where('ownerId', '==', userId),
      where('createdAt', '>=', cutoff),
      orderBy('createdAt', 'desc'),
      limit(30),
    ),
    (snap) => {
      mediaItems = snap.docs
        .map((d) => {
          const data = d.data();
          // Skip media that hasn't finished uploading or is otherwise
          // missing its public URL — rendering an empty-hero card is uglier
          // than just dropping it, and the snapshot will fire again once
          // the download URL is written.
          if (!data.downloadUrl) return null;
          const vehicle = userVehicles.find((v) => v.id === data.vehicleId);
          const vehicleName = vehicle
            ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
            : 'Your garage';
          return {
            kind: 'garage_media',
            id: d.id,
            vehicleId: data.vehicleId,
            vehicleName,
            ownerId: data.ownerId,
            ownerDisplayName: data.ownerDisplayName,
            imageUrl: data.downloadUrl,
            caption: data.caption,
            publishedAt: data.createdAt,
          } as GarageMediaFeedItem;
        })
        .filter((m): m is GarageMediaFeedItem => m !== null);
      emit();
    },
    onError,
  );

  return () => {
    articlesUnsub();
    batUnsub();
    mediaUnsub();
  };
}
