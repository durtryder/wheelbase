/**
 * Route an external feed image (BaT, news source, etc.) through a public
 * image-resizing CDN so we don't download multi-MB hero photos for a
 * 16:9 card thumb. images.weserv.nl is free, doesn't require an account,
 * caches aggressively, and returns modern WebP.
 *
 * Garage media should NOT use this — those URLs are already on Firebase
 * Storage and the user's own content shouldn't be proxied through a
 * third party.
 */
export function feedThumbnailUrl(
  originalUrl: string | undefined,
  width: number = 1200,
): string | undefined {
  if (!originalUrl) return undefined;
  // Data URIs (lazy-load placeholders) are useless — skip the hero.
  if (originalUrl.startsWith('data:')) return undefined;
  // Anything not absolute http(s) (relative path, file://, etc.) — leave alone.
  if (!/^https?:\/\//i.test(originalUrl)) return originalUrl;

  const stripped = originalUrl.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}&q=75&output=webp`;
}
