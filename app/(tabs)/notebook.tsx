import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { watchNotebookEntries } from '@/services/notebook';
import type { NotebookEntry } from '@/types/notebook';

type Palette = (typeof Colors)['light'];

export default function NotebookScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading: authLoading } = useAuth();

  const [entries, setEntries] = useState<NotebookEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Notebook is private — redirect to sign-in for anonymous viewers
  // before fetching anything.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/sign-in');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) {
      setEntries(null);
      return;
    }
    setError(null);
    const unsub = watchNotebookEntries(
      user.uid,
      (next) => setEntries(next),
      (e) => setError(e.message),
    );
    return unsub;
  }, [user]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">Notebook</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, textAlign: 'center', maxWidth: 520 }}>
            A private journal for car research — capture parts, components, ideas,
            and notes. AI-powered research will arrive in a later phase.
          </ThemedText>
        </View>

        {authLoading || !user ? (
          <Centered>
            <ActivityIndicator color={palette.tint} />
          </Centered>
        ) : error ? (
          <ErrorCard palette={palette} message={error} />
        ) : entries === null ? (
          <Centered>
            <ActivityIndicator color={palette.tint} />
          </Centered>
        ) : entries.length === 0 ? (
          <EmptyState palette={palette} onAdd={() => router.push('/notebook/new' as Href)} />
        ) : (
          <>
            <View style={styles.headerRow}>
              <ThemedText type="metadata" style={{ color: palette.textMuted }}>
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </ThemedText>
              <Pressable
                onPress={() => router.push('/notebook/new' as Href)}
                style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
                <ThemedText style={styles.primaryButtonText}>+ New entry</ThemedText>
              </Pressable>
            </View>
            <View style={styles.list}>
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  palette={palette}
                  onPress={() => router.push(`/notebook/${entry.id}` as Href)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function EntryCard({
  entry,
  palette,
  onPress,
}: {
  entry: NotebookEntry;
  palette: Palette;
  onPress: () => void;
}) {
  const photoCount = entry.photos?.length ?? 0;
  const firstPhoto = photoCount > 0 ? entry.photos[0] : null;
  const dateLine = formatDate(entry.createdAt);
  const title = useMemo(() => deriveTitle(entry), [entry]);
  const snippet = useMemo(() => deriveSnippet(entry), [entry]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.card,
        {
          borderColor: palette.border,
          backgroundColor: palette.surface,
          opacity: pressed ? 0.94 : 1,
        },
        hovered ? ({ cursor: 'pointer' } as object) : null,
      ]}>
      {firstPhoto ? (
        <Image
          source={{ uri: firstPhoto.downloadUrl }}
          style={styles.cardThumb}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.cardThumb, { backgroundColor: palette.surfaceDim }]}>
          <ThemedText
            type="eyebrow"
            style={{ color: palette.placeholder, letterSpacing: 1.6 }}>
            NOTE
          </ThemedText>
        </View>
      )}
      <View style={styles.cardBody}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {title}
        </ThemedText>
        {snippet ? (
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, marginTop: 4 }}
            numberOfLines={2}>
            {snippet}
          </ThemedText>
        ) : null}
        <View style={styles.cardMeta}>
          {dateLine ? (
            <ThemedText
              type="metadata"
              style={{ color: palette.placeholder, letterSpacing: 0.6 }}>
              {dateLine}
            </ThemedText>
          ) : null}
          {photoCount > 0 ? (
            <ThemedText
              type="metadata"
              style={{ color: palette.placeholder, letterSpacing: 0.6 }}>
              {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({ palette, onAdd }: { palette: Palette; onAdd: () => void }) {
  return (
    <ThemedView
      style={[
        styles.emptyCard,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <ThemedText type="subtitle">Your notebook is empty.</ThemedText>
      <ThemedText
        type="default"
        style={{ color: palette.textMuted, marginTop: 8, lineHeight: 22 }}>
        Capture a part, a question, or an idea. Snap photos when you spot
        something worth remembering. Link entries to vehicles in your garage
        for sharper context. Everything here stays private to you.
      </ThemedText>
      <View style={styles.emptyActions}>
        <Pressable
          onPress={onAdd}
          style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
          <ThemedText style={styles.primaryButtonText}>+ New entry</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function ErrorCard({ palette, message }: { palette: Palette; message: string }) {
  return (
    <ThemedView
      style={[
        styles.emptyCard,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}>
      <ThemedText type="eyebrow" style={{ color: palette.tint }}>
        Couldn&apos;t load your notebook
      </ThemedText>
      <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 8 }}>
        {message}
      </ThemedText>
    </ThemedView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

// ---------- helpers ----------

function deriveTitle(entry: NotebookEntry): string {
  if (entry.title?.trim()) return entry.title.trim();
  if (entry.body?.trim()) {
    const firstLine = entry.body.split('\n')[0]?.trim() ?? '';
    if (firstLine.length > 0) return firstLine.slice(0, 80);
  }
  if ((entry.photos?.length ?? 0) > 0) return 'Photo entry';
  return 'Untitled note';
}

function deriveSnippet(entry: NotebookEntry): string | null {
  const body = entry.body?.trim();
  if (!body) return null;
  // If we already used the first line as the title, skip it for the
  // snippet so we don't repeat ourselves.
  if (!entry.title?.trim()) {
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.slice(1).join(' ') || null;
  }
  return body;
}

function formatDate(ts: NotebookEntry['createdAt']): string | null {
  if (!ts) return null;
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : (ts as unknown as Date);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 56,
    gap: 24,
    maxWidth: 1024,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: {
    gap: 10,
    alignItems: 'center',
  },
  rule: {
    width: 40,
    height: 2,
    marginTop: 2,
  },
  centered: {
    padding: 40,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cardThumb: {
    width: 130,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    padding: 16,
    gap: 2,
    justifyContent: 'center',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 28,
  },
  emptyActions: {
    marginTop: 18,
    flexDirection: 'row',
  },
});
