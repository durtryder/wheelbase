import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
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
import { createNotebookEntry, uploadNotebookPhoto } from '@/services/notebook';
import type { NotebookLink, NotebookPhoto } from '@/types/notebook';

export default function NewNotebookEntryScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [vehicleId, setVehicleId] = useState<string | undefined>(undefined);
  const [photos, setPhotos] = useState<NotebookPhoto[]>([]);
  const [links, setLinks] = useState<NotebookLink[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/sign-in');
    }
  }, [authLoading, user, router]);

  async function handleAddPhotos() {
    if (!user) return;
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
      const uploaded: NotebookPhoto[] = [];
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        setUploadProgress({ current: i + 1, total });
        const photo = await uploadNotebookPhoto({
          ownerId: user.uid,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
        uploaded.push(photo);
        setPhotos((prev) => [...prev, photo]);
      }
      // No-op if everything went through; just keeping a clear shape.
      void uploaded;
    } catch (e) {
      console.error('[notebook/new] photo upload failed', e);
      setError(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (
      !title.trim() &&
      !body.trim() &&
      photos.length === 0 &&
      links.length === 0
    ) {
      setError('Add a title, a note, a photo, or a link before saving.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const id = await createNotebookEntry({
        ownerId: user.uid,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        photos,
        links: links.length > 0 ? links : undefined,
        vehicleId,
      });
      router.replace(`/notebook/${id}` as Href);
    } catch (e) {
      console.error('[notebook/new] save failed', e);
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">New entry</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <FormField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Optional — defaults to the first line of your note"
        />
        <FormField
          label="Note"
          value={body}
          onChangeText={setBody}
          placeholder="What did you see? What are you trying to figure out?"
          multiline
          numberOfLines={8}
        />

        <View style={styles.section}>
          <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
            Linked vehicle
          </ThemedText>
          {user ? (
            <VehicleLinker
              ownerId={user.uid}
              value={vehicleId}
              onChange={setVehicleId}
              palette={palette}
            />
          ) : null}
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
          {photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoTile}>
                  <Image
                    source={{ uri: photo.downloadUrl }}
                    style={styles.photoImage}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() =>
                      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                    }
                    style={[
                      styles.photoRemove,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                    ]}>
                    <ThemedText
                      type="metadata"
                      style={{ color: palette.tint, fontWeight: '700' }}>
                      ×
                    </ThemedText>
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
            onLinkEnriched={(enriched) => {
              // Auto-fill the entry title from the first enriched link,
              // but only if the user hasn't typed one themselves. Never
              // overwrite their input.
              if (!title.trim() && enriched.title?.trim()) {
                setTitle(enriched.title.trim());
              }
            }}
            palette={palette}
          />
        </View>

        {error ? (
          <ThemedText type="metadata" style={{ color: palette.tint, textAlign: 'center' }}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.ghostButton, { borderColor: palette.border }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.textMuted }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={submitting || uploading}
            style={[
              styles.primaryButton,
              {
                backgroundColor: palette.tint,
                opacity: submitting || uploading ? 0.6 : 1,
              },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Save entry</ThemedText>
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
    gap: 18,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: {
    gap: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  rule: {
    width: 40,
    height: 2,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
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
});
