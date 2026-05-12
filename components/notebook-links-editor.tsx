import { Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { functions } from '@/lib/firebase';
import type { NotebookLink } from '@/types/notebook';

type LinkMetadataResult = {
  ok: boolean;
  reason?: string;
  title?: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  finalUrl?: string;
};

const fetchLinkMetadata = httpsCallable<
  { url: string },
  LinkMetadataResult
>(functions, 'fetchLinkMetadata');

type Palette = (typeof Colors)['light'];

/**
 * Reusable controlled-component editor for the `links` array on a
 * notebook entry. Used by both the composer (new entry) and the
 * detail / edit screen so the UX stays identical in both flows.
 *
 * Add flow:
 *   1. Tap "+ Add link" → inline form expands (URL + optional title).
 *   2. Tap "Add" → URL is normalized (https:// auto-prepended if the
 *      user pasted "domain.com/path") and validated. Successful add
 *      appends to the array and collapses the form.
 *   3. Tap "Cancel" → drops the draft and collapses.
 *
 * Each saved link renders as a tappable row showing the title (or the
 * host as fallback) plus the host below it, with a × button to
 * remove. Tapping the row opens the URL externally via Linking.
 */
export function NotebookLinksEditor({
  links,
  onChange,
  palette,
}: {
  links: NotebookLink[];
  onChange: (next: NotebookLink[]) => void;
  palette: Palette;
}) {
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Set of link ids currently being enriched server-side; drives the
  // "Fetching title…" spinner inside the row while the callable runs.
  const [enriching, setEnriching] = useState<Set<string>>(() => new Set());

  // The async metadata fetch finishes after one or more re-renders of
  // this component, so the `links` prop we captured at call time is
  // stale. Mirror it into a ref so the patch logic always splices into
  // the latest array the parent owns.
  const linksRef = useRef(links);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  function resetDraft() {
    setDraftUrl('');
    setDraftTitle('');
    setError(null);
  }

  async function enrichLink(id: string, url: string, fillTitle: boolean) {
    setEnriching((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      const res = await fetchLinkMetadata({ url });
      const data = res.data;
      if (!data?.ok) return;
      // Patch the link by id in the latest array. If the row was
      // removed while the fetch was in flight, no-op.
      const current = linksRef.current;
      const next = current.map((l) =>
        l.id === id
          ? {
              ...l,
              title: fillTitle && data.title ? data.title : l.title,
              siteName: data.siteName ?? l.siteName,
              description: data.description ?? l.description,
              thumbnailUrl: data.thumbnailUrl ?? l.thumbnailUrl,
              // If the page redirected, store the final URL we landed on.
              url: data.finalUrl ?? l.url,
            }
          : l,
      );
      onChange(next);
    } catch (e) {
      console.warn('[links] metadata fetch failed', e);
    } finally {
      setEnriching((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function handleAdd() {
    const normalized = normalizeUrl(draftUrl);
    if (!normalized) {
      setError('Enter a valid URL (e.g., bringatrailer.com/listing/...).');
      return;
    }
    const userTitle = draftTitle.trim();
    const link: NotebookLink = {
      id: generateLinkId(),
      url: normalized,
      title: userTitle || undefined,
      addedAt: Timestamp.now(),
    };
    onChange([...links, link]);
    resetDraft();
    setEditing(false);
    // Fire-and-forget enrichment. Only auto-fill the title if the user
    // didn't supply one — never overwrite their intent.
    void enrichLink(link.id, normalized, !userTitle);
  }

  function handleRemove(id: string) {
    onChange(links.filter((l) => l.id !== id));
  }

  return (
    <View style={styles.root}>
      {links.length > 0 ? (
        <View style={styles.list}>
          {links.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              enriching={enriching.has(link.id)}
              onOpen={() => openExternal(link.url)}
              onRemove={() => handleRemove(link.id)}
              palette={palette}
            />
          ))}
        </View>
      ) : (
        !editing ? (
          <ThemedText type="metadata" style={{ color: palette.placeholder }}>
            No links yet.
          </ThemedText>
        ) : null
      )}

      {editing ? (
        <View
          style={[
            styles.draftCard,
            { borderColor: palette.border, backgroundColor: palette.surfaceDim },
          ]}>
          <FormField
            label="URL"
            value={draftUrl}
            onChangeText={(t) => {
              setDraftUrl(t);
              if (error) setError(null);
            }}
            placeholder="https://..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
          />
          <FormField
            label="Title (optional)"
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="What this link is — defaults to the site host"
          />
          {error ? (
            <ThemedText type="metadata" style={{ color: palette.tint }}>
              {error}
            </ThemedText>
          ) : null}
          <View style={styles.draftActions}>
            <Pressable
              onPress={() => {
                resetDraft();
                setEditing(false);
              }}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText
                style={[styles.ghostButtonText, { color: palette.textMuted }]}>
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <ThemedText style={styles.primaryButtonText}>Add link</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setEditing(true)}
          style={[styles.addButton, { borderColor: palette.tint }]}>
          <ThemedText
            style={[styles.addButtonText, { color: palette.tint }]}>
            + Add link
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function LinkRow({
  link,
  enriching,
  onOpen,
  onRemove,
  palette,
}: {
  link: NotebookLink;
  enriching: boolean;
  onOpen: () => void;
  onRemove: () => void;
  palette: Palette;
}) {
  const host = extractHost(link.url);
  const label = link.title?.trim() || host;
  return (
    <View
      style={[
        styles.row,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <Pressable
        onPress={onOpen}
        style={({ hovered, pressed }) => [
          styles.rowMain,
          { opacity: pressed ? 0.7 : 1 },
          hovered ? ({ cursor: 'pointer' } as object) : null,
        ]}>
        <View style={styles.rowMainHeader}>
          <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </ThemedText>
          {enriching ? (
            <ActivityIndicator size="small" color={palette.textMuted} />
          ) : null}
        </View>
        <ThemedText
          type="metadata"
          style={{ color: palette.textMuted, marginTop: 2 }}
          numberOfLines={1}>
          {enriching && !link.title ? 'Fetching title…' : host}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityLabel="Remove link"
        style={({ hovered, pressed }) => [
          styles.removeButton,
          {
            borderColor: palette.border,
            backgroundColor: palette.surfaceDim,
            opacity: pressed ? 0.7 : 1,
          },
          hovered ? ({ cursor: 'pointer' } as object) : null,
        ]}>
        <ThemedText
          type="metadata"
          style={{ color: palette.tint, fontWeight: '700' }}>
          ×
        </ThemedText>
      </Pressable>
    </View>
  );
}

// ---------- helpers ----------

/**
 * Normalize a user-entered URL. Trims whitespace, auto-prepends https://
 * when no scheme is present, runs it through URL() for parse-validation,
 * and requires at least one dot in the hostname so single-word inputs
 * like "abc" don't pass. Returns null on failure.
 */
function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function openExternal(url: string) {
  // Linking.openURL works on web (window.open) and native (browser).
  Linking.openURL(url).catch((e) => {
    console.warn('[links] open failed', e);
  });
}

function generateLinkId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  rowMain: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowMainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeButton: {
    width: 40,
    borderLeftWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 14,
    gap: 10,
  },
  draftActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  addButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  ghostButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  ghostButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
