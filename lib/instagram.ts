/**
 * Accept anything the user is likely to paste — bare handle, "@handle", a
 * profile URL like instagram.com/handle or https://www.instagram.com/handle/
 * — and reduce it to the bare handle we actually store.
 */
export function normalizeInstagramHandle(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  let h = trimmed;
  const urlMatch = h.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i,
  );
  if (urlMatch) h = urlMatch[1];
  h = h.replace(/^@+/, '').replace(/\/+$/, '');
  return h || undefined;
}

export function buildInstagramUrl(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(handle)}`;
}
