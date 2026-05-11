import { Image } from 'expo-image';
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
import { NotebookLinksEditor } from '@/components/notebook-links-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleLinker } from '@/components/vehicle-linker';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  deleteNotebookEntry,
  getNotebookEntry,
  removePhotoFromEntry,
  updateNotebookEntry,
  uploadNotebookPhoto,
} from '@/services/notebook';
import type { NotebookEntry, NotebookLink, NotebookPhoto } from '@/types/notebook';

export default function NotebookEntryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading: authLoading } = useAuth();

  const [entry, setEntry] = useState<NotebookEntry | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable copies; entry stays as the saved snapshot until we
  // commit. Patch tracks what's dirty so we only round-trip diffs.
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [vehicleId, setVehicleId] = useState<string | undefined>(undefined);
  const [links, setLinks] = useState<NotebookLink[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/sign-in');
  }, [authLoading, user, router]);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLoadError(null);
    getNotebookEntry(id)
      .then((e) => {
        if (cancelled) return;
        setEntry(e);
        if (e) {
          setTitle(e.title ?? '');
          setBody(e.body ?? '');
          setVehicleId(e.vehicleId);
          setLinks(e.links ?? []);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load entry.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (authLoading || (entry === undefined && !loadError)) {
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
          <ThemedText type="title">Couldn&apos;t load entry</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.tint, marginTop: 8 }}>
            {loadError}
          </ThemedText>
          <Pressable
            onPress={() => router.replace('/notebook' as Href)}
            style={[
              styles.ghostButton,
              { borderColor: palette.border, marginTop: 16 },
            ]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              Back to notebook
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (entry === null) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="title">Entry not found</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 8 }}>
            It may have been deleted.
          </ThemedText>
          <Pressable
            onPress={() => router.replace('/notebook' as Href)}
            style={[
              styles.ghostButton,
              { borderColor: palette.border, marginTop: 16 },
            ]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              Back to notebook
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (!entry || !user) return null;

  // Defense-in-depth: rules already enforce this, but if for some reason
  // a different user's entry id is loaded, bail before they can edit.
  if (entry.ownerId !== user.uid) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="title">Not your entry</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 8 }}>
            Notebook entries are private to their owner.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  async function handleAddPhotos() {
    if (!user || !entry) return;
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted' && perm.status !== 'undetermined') {
        setError('Photo library permission denied.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;

      setUploading(true);
      const total = result.assets.length;
      const next: NotebookPhoto[] = [...entry.photos];
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        setUploadProgress({ current: i + 1, total });
        const photo = await uploadNotebookPhoto({
          ownerId: user.uid,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
        next.push(photo);
        // Optimistically reflect each upload as it completes.
        setEntry({ ...entry, photos: [...next] });
      }
      await updateNotebookEntry(entry.id, { photos: next });
    } catch (e) {
      console.error('[notebook/detail] photo upload failed', e);
      setError(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleRemovePhoto(photoId: string) {
    if (!entry) return;
    if (typeof window !== 'undefined' && !window.confirm('Remove this photo?')) {
      return;
    }
    setPhotoBusy(photoId);
    try {
      const next = await removePhotoFromEntry(entry, photoId);
      setEntry({ ...entry, photos: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove photo.');
    } finally {
      setPhotoBusy(null);
    }
  }

  async function handleSave() {
    if (!entry) return;
    setError(null);
    setSaving(true);
    try {
      await updateNotebookEntry(entry.id, {
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        vehicleId: vehicleId,
        links: links.length > 0 ? links : undefined,
      });
      setEntry({
        ...entry,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        vehicleId: vehicleId,
        links: links.length > 0 ? links : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this entry?')) {
      return;
    }
    setDeleting(true);
    try {
      await deleteNotebookEntry(entry);
      router.replace('/notebook' as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
      setDeleting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText
            type="eyebrow"
            style={{ color: palette.tint, letterSpacing: 1.6 }}>
            Notebook entry
          </ThemedText>
          <ThemedText type="title">{title.trim() || 'Untitled note'}</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <FormField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Optional"
        />
        <FormField
          label="Note"
          value={body}
          onChangeText={setBody}
          placeholder="Anything you want to remember about this."
          multiline
          numberOfLines={8}
        />

        <View style={styles.section}>
          <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
            Linked vehicle
          </ThemedText>
          <VehicleLinker
            ownerId={user.uid}
            value={vehicleId}
            onChange={setVehicleId}
            palette={palette}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.photosHeader}>
            <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
              Photos
            </ThemedText>
            <Pressable
              onPress={handleAddPhotos}
              disabled={uploading}
              style={[
                styles.secondaryButton,
                { borderColor: palette.tint, opacity: uploading ? 0.6 : 1 },
              ]}>
              {uploading ? (
                <ActivityIndicator color={palette.tint} />
              ) : (
                <ThemedText
                  style={[styles.secondaryButtonText, { color: palette.tint }]}>
                  + Add photos
                </ThemedText>
              )}
            </Pressable>
          </View>
          {uploadProgress ? (
            <ThemedText type="metadata" style={{ color: palette.textMuted }}>
              Uploading {uploadProgress.current} of {uploadProgress.total}…
            </ThemedText>
          ) : null}
          {entry.photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {entry.photos.map((photo) => (
                <View key={photo.id} style={styles.photoTile}>
                  <Image
                    source={{ uri: photo.downloadUrl }}
                    style={styles.photoImage}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => handleRemovePhoto(photo.id)}
                    disabled={photoBusy === photo.id}
                    style={[
                      styles.photoRemove,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                    ]}>
                    {photoBusy === photo.id ? (
                      <ActivityIndicator size="small" color={palette.tint} />
                    ) : (
                      <ThemedText
                        type="metadata"
                        style={{ color: palette.tint, fontWeight: '700' }}>
                        ×
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText type="metadata" style={{ color: palette.placeholder }}>
              No photos yet.
            </ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
            Links
          </ThemedText>
          <NotebookLinksEditor
            links={links}
            onChange={setLinks}
            palette={palette}
          />
        </View>

        {/* Research placeholder — Phase 2 will replace this with an
            actual "Research with AI" button + summary panel. Showing
            it now keeps the UX shape stable so users see where the
            feature is going. */}
        <View
          style={[
            styles.researchCard,
            { borderColor: palette.border, backgroundColor: palette.surfaceDim },
          ]}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            AI research · coming soon
          </ThemedText>
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, marginTop: 6, lineHeight: 20 }}>
            In a future update, you&apos;ll be able to trigger an AI agent to
            scan this entry, search the web, and attach what it finds —
            specs, compatibility, install notes, vendors. Per-entry trigger
            now; periodic scanning later.
          </ThemedText>
        </View>

        {error ? (
          <ThemedText type="metadata" style={{ color: palette.tint, textAlign: 'center' }}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.replace('/notebook' as Href)}
            style={[styles.ghostButton, { borderColor: palette.border }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              Back to notebook
            </ThemedText>
          </Pressable>
          <View style={styles.actionsRight}>
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
                  Delete
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.primaryButton,
                { backgroundColor: palette.tint, opacity: saving ? 0.6 : 1 },
              ]}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Save changes</ThemedText>
              )}
            </Pressable>
          </View>
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
    gap: 18,
    maxWidth: 720,
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
    marginBottom: 4,
  },
  rule: {
    width: 40,
    height: 2,
    marginTop: 6,
  },
  section: {
    gap: 10,
  },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoTile: {
    width: 110,
    height: 110,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  researchCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 12,
  },
  actionsRight: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ghostButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dangerButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
