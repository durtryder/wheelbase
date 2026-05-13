/**
 * Folder editor — the composer for a single media folder under a
 * vehicle. Lives at /vehicles/folder/<folderId>; the folder doc
 * carries the parent vehicleId so we don't need to thread it through
 * the URL. Owner-only; non-owners are bounced.
 */

import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { FormField } from '@/components/form-field';
import { MediaReorderGrid } from '@/components/media-reorder-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  deleteMediaFolder,
  getMediaFolder,
  reorderMediaItems,
  updateMediaFolder,
  uploadVehicleMedia,
  watchMediaForFolder,
} from '@/services/media';
import type { MediaFolder, MediaItem } from '@/types/vehicle';

export default function FolderEditorScreen() {
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading: authLoading } = useAuth();

  const [folder, setFolder] = useState<MediaFolder | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [reordering, setReordering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/sign-in');
  }, [authLoading, user, router]);

  useEffect(() => {
    let cancelled = false;
    if (!folderId) return;
    setLoadError(null);
    getMediaFolder(folderId)
      .then((f) => {
        if (cancelled) return;
        setFolder(f);
        if (f) setName(f.name ?? '');
      })
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : 'Failed to load folder.'),
      );
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  useEffect(() => {
    if (!folderId) return;
    return watchMediaForFolder(
      folderId,
      (items) => setMedia(items),
      (e) => setMediaError(e.message),
    );
  }, [folderId]);

  if (authLoading || (folder === undefined && !loadError)) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.tint} />
        </View>
      </ThemedView>
    );
  }

  if (loadError) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="title">Couldn&apos;t load folder</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.tint, marginTop: 8 }}>
            {loadError}
          </ThemedText>
          <Pressable
            onPress={() => router.replace('/' as Href)}
            style={[styles.ghostButton, { borderColor: palette.border, marginTop: 16 }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              Back to garage
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (folder === null) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="title">Folder not found</ThemedText>
          <Pressable
            onPress={() => router.replace('/' as Href)}
            style={[styles.ghostButton, { borderColor: palette.border, marginTop: 16 }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              Back to garage
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (!folder || !user) return null;
  if (folder.ownerId !== user.uid) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="title">Not your folder</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 8 }}>
            Folders are private to the vehicle&apos;s owner.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  async function handleSaveName() {
    if (!folder) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) return;
    setSavingName(true);
    setActionError(null);
    try {
      await updateMediaFolder(folder.id, { name: trimmed });
      setFolder({ ...folder, name: trimmed });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save name.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleAddMedia() {
    if (!user || !folder) return;
    setActionError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted' && perm.status !== 'undetermined') {
        setActionError('Photo library permission denied.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;

      setUploading(true);
      const total = result.assets.length;
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const isVideo =
          asset.type === 'video' ||
          (asset.mimeType?.startsWith('video/') ?? false);
        setUploadProgress({ current: i + 1, total });
        const item = await uploadVehicleMedia({
          kind: isVideo ? 'video' : 'photo',
          ownerId: user.uid,
          vehicleId: folder.vehicleId,
          folderId: folder.id,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          durationMs: isVideo && asset.duration ? asset.duration : undefined,
        });
        // Optimistically insert; onSnapshot reconciles in a beat.
        setMedia((prev) => (prev.some((m) => m.id === item.id) ? prev : [...prev, item]));
      }
    } catch (e) {
      console.error('[folder] upload failed', e);
      setActionError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleReorder(orderedIds: string[]) {
    setActionError(null);
    try {
      await reorderMediaItems(orderedIds);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save new order.');
    }
  }

  async function handleDelete() {
    if (!folder) return;
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        media.length > 0
          ? `Delete this folder and its ${media.length} ${media.length === 1 ? 'item' : 'items'}? This cannot be undone.`
          : 'Delete this empty folder?',
      );
      if (!ok) return;
    }
    setDeleting(true);
    setActionError(null);
    try {
      const vehicleId = folder.vehicleId;
      await deleteMediaFolder(folder.id);
      router.replace(`/vehicles/${vehicleId}` as Href);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Delete failed.');
      setDeleting(false);
    }
  }

  const sortedMedia = [...media].sort((a, b) => {
    if (a.order != null && b.order != null) return a.order - b.order;
    if (a.order != null) return -1;
    if (b.order != null) return 1;
    return 0;
  });

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="eyebrow" style={{ color: palette.tint, letterSpacing: 1.6 }}>
            Folder
          </ThemedText>
          <ThemedText type="title">{name.trim() || 'Untitled folder'}</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <View style={styles.section}>
          <FormField
            label="Folder name"
            value={name}
            onChangeText={setName}
            onBlur={handleSaveName}
            placeholder="e.g., Restoration progress"
          />
          {savingName ? (
            <ThemedText type="metadata" style={{ color: palette.textMuted }}>
              Saving name…
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.mediaHeader}>
            <ThemedText type="subtitle">Media</ThemedText>
            <View style={styles.mediaHeaderActions}>
              {sortedMedia.length > 1 ? (
                <Pressable
                  onPress={() => setReordering((r) => !r)}
                  disabled={uploading}
                  style={({ hovered }) => [
                    styles.reorderLink,
                    hovered ? ({ cursor: 'pointer' } as object) : null,
                  ]}>
                  <ThemedText
                    type="metadata"
                    style={{
                      color: reordering ? palette.tint : palette.textMuted,
                      fontWeight: '600',
                      letterSpacing: 1,
                      textDecorationLine: 'underline',
                    }}>
                    {reordering ? 'DONE' : 'REORDER'}
                  </ThemedText>
                </Pressable>
              ) : null}
              {!reordering ? (
                <Pressable
                  onPress={handleAddMedia}
                  disabled={uploading}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: palette.tint, opacity: uploading ? 0.6 : 1 },
                  ]}>
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>
                      {sortedMedia.length === 0 ? 'Add photos or videos' : 'Add more'}
                    </ThemedText>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>

          {uploadProgress ? (
            <ThemedText type="metadata" style={{ color: palette.textMuted }}>
              Uploading {uploadProgress.current} of {uploadProgress.total}…
            </ThemedText>
          ) : null}
          {mediaError ? (
            <ThemedText type="metadata" style={{ color: palette.tint }}>
              {mediaError}
            </ThemedText>
          ) : null}
          {actionError ? (
            <ThemedText type="metadata" style={{ color: palette.tint }}>
              {actionError}
            </ThemedText>
          ) : null}

          {sortedMedia.length === 0 ? (
            <ThemedText type="metadata" style={{ color: palette.placeholder }}>
              No media in this folder yet. Add photos or videos to get
              started — they&apos;ll show as their own gallery on the
              vehicle page, below the main one.
            </ThemedText>
          ) : reordering ? (
            <MediaReorderGrid media={sortedMedia} onReorder={handleReorder} />
          ) : (
            <ThemedText type="metadata" style={{ color: palette.textMuted }}>
              {sortedMedia.length} {sortedMedia.length === 1 ? 'item' : 'items'} in this folder.
            </ThemedText>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.replace(`/vehicles/${folder.vehicleId}` as Href)}
            style={[styles.ghostButton, { borderColor: palette.border }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              Back to vehicle
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={[
              styles.dangerButton,
              { borderColor: palette.tint, opacity: deleting ? 0.6 : 1 },
            ]}>
            {deleting ? (
              <ActivityIndicator color={palette.tint} />
            ) : (
              <ThemedText style={[styles.dangerButtonText, { color: palette.tint }]}>
                Delete folder
              </ThemedText>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 64,
    gap: 24,
    maxWidth: 920,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  titleBlock: {
    gap: 8,
    alignItems: 'flex-start',
  },
  rule: { width: 40, height: 2, marginTop: 6 },
  section: { gap: 12 },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  reorderLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  ghostButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  ghostButtonText: { fontSize: 14, fontWeight: '600' },
  dangerButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  dangerButtonText: { fontSize: 14, fontWeight: '600' },
});
