# Wheelbase — Dynamic Feed Feature Plan

## Goal

Replace the current "Community Builds" feed (public vehicles only) with a rich,
live mixed feed showing:

1. **News articles** matched to the user's garage — Jalopnik, Car & Driver, 000 Magazine
2. **Bring a Trailer listings** for vehicles matching the user's garage makes/models
3. **Garage media** — recent photos/videos from the user's own vehicles and followed users *(social graph not built yet — show own garage media for now)*

All web-sourced content filtered to last **90 days**. Feed feels live via Firestore
`onSnapshot` — when the Cloud Function fires and writes new articles, open clients
update without a manual refresh.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Firebase Cloud Functions (scheduled)           │
│                                                 │
│  syncNewsFeeds()   — every 60 min               │
│    → fetches RSS: Jalopnik, Car&Driver, 000mag  │
│    → parses XML, extracts tags (make/model)     │
│    → writes to /feed_articles/{id}              │
│    → deletes docs older than 90 days            │
│                                                 │
│  syncBaTListings() — every 60 min               │
│    → fetches BaT RSS feed                       │
│    → parses title for year/make/model           │
│    → writes to /bat_listings/{id}               │
│    → deletes docs older than 90 days            │
└─────────────────────────────────────────────────┘
                        │ Firestore onSnapshot
┌─────────────────────────────────────────────────┐
│  Wheelbase App                                  │
│                                                 │
│  services/feed.ts                               │
│    → watchFeedForUser(userId)                   │
│      • reads user's vehicle makes/models        │
│      • subscribes to /feed_articles (90d)       │
│      • subscribes to /bat_listings (90d)        │
│      • subscribes to /media (own garage, 90d)   │
│      • scores articles by garage relevance      │
│      • merges + sorts into FeedItem[]           │
│                                                 │
│  app/(tabs)/feed.tsx                            │
│    → renders mixed FeedItem list                │
│    → NewsCard | BaTCard | MediaCard components  │
└─────────────────────────────────────────────────┘
```

---

## RSS Feed URLs

| Source | RSS URL | Notes |
|---|---|---|
| Jalopnik | `https://jalopnik.com/rss` | Full feed, ~20 items |
| Car & Driver | `https://www.caranddriver.com/rss/all.xml` | Full feed |
| 000 Magazine | `https://000magazine.com/feed` | WordPress default RSS |
| Bring a Trailer | `https://bringatrailer.com/feed/` | Recent listings RSS |

BaT make-specific feeds (use these in addition to the main feed to improve make matching):
`https://bringatrailer.com/{make-slug}/feed/`
e.g. `https://bringatrailer.com/porsche/feed/`

For v1, fetch the main BaT feed only. Add make-specific feeds later once we
know which makes are most common in user garages.

---

## New Files to Create

### 1. `types/feed.ts`

```typescript
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
  /** Lowercase make/model tokens extracted from title+excerpt for relevance matching */
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
  vehicleName: string; // "{year} {make} {model}"
  ownerId: string;
  ownerDisplayName?: string;
  imageUrl: string;
  caption?: string;
  publishedAt: Timestamp;
};

/** Discriminated union of all feed content types */
export type FeedItem = NewsArticle | BaTListing | GarageMediaFeedItem;

/** Relevance score 0–1: how closely a feed item matches the user's garage */
export type ScoredFeedItem = {
  item: FeedItem;
  /** 1.0 = direct make+model match, 0.5 = make-only match, 0 = no match */
  relevanceScore: number;
};
```

---

### 2. `functions/` directory — Cloud Functions

#### Setup
```bash
cd wheelbase-app
firebase init functions
# choose TypeScript, ESLint yes, install deps yes
```

#### `functions/src/index.ts`

```typescript
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { XMLParser } from 'fast-xml-parser';
import fetch from 'node-fetch';

admin.initializeApp();
const db = admin.firestore();
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// --- Automotive make/model keyword list for tag extraction ---
const AUTO_MAKES = [
  'porsche', 'ferrari', 'lamborghini', 'mclaren', 'aston martin',
  'bentley', 'rolls-royce', 'bugatti', 'pagani', 'koenigsegg',
  'mercedes', 'bmw', 'audi', 'volkswagen', 'toyota', 'honda',
  'ford', 'chevrolet', 'dodge', 'jeep', 'cadillac', 'lincoln',
  'alfa romeo', 'maserati', 'jaguar', 'land rover', 'lotus',
  'mazda', 'subaru', 'mitsubishi', 'nissan', 'lexus', 'infiniti',
  'acura', 'volvo', 'saab', 'mini', 'fiat', 'lancia',
  'de tomaso', 'shelby', 'ac cobra', 'jensen', 'triumph', 'mg',
  'austin-healey', 'sunbeam', 'talbot', 'iso', 'bizzarrini',
];

function extractTags(text: string): string[] {
  const lower = text.toLowerCase();
  return AUTO_MAKES.filter((make) => lower.includes(make));
}

function olderThan90Days(pubDate: string): boolean {
  const date = new Date(pubDate);
  return Date.now() - date.getTime() > NINETY_DAYS_MS;
}

async function fetchRss(url: string): Promise<any[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Wheelbase/1.0 (+https://wheelbase.se)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${url}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  return parsed?.rss?.channel?.item ?? [];
}

// --- News feed sync ---
export const syncNewsFeeds = onSchedule('every 60 minutes', async () => {
  const sources: Array<{ id: string; url: string }> = [
    { id: 'jalopnik', url: 'https://jalopnik.com/rss' },
    { id: 'caranddriver', url: 'https://www.caranddriver.com/rss/all.xml' },
    { id: '000magazine', url: 'https://000magazine.com/feed' },
  ];

  for (const source of sources) {
    try {
      const items = await fetchRss(source.url);
      const batch = db.batch();

      for (const item of items) {
        const pubDate = item.pubDate ?? item['dc:date'] ?? '';
        if (olderThan90Days(pubDate)) continue;

        const url: string = item.link ?? item.guid?.['#text'] ?? item.guid ?? '';
        if (!url) continue;

        // Stable ID: hash of the URL
        const id = `${source.id}_${Buffer.from(url).toString('base64url').slice(0, 40)}`;

        const title: string = item.title ?? '';
        const excerpt: string = item.description?.replace(/<[^>]*>/g, '').slice(0, 300) ?? '';
        const imageUrl: string =
          item['media:content']?.['@_url'] ??
          item.enclosure?.['@_url'] ??
          item['media:thumbnail']?.['@_url'] ??
          '';

        const doc = {
          kind: 'article',
          source: source.id,
          title,
          url,
          excerpt,
          imageUrl,
          author: item['dc:creator'] ?? item.author ?? '',
          publishedAt: admin.firestore.Timestamp.fromDate(new Date(pubDate)),
          tags: extractTags(`${title} ${excerpt}`),
          fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        batch.set(db.collection('feed_articles').doc(id), doc, { merge: true });
      }

      await batch.commit();
    } catch (err) {
      console.error(`[syncNewsFeeds] Error for ${source.id}:`, err);
    }
  }

  // Prune articles older than 90 days
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - NINETY_DAYS_MS);
  const old = await db.collection('feed_articles')
    .where('publishedAt', '<', cutoff)
    .get();
  const pruneBatch = db.batch();
  old.docs.forEach((d) => pruneBatch.delete(d.ref));
  await pruneBatch.commit();
});

// --- BaT listing sync ---
export const syncBaTListings = onSchedule('every 60 minutes', async () => {
  try {
    const items = await fetchRss('https://bringatrailer.com/feed/');
    const batch = db.batch();

    for (const item of items) {
      const pubDate = item.pubDate ?? '';
      if (olderThan90Days(pubDate)) continue;

      const url: string = item.link ?? '';
      if (!url) continue;

      const id = `bat_${Buffer.from(url).toString('base64url').slice(0, 40)}`;
      const title: string = item.title ?? '';

      // BaT titles follow the pattern: "YEAR Make Model [Description]"
      // e.g. "1972 Porsche 911 S Targa"
      const titleMatch = title.match(/^(\d{4})\s+([A-Za-z\-]+)\s+([A-Za-z0-9\s\-]+?)(?:\s*–|\s*\[|$)/);
      const year = titleMatch ? parseInt(titleMatch[1]) : undefined;
      const make = titleMatch ? titleMatch[2] : undefined;
      const model = titleMatch ? titleMatch[3].trim() : undefined;

      const imageUrl: string =
        item['media:content']?.['@_url'] ??
        item.enclosure?.['@_url'] ??
        '';

      const doc = {
        kind: 'bat_listing',
        title,
        url,
        imageUrl,
        make: make?.toLowerCase(),
        model: model?.toLowerCase(),
        year,
        publishedAt: admin.firestore.Timestamp.fromDate(new Date(pubDate)),
        fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      batch.set(db.collection('bat_listings').doc(id), doc, { merge: true });
    }

    await batch.commit();
  } catch (err) {
    console.error('[syncBaTListings] Error:', err);
  }

  // Prune
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - NINETY_DAYS_MS);
  const old = await db.collection('bat_listings')
    .where('publishedAt', '<', cutoff)
    .get();
  const pruneBatch = db.batch();
  old.docs.forEach((d) => pruneBatch.delete(d.ref));
  await pruneBatch.commit();
});
```

#### `functions/package.json` additions needed:
```json
{
  "dependencies": {
    "fast-xml-parser": "^4.3.6",
    "node-fetch": "^3.3.2"
  }
}
```

---

### 3. `services/feed.ts`

```typescript
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
import type { BaTListing, FeedItem, GarageMediaFeedItem, NewsArticle, ScoredFeedItem } from '@/types/feed';
import type { Vehicle } from '@/types/vehicle';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function cutoffTimestamp(): Timestamp {
  return Timestamp.fromMillis(Date.now() - NINETY_DAYS_MS);
}

/**
 * Score a feed item against the user's garage vehicles.
 * Returns 0–1: 1.0 = make+model match, 0.5 = make-only, 0 = no match.
 */
function scoreItem(item: FeedItem, garageMakes: string[], garageTokens: string[]): number {
  if (item.kind === 'garage_media') return 1.0;

  const searchText =
    item.kind === 'article'
      ? item.tags.join(' ')
      : `${item.make ?? ''} ${item.model ?? ''}`;

  const lower = searchText.toLowerCase();

  // Check full make+model token match first
  if (garageTokens.some((t) => lower.includes(t))) return 1.0;
  // Check make-only match
  if (garageMakes.some((m) => lower.includes(m))) return 0.5;
  return 0;
}

/**
 * Subscribe to a live mixed feed for the given user.
 * Merges news articles, BaT listings, and own garage media,
 * scored and sorted by relevance + recency.
 *
 * Returns an unsubscribe function.
 */
export function watchFeedForUser(
  userId: string,
  userVehicles: Vehicle[],
  onNext: (items: ScoredFeedItem[]) => void,
  onError: (err: Error) => void,
): () => void {
  // Build relevance token sets from the user's garage
  const garageMakes = [...new Set(
    userVehicles.map((v) => v.make.toLowerCase()),
  )];
  const garageTokens = [...new Set(
    userVehicles.map((v) => `${v.make} ${v.model}`.toLowerCase()),
  )];

  const cutoff = cutoffTimestamp();
  let articles: NewsArticle[] = [];
  let listings: BaTListing[] = [];
  let mediaItems: GarageMediaFeedItem[] = [];

  function emit() {
    const all: FeedItem[] = [
      ...articles,
      ...listings,
      ...mediaItems,
    ];

    const scored: ScoredFeedItem[] = all.map((item) => ({
      item,
      relevanceScore: scoreItem(item, garageMakes, garageTokens),
    }));

    // Sort: own garage media first, then by relevance desc, then recency desc
    scored.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      const aTime = a.item.publishedAt.toMillis();
      const bTime = b.item.publishedAt.toMillis();
      return bTime - aTime;
    });

    onNext(scored);
  }

  // Subscribe to news articles
  const articlesUnsub = onSnapshot(
    query(
      collection(db, 'feed_articles'),
      where('publishedAt', '>=', cutoff),
      orderBy('publishedAt', 'desc'),
      limit(100),
    ),
    (snap) => {
      articles = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsArticle);
      emit();
    },
    onError,
  );

  // Subscribe to BaT listings
  const batUnsub = onSnapshot(
    query(
      collection(db, 'bat_listings'),
      where('publishedAt', '>=', cutoff),
      orderBy('publishedAt', 'desc'),
      limit(50),
    ),
    (snap) => {
      listings = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BaTListing);
      emit();
    },
    onError,
  );

  // Subscribe to own garage media (recent uploads)
  const mediaUnsub = onSnapshot(
    query(
      collection(db, 'media'),
      where('ownerId', '==', userId),
      where('createdAt', '>=', cutoff),
      orderBy('createdAt', 'desc'),
      limit(30),
    ),
    (snap) => {
      mediaItems = snap.docs.map((d) => {
        const data = d.data();
        const vehicle = userVehicles.find((v) => v.id === data.vehicleId);
        return {
          kind: 'garage_media',
          id: d.id,
          vehicleId: data.vehicleId,
          vehicleName: vehicle
            ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
            : 'Your garage',
          ownerId: data.ownerId,
          ownerDisplayName: data.ownerDisplayName,
          imageUrl: data.downloadUrl ?? '',
          caption: data.caption,
          publishedAt: data.createdAt,
        } as GarageMediaFeedItem;
      });
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
```

---

### 4. Updated `app/(tabs)/feed.tsx`

Replace the current file. Key structural changes:
- Reads `userVehicles` from a `watchVehiclesForOwner` subscription (for garage matching)
- Passes vehicles into `watchFeedForUser`
- Renders a mixed list of `NewsCard`, `BaTCard`, `MediaCard` components

Rough structure:
```typescript
// Relevant new state
const [feedItems, setFeedItems] = useState<ScoredFeedItem[] | null>(null);
const [userVehicles, setUserVehicles] = useState<Vehicle[]>([]);

// Subscribe to user's vehicles first, then feed
useEffect(() => {
  if (!user) return;
  return watchVehiclesForOwner(user.uid, setUserVehicles, setError);
}, [user]);

useEffect(() => {
  if (!user) return;
  return watchFeedForUser(user.uid, userVehicles, setFeedItems, setError);
}, [user, userVehicles]);

// Render per item kind
function renderFeedItem({ item, relevanceScore }: ScoredFeedItem) {
  switch (item.kind) {
    case 'article': return <NewsCard article={item} isGarageMatch={relevanceScore > 0} />;
    case 'bat_listing': return <BaTCard listing={item} isGarageMatch={relevanceScore > 0} />;
    case 'garage_media': return <MediaCard item={item} />;
  }
}
```

Components to create in `components/`:
- `news-card.tsx` — headline, source badge, excerpt, thumbnail, "For your [Make]" label if matched
- `bat-card.tsx` — listing title, image, year/make/model, link to BaT
- `media-card.tsx` — photo/video from garage (already partially exists as `media-gallery.tsx`, repurpose)

---

## Firestore Indexes Required

Add to `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "feed_articles",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "bat_listings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Steps for Claude Code

```bash
# 1. Initialize Cloud Functions
cd ~/Documents/Claude/Projects/wheelbase-app
firebase init functions
# → TypeScript, yes ESLint, yes install deps

# 2. Install function dependencies
cd functions
npm install fast-xml-parser node-fetch
npm install --save-dev @types/node-fetch

# 3. Create functions/src/index.ts
# (paste the Cloud Function code from above)

# 4. Create types/feed.ts
# (paste types from above)

# 5. Create services/feed.ts
# (paste service from above)

# 6. Update app/(tabs)/feed.tsx
# (implement the new mixed feed UI)

# 7. Create components/news-card.tsx
# Create components/bat-card.tsx

# 8. Add Firestore indexes
# (add to firestore.indexes.json, then: firebase deploy --only firestore:indexes)

# 9. Deploy functions
cd functions && npm run build
firebase deploy --only functions

# 10. Test locally first
firebase emulators:start
```

---

## Open Questions

- **BaT listing links**: Should tapping a BaT card open in-app WebView or external browser? (Recommend external browser for v1 — fewer permissions, simpler)
- **Article link handling**: Same question — external browser for now.
- **"For your garage" UI**: Show a small coloured pill ("For your Porsche") on matched items? Or just boost position silently? Recommend showing the pill — makes the personalization feel intentional.
- **Empty state when garage is empty**: Show unfiltered feed with a prompt to "Add your first vehicle to get personalised content."
- **Garage media tab 3 (future)**: When the follows feature lands, add followed users' media to the `watchFeedForUser` query.
