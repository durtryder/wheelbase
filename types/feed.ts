import type { Timestamp } from 'firebase/firestore';

export type NewsSource = 'jalopnik' | 'caranddriver' | '000magazine';

export const NEWS_SOURCE_LABELS: Record<NewsSource, string> = {
  jalopnik: 'Jalopnik',
  caranddriver: 'Car & Driver',
  '000magazine': '000 Magazine',
};

export type NewsArticle = {
  kind: 'article';
  id: string;
  source: NewsSource;
  title: string;
  url: string;
  excerpt?: string;
  imageUrl?: string;
  author?: string;
  publishedAt: Timestamp;
  /** Lowercase make/model tokens extracted from title+excerpt for relevance matching. */
  tags: string[];
  fetchedAt: Timestamp;
};

export type BaTListing = {
  kind: 'bat_listing';
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  make?: string;
  model?: string;
  year?: number;
  publishedAt: Timestamp;
  fetchedAt: Timestamp;
};

export type GarageMediaFeedItem = {
  kind: 'garage_media';
  id: string;
  vehicleId: string;
  /** "{year} {make} {model}" formed at read time. */
  vehicleName: string;
  ownerId: string;
  ownerDisplayName?: string;
  imageUrl: string;
  caption?: string;
  publishedAt: Timestamp;
};

/** Discriminated union of every content type we surface in the feed. */
export type FeedItem = NewsArticle | BaTListing | GarageMediaFeedItem;

/** A FeedItem paired with its garage-relevance score (0–1). */
export type ScoredFeedItem = {
  item: FeedItem;
  /** 1.0 = make+model match, 0.5 = make-only, 0 = no match. */
  relevanceScore: number;
};
