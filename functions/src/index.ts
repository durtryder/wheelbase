import Anthropic from '@anthropic-ai/sdk';
import { XMLParser } from 'fast-xml-parser';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/** Anthropic API key, bound to summarizeNotebookEntry (and any future
 *  AI-powered callable). Set via `firebase functions:secrets:set
 *  ANTHROPIC_API_KEY`. */
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

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

// ===========================================================================
// summarizeNotebookEntry — HTTPS callable that asks Claude to summarize what
// a notebook entry's links and notes are about. First real use of the
// Anthropic API in this project; future research-style features (deeper
// fetches, web search, compatibility-checks per saved part) will sit
// alongside this one and reuse the same fetch / text helpers.
// ===========================================================================

/**
 * Fetch a URL server-side with the same safety profile as
 * fetchLinkMetadata (8s timeout, SSRF guard, 256 KB cap) and return
 * the raw HTML body. Caller is responsible for converting to text.
 * Throws on transport or invalid-URL errors.
 */
async function fetchPageHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('only http(s) allowed');
  }
  if (looksLikeInternalHost(parsed.hostname)) {
    throw new Error('private addresses not allowed');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(parsed.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; WheelbaseBot/1.0; +https://wheelba.se)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
      },
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`http_${res.status}`);
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      throw new Error('not-html');
    }

    const body = res.body;
    if (!body) throw new Error('no-body');

    const limit = 512 * 1024; // a bit more than fetchLinkMetadata since
                              // we want body text, not just <head>
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
      if (total >= limit) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        break;
      }
    }
    chunks.push(decoder.decode());
    return { html: chunks.join(''), finalUrl: res.url || parsed.toString() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * True for Bring a Trailer listing URLs. Used to gate the per-link
 * comments-feed fetch.
 */
function isBaTListing(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname === 'bringatrailer.com' ||
        u.hostname === 'www.bringatrailer.com') &&
      u.pathname.startsWith('/listing/')
    );
  } catch {
    return false;
  }
}

/**
 * Map a BaT listing URL to its per-listing comments RSS feed
 * (`<listing>/feed/`). BaT publishes the most-recent ~12 comments
 * there as clean XML — much cheaper to ingest than scraping the
 * 400KB listing HTML, and reaches content our text cap would
 * otherwise truncate.
 */
async function fetchBaTComments(
  listingUrl: string,
): Promise<{ author: string; text: string }[]> {
  const u = new URL(listingUrl);
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  u.pathname += 'feed/';
  const feedUrl = u.toString();

  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; WheelbaseBot/1.0; +https://wheelba.se)',
      Accept: 'application/rss+xml,application/xml,text/xml',
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const arr = (Array.isArray(items) ? items : [items]) as Record<
    string,
    unknown
  >[];

  const PER_COMMENT_CAP = 600;
  return arr
    .map((item) => {
      const author =
        pickString(item['dc:creator'], item.author) ?? 'anonymous';
      const raw = pickString(item.description) ?? '';
      const text = stripHtml(raw).replace(/\s+/g, ' ').slice(0, PER_COMMENT_CAP);
      return { author, text };
    })
    .filter((c) => c.text.length > 0);
}

/**
 * Lossy HTML → text. Strips scripts/styles/heads, collapses tags,
 * decodes the entity subset we care about, and normalises whitespace.
 * Good enough for feeding into Claude — not a reader-mode parser.
 */
function htmlToText(html: string): string {
  let s = html;
  // Drop noisy sections wholesale.
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<head\b[\s\S]*?<\/head>/gi, ' ');
  // Block-level tags → newline so paragraphs survive.
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|br)[^>]*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // Drop everything else.
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  // Collapse runs of whitespace; preserve paragraph breaks.
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n[ \t]+/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

type SummarizeRequest = { entryId: string };

type SummarizeLink = {
  id: string;
  url: string;
  title?: string;
  siteName?: string;
};

type SummarizeEntry = {
  ownerId: string;
  title?: string;
  body?: string;
  vehicleId?: string;
  links?: SummarizeLink[];
};

type ResearchSource = { title?: string; url: string };

type ResearchRecord = {
  status: 'complete' | 'error';
  fetchedAt: admin.firestore.Timestamp;
  summary?: string;
  sources?: ResearchSource[];
  errorMessage?: string;
};

export const summarizeNotebookEntry = onCall(
  {
    maxInstances: 5,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [anthropicApiKey],
  },
  async (request): Promise<{
    ok: boolean;
    research?: ResearchRecord;
    error?: string;
  }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const payload = request.data as Partial<SummarizeRequest> | undefined;
    const entryId = String(payload?.entryId ?? '').trim();
    if (!entryId) {
      throw new HttpsError('invalid-argument', 'entryId required');
    }

    const ref = db.collection('notebookEntries').doc(entryId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Entry not found.');
    }
    const entry = snap.data() as SummarizeEntry;
    if (entry.ownerId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Not your entry.');
    }

    const links = entry.links ?? [];
    if (links.length === 0 && !entry.body?.trim()) {
      throw new HttpsError(
        'failed-precondition',
        'Add at least one link or some notes before requesting a summary.',
      );
    }

    // Optional vehicle context — pulls the linked car's identity so
    // Claude can write things like "given this is being saved against
    // a 996 911, ..." instead of summarizing blind.
    let vehicleContext: string | undefined;
    if (entry.vehicleId) {
      try {
        const vSnap = await db.collection('vehicles').doc(entry.vehicleId).get();
        if (vSnap.exists) {
          const v = vSnap.data() as {
            year?: number;
            make?: string;
            model?: string;
            trim?: string;
          };
          const parts = [v.year, v.make, v.model, v.trim].filter(Boolean);
          if (parts.length) vehicleContext = parts.join(' ');
        }
      } catch (e) {
        console.warn('[summarize] vehicle lookup failed', e);
      }
    }

    // Fetch each link's body in parallel. Cap per-page text so we
    // don't blow Claude's context with a 50KB BaT listing × N links.
    // For BaT listings, also pull the comments RSS feed — comments
    // sit ~260KB into the listing HTML and aren't reached by our
    // text cap, so without this step Claude only sees the seller's
    // description. The feed gives us the most-recent ~12 comments
    // in clean XML, which is where the real signal lives (expert
    // observations, condition red flags, bidding chatter).
    const PER_PAGE_TEXT_CAP = 24_000;
    const pages = await Promise.all(
      links.map(async (link) => {
        try {
          const { html, finalUrl } = await fetchPageHtml(link.url);
          let text = htmlToText(html).slice(0, PER_PAGE_TEXT_CAP);

          if (isBaTListing(link.url)) {
            try {
              const comments = await fetchBaTComments(link.url);
              if (comments.length > 0) {
                const formatted = comments
                  .map((c) => `- ${c.author}: ${c.text}`)
                  .join('\n');
                text += `\n\nRecent comments (most recent first):\n${formatted}`;
              }
            } catch (e) {
              console.warn(
                '[summarize] BaT comments fetch failed',
                link.url,
                e,
              );
            }
          }

          return { link, text, finalUrl };
        } catch (e) {
          console.warn('[summarize] link fetch failed', link.url, e);
          return {
            link,
            text: '',
            finalUrl: link.url,
            fetchError: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    const linksBlock = pages
      .map((p, i) => {
        const header = [
          `[${i + 1}] ${p.link.title || p.link.url}`,
          `URL: ${p.finalUrl}`,
          p.link.siteName ? `Site: ${p.link.siteName}` : null,
        ]
          .filter(Boolean)
          .join('\n');
        const body = p.text
          ? `Page contents:\n${p.text}`
          : `(Could not fetch this page: ${
              'fetchError' in p ? p.fetchError : 'no body'
            })`;
        return `${header}\n\n${body}`;
      })
      .join('\n\n----\n\n');

    const userPrompt = [
      entry.title ? `User's title: ${entry.title}` : null,
      entry.body ? `User's notes:\n${entry.body}` : null,
      vehicleContext ? `Linked vehicle: ${vehicleContext}` : null,
      links.length > 0 ? `Saved links:\n\n${linksBlock}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const system = [
      "You are a car-enthusiast research assistant. The user has saved",
      "a private notebook entry containing notes and/or links to car",
      "listings, parts, vendors, news, or forum threads. Your job is",
      "to produce a focused, factual summary of what they've collected.",
      '',
      'Output format:',
      "- 2–5 short paragraphs of plain text. No markdown headers, no",
      '  bullet lists, no emoji.',
      '- Pull specific facts when the source is a listing: year, make,',
      '  model, trim, mileage, location, engine/transmission, condition,',
      "  price or current bid. For parts: brand, model number, fitment,",
      "  price, vendor. For news: the key claims.",
      '- If the user provided their own notes, weave them in but',
      "  prioritize what the linked sources actually say.",
      '- If a page could not be fetched, acknowledge that briefly and',
      "  summarize from the URL/title alone if useful, otherwise skip.",
      '- Do not invent details. If something is unclear, say so.',
      '',
      "Auction comments (when present — typically Bring a Trailer):",
      "- A 'Recent comments' section may follow the page contents. These",
      "  are the most recent buyer/observer comments on the listing and",
      "  are valuable signal. Treat them as a separate paragraph in your",
      "  summary.",
      "- Surface: condition concerns or red flags raised by commenters,",
      "  expert observations (provenance, originality, mechanical),",
      "  bidding momentum or notable bid placements, seller responses",
      "  to questions, and any consensus on value or authenticity.",
      "- Attribute the signal to commenters generally ('commenters",
      "  flagged...'), not by name. Be honest if the comments are",
      "  unremarkable or mostly cheerleading.",
    ].join('\n');

    try {
      const client = new Anthropic({ apiKey: anthropicApiKey.value() });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const summary = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      const sources: ResearchSource[] = links.map((l) => ({
        title: l.title || l.siteName || l.url,
        url: l.url,
      }));

      const research: ResearchRecord = {
        status: 'complete',
        fetchedAt: admin.firestore.Timestamp.now(),
        summary,
        sources,
      };

      await ref.update({
        research,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[summarize] entry=${entryId} tokens=${response.usage?.input_tokens ?? '?'}/${response.usage?.output_tokens ?? '?'}`);

      return { ok: true, research };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[summarize] failed', message);
      const research: ResearchRecord = {
        status: 'error',
        fetchedAt: admin.firestore.Timestamp.now(),
        errorMessage: message,
      };
      try {
        await ref.update({ research });
      } catch (writeErr) {
        console.warn('[summarize] failed to write error record', writeErr);
      }
      return { ok: false, research, error: message };
    }
  },
);
