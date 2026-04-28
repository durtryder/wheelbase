import { XMLParser } from 'fast-xml-parser';
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();
const db = admin.firestore();
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Keyword list for tagging articles by automotive make. The list is
 * intentionally broad — it's a recall optimisation, not a marketing call.
 * Multi-word makes ("aston martin", "land rover") are matched as substrings,
 * so order matters less than coverage.
 */
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
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() > NINETY_DAYS_MS;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

function pickString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (c && typeof c === 'object') {
      const text = (c as Record<string, unknown>)['#text'];
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
  }
  return undefined;
}

async function fetchRss(url: string): Promise<unknown[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Wheelbase/1.0 (+https://wheelbase.se)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status} ${url}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

/**
 * Stable Firestore doc ID derived from the source + URL. Re-syncing the
 * same article writes the same ID so we update in place rather than
 * accumulating duplicates.
 */
function makeDocId(prefix: string, url: string): string {
  const slug = Buffer.from(url).toString('base64url').slice(0, 60);
  return `${prefix}_${slug}`;
}

async function pruneOlderThan90Days(collection: string): Promise<void> {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - NINETY_DAYS_MS);
  // Firestore caps a write batch at 500 ops. Prune in chunks so a backlog
  // (e.g., long downtime, or a fresh deploy after dormant collections grew)
  // can drain over a few minutes instead of failing the whole function.
  const PAGE = 500;
  while (true) {
    const old = await db
      .collection(collection)
      .where('publishedAt', '<', cutoff)
      .limit(PAGE)
      .get();
    if (old.empty) return;
    const batch = db.batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (old.size < PAGE) return;
  }
}

// ---------------------------------------------------------------------------
// News feed sync — Jalopnik, Car & Driver, 000 Magazine
// ---------------------------------------------------------------------------

export const syncNewsFeeds = onSchedule(
  { schedule: 'every 60 minutes', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const sources = [
      { id: 'jalopnik' as const, url: 'https://jalopnik.com/rss' },
      { id: 'caranddriver' as const, url: 'https://www.caranddriver.com/rss/all.xml' },
      { id: '000magazine' as const, url: 'https://000magazine.com/feed' },
    ];

    for (const source of sources) {
      try {
        const items = await fetchRss(source.url);
        const batch = db.batch();
        let writes = 0;

        for (const raw of items) {
          const item = raw as Record<string, unknown>;
          const pubDate = pickString(item.pubDate, item['dc:date']) ?? '';
          if (!pubDate || olderThan90Days(pubDate)) continue;

          const url = pickString(item.link, item.guid);
          if (!url) continue;

          const id = makeDocId(source.id, url);
          const title = pickString(item.title) ?? '';
          const rawDescription = pickString(item.description, item['content:encoded']) ?? '';
          const excerpt = stripHtml(rawDescription).slice(0, 300);

          const mediaContent = item['media:content'] as Record<string, unknown> | undefined;
          const enclosure = item.enclosure as Record<string, unknown> | undefined;
          const mediaThumb = item['media:thumbnail'] as Record<string, unknown> | undefined;
          const imageUrl =
            (mediaContent?.['@_url'] as string | undefined) ??
            (enclosure?.['@_url'] as string | undefined) ??
            (mediaThumb?.['@_url'] as string | undefined) ??
            extractFirstImage(rawDescription) ??
            '';

          const author = pickString(item['dc:creator'], item.author) ?? '';

          const doc = {
            kind: 'article',
            source: source.id,
            title,
            url,
            excerpt,
            imageUrl,
            author,
            publishedAt: admin.firestore.Timestamp.fromDate(new Date(pubDate)),
            tags: extractTags(`${title} ${excerpt}`),
            fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          batch.set(db.collection('feed_articles').doc(id), doc, { merge: true });
          writes++;
        }

        if (writes > 0) await batch.commit();
        console.log(`[syncNewsFeeds] ${source.id}: wrote ${writes} items`);
      } catch (err) {
        console.error(`[syncNewsFeeds] Error for ${source.id}:`, err);
      }
    }

    try {
      await pruneOlderThan90Days('feed_articles');
    } catch (err) {
      console.error('[syncNewsFeeds] Prune failed:', err);
    }
  },
);

// ---------------------------------------------------------------------------
// Bring a Trailer listing sync
// ---------------------------------------------------------------------------

export const syncBaTListings = onSchedule(
  { schedule: 'every 60 minutes', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    try {
      const items = await fetchRss('https://bringatrailer.com/feed/');
      const batch = db.batch();
      let writes = 0;

      for (const raw of items) {
        const item = raw as Record<string, unknown>;
        const pubDate = pickString(item.pubDate, item['dc:date']) ?? '';
        if (!pubDate || olderThan90Days(pubDate)) continue;

        const url = pickString(item.link, item.guid);
        if (!url) continue;

        const id = makeDocId('bat', url);
        const title = pickString(item.title) ?? '';

        // BaT titles follow the pattern: "YEAR Make Model [Description]"
        // e.g. "1972 Porsche 911 S Targa". This regex is best-effort —
        // unmatched titles still get written, just without structured fields.
        const titleMatch = title.match(
          /^(\d{4})\s+([A-Za-z][A-Za-z\-]*)\s+([A-Za-z0-9][A-Za-z0-9\s\-]*?)(?:\s*[–\-]|\s*\[|$)/,
        );
        const year = titleMatch ? Number.parseInt(titleMatch[1], 10) : undefined;
        const make = titleMatch ? titleMatch[2].toLowerCase() : undefined;
        const model = titleMatch ? titleMatch[3].trim().toLowerCase() : undefined;

        const mediaContent = item['media:content'] as Record<string, unknown> | undefined;
        const enclosure = item.enclosure as Record<string, unknown> | undefined;
        const description = pickString(item.description, item['content:encoded']) ?? '';
        const imageUrl =
          (mediaContent?.['@_url'] as string | undefined) ??
          (enclosure?.['@_url'] as string | undefined) ??
          extractFirstImage(description) ??
          '';

        const doc: Record<string, unknown> = {
          kind: 'bat_listing',
          title,
          url,
          imageUrl,
          publishedAt: admin.firestore.Timestamp.fromDate(new Date(pubDate)),
          fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (make) doc.make = make;
        if (model) doc.model = model;
        if (year && !Number.isNaN(year)) doc.year = year;

        batch.set(db.collection('bat_listings').doc(id), doc, { merge: true });
        writes++;
      }

      if (writes > 0) await batch.commit();
      console.log(`[syncBaTListings] wrote ${writes} items`);
    } catch (err) {
      console.error('[syncBaTListings] Error:', err);
    }

    try {
      await pruneOlderThan90Days('bat_listings');
    } catch (err) {
      console.error('[syncBaTListings] Prune failed:', err);
    }
  },
);

/** Pull the first <img src="..."> out of an HTML excerpt, if any. */
function extractFirstImage(html: string): string | undefined {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : undefined;
}
