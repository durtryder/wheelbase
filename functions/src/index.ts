import { XMLParser } from 'fast-xml-parser';
import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
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

// ===========================================================================
// fetchLinkMetadata — HTTPS callable that pulls a page's <title> + og:* tags
// so the Notebook editor can pre-populate a draft headline when a user adds a
// link. Runs server-side because most target sites (Bring a Trailer, eBay,
// vendor pages) don't return Access-Control-Allow-Origin headers for
// cross-origin fetches from wheelba.se, so client-side scraping isn't viable.
// ===========================================================================

/** Hosts that resolve to internal / loopback / link-local addresses. SSRF
 *  guard: we never want a caller to make us probe our own VPC. */
function looksLikeInternalHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1') return true;
  if (h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.'))
    return true;
  if (h.startsWith('169.254.')) return true; // link-local / cloud metadata
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true; // RFC1918 172.16/12
  return false;
}

/** Decode the small set of HTML entities that show up in <title> tags. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract a single <meta property|name="<n>" content="..."> value. */
function extractMeta(html: string, n: string): string | undefined {
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // property|name and content can appear in either order on the tag.
  const patterns: RegExp[] = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${esc}["']`,
      'i',
    ),
  ];
  for (const p of patterns) {
    const m = p.exec(html);
    if (m && m[1]) return decodeEntities(m[1]);
  }
  return undefined;
}

function extractDocTitle(html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return undefined;
  return decodeEntities(m[1]);
}

export const fetchLinkMetadata = onCall(
  { maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' },
  async (request): Promise<{
    ok: boolean;
    reason?: string;
    title?: string;
    siteName?: string;
    description?: string;
    thumbnailUrl?: string;
    finalUrl?: string;
  }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const raw = String(request.data?.url ?? '').trim();
    if (!raw) {
      throw new HttpsError('invalid-argument', 'url required');
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new HttpsError('invalid-argument', 'invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new HttpsError('invalid-argument', 'only http(s) allowed');
    }
    if (looksLikeInternalHost(parsed.hostname)) {
      throw new HttpsError('invalid-argument', 'private addresses not allowed');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    let html: string;
    let finalUrl: string;
    try {
      const res = await fetch(parsed.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          // Browser-ish UA — some sites 403 obvious bots. We're transparent
          // about who we are; we just don't want to be filtered.
          'User-Agent':
            'Mozilla/5.0 (compatible; WheelbaseBot/1.0; +https://wheelba.se)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        },
        redirect: 'follow',
      });

      if (!res.ok) {
        return { ok: false, reason: `http_${res.status}` };
      }
      const ct = (res.headers.get('content-type') ?? '').toLowerCase();
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
        return { ok: false, reason: 'not-html' };
      }

      // Cap the read at ~256KB — <head> on even bloated sites fits well under
      // this. We only need the meta tags up top.
      const limit = 256 * 1024;
      const body = res.body;
      if (!body) {
        return { ok: false, reason: 'no-body' };
      }
      const reader = body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const chunks: string[] = [];
      let total = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        chunks.push(decoder.decode(value, { stream: true }));
        // Bail once we've seen </head> or hit the cap.
        if (total >= limit || /<\/head>/i.test(chunks.join(''))) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          break;
        }
      }
      chunks.push(decoder.decode());
      html = chunks.join('');
      finalUrl = res.url || parsed.toString();
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      return {
        ok: false,
        reason: `fetch_failed:${e instanceof Error ? e.message : 'unknown'}`,
      };
    } finally {
      clearTimeout(timer);
    }

    // Prefer og:title (curator-controlled) over <title> (often noisy:
    // "1970 Porsche 911T Coupe 5-Speed for sale on BaT Auctions ..."), but
    // fall back to it when og:* isn't present.
    const title = extractMeta(html, 'og:title') ?? extractDocTitle(html);
    const siteName = extractMeta(html, 'og:site_name');
    const description =
      extractMeta(html, 'og:description') ?? extractMeta(html, 'description');

    // og:image can be absolute, protocol-relative ("//cdn.foo.com/..."),
    // or path-relative ("/wp-content/.../foo.jpg"). Resolve against the
    // final URL so the client receives a usable absolute URL.
    let thumbnailUrl: string | undefined;
    const rawThumb = extractMeta(html, 'og:image');
    if (rawThumb) {
      try {
        thumbnailUrl = new URL(rawThumb, finalUrl).toString();
      } catch {
        thumbnailUrl = undefined;
      }
    }

    if (!title && !siteName && !description && !thumbnailUrl) {
      return { ok: false, reason: 'no-metadata', finalUrl };
    }

    return {
      ok: true,
      title,
      siteName,
      description,
      thumbnailUrl,
      finalUrl,
    };
  },
);
