import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BuildSheetDisplay } from '@/components/build-sheet-display';
import { DocumentList } from '@/components/document-list';
import { MediaGallery } from '@/components/media-gallery';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  deleteMediaItem,
  setVehicleCoverPhoto,
  updateMediaCaption,
  uploadVehicleMedia,
  watchMediaForVehicle,
} from '@/services/media';
import { deleteVehicle, getVehicle, updateVehicle } from '@/services/vehicles';
import {
  VISIBILITY_LABELS,
  type MediaItem,
  type Modification,
  type OemSpecs,
  type OwnershipEntry,
  type Vehicle,
  type Visibility,
} from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    uploaded: number;
    totalBytes: number;
  } | null>(null);
  const [photoActionBusy, setPhotoActionBusy] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setError(null);
    getVehicle(id)
      .then((v) => {
        if (!cancelled) setVehicle(v);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load vehicle.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setMediaError(null);
    const unsub = watchMediaForVehicle(
      id,
      (items) => setMedia(items),
      (e) => setMediaError(e.message),
    );
    return unsub;
  }, [id]);

  // Silent backfill: when the owner views one of their vehicles that was
  // saved before we started tracking ownerDisplayName (or when they changed
  // their display name since the last save), write the current name in.
  // Fire-and-forget — failures are logged only.
  useEffect(() => {
    if (!id || !vehicle || !user) return;
    if (vehicle.ownerId !== user.uid) return;
    const currentName = user.displayName?.trim() || '';
    const storedName = vehicle.ownerDisplayName?.trim() || '';
    if (!currentName || currentName === storedName) return;
    updateVehicle(id, { ownerDisplayName: currentName })
      .then(() => {
        setVehicle((prev) =>
          prev ? { ...prev, ownerDisplayName: currentName } : prev,
        );
      })
      .catch((err) => {
        console.warn('[detail] ownerDisplayName backfill failed', err);
      });
  }, [id, vehicle, user]);

  const coverMedia = useMemo(() => {
    if (!vehicle) return null;
    if (vehicle.coverPhotoId) {
      return media.find((m) => m.id === vehicle.coverPhotoId) ?? null;
    }
    return media[0] ?? null;
  }, [vehicle, media]);

  async function handleDelete() {
    if (!id) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this vehicle? This cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      // Best-effort: remove media objects too so we don't orphan storage.
      await Promise.allSettled(media.map((m) => deleteMediaItem(m)));
      await deleteVehicle(id);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddMedia() {
    if (!user || !id) return;
    setMediaError(null);

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted' && perm.status !== 'undetermined') {
        setMediaError('Photo library permission denied.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;

      setUploading(true);
      let firstPhotoId: string | null = null;
      const total = result.assets.length;
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const isVideo =
          asset.type === 'video' ||
          (asset.mimeType?.startsWith('video/') ?? false);
        setUploadProgress({ current: i + 1, total, uploaded: 0, totalBytes: 0 });
        const item = await uploadVehicleMedia({
          kind: isVideo ? 'video' : 'photo',
          ownerId: user.uid,
          vehicleId: id,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          durationMs: isVideo && asset.duration ? asset.duration : undefined,
          onProgress: (uploaded, totalBytes) =>
            setUploadProgress({ current: i + 1, total, uploaded, totalBytes }),
        });
        if (!isVideo && !firstPhotoId) firstPhotoId = item.id;

        // Optimistically insert into the gallery so the user sees it
        // immediately. When onSnapshot catches up it replaces the whole
        // array with the authoritative list — which contains the same
        // item — so there's no duplicate or flicker.
        setMedia((prev) =>
          prev.some((m) => m.id === item.id) ? prev : [...prev, item],
        );
      }

      // If the vehicle doesn't have a cover photo yet, promote the first
      // uploaded photo. (Videos can't be covers until we render a still.)
      if (vehicle && !vehicle.coverPhotoId && firstPhotoId) {
        await setVehicleCoverPhoto(id, firstPhotoId);
        setVehicle({ ...vehicle, coverPhotoId: firstPhotoId });
      }
    } catch (e) {
      console.error('[detail] upload flow failed', e);
      setMediaError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleSetCover(mediaId: string) {
    if (!id || !vehicle) return;
    setPhotoActionBusy(mediaId);
    try {
      await setVehicleCoverPhoto(id, mediaId);
      setVehicle({ ...vehicle, coverPhotoId: mediaId });
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : 'Could not set cover.');
    } finally {
      setPhotoActionBusy(null);
    }
  }

  async function handleUpdateCaption(mediaId: string, caption: string) {
    await updateMediaCaption(mediaId, caption);
    // Optimistic local patch so the lightbox shows the new caption without
    // waiting on the onSnapshot round-trip.
    setMedia((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, caption } : m)),
    );
  }

  async function handleRemovePhoto(item: MediaItem) {
    if (!id || !vehicle) return;
    if (typeof window !== 'undefined' && !window.confirm('Remove this photo?')) return;
    setPhotoActionBusy(item.id);
    try {
      await deleteMediaItem(item);
      if (vehicle.coverPhotoId === item.id) {
        const next = media.find((m) => m.id !== item.id)?.id ?? null;
        await setVehicleCoverPhoto(id, next);
        setVehicle({ ...vehicle, coverPhotoId: next ?? undefined });
      }
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : 'Remove failed.');
    } finally {
      setPhotoActionBusy(null);
    }
  }

  if (vehicle === undefined && !error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.tint} />
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Something went wrong</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.tint }}>
            {error}
          </ThemedText>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => router.replace('/')}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
                Back to garage
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  if (vehicle === null) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Vehicle not found</ThemedText>
          <ThemedText type="metadata" style={{ color: palette.textMuted }}>
            This vehicle may have been deleted or is private.
          </ThemedText>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => router.replace('/')}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
                Back to garage
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  const v = vehicle!;
  const isOwner = !!user && user.uid === v.ownerId;
  const title = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');

  const coverIndex = coverMedia ? media.findIndex((m) => m.id === coverMedia.id) : -1;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => {
            if (coverIndex >= 0) setLightboxIndex(coverIndex);
          }}
          disabled={coverIndex < 0}
          style={({ pressed, hovered }) => [
            styles.hero,
            {
              backgroundColor: palette.surfaceDim,
              borderColor: palette.border,
              opacity: coverIndex >= 0 && pressed ? 0.94 : 1,
              ...(coverIndex >= 0 && hovered
                ? ({ cursor: 'pointer' } as object)
                : {}),
            },
          ]}>
          {coverMedia ? (
            <Image
              source={{ uri: coverMedia.downloadUrl }}
              style={styles.heroImage}
              contentFit="cover"
            />
          ) : (
            <ThemedText type="eyebrow" style={{ color: palette.placeholder, letterSpacing: 2 }}>
              No photo yet
            </ThemedText>
          )}
        </Pressable>

        <View style={styles.titleBlock}>
          {v.nickname ? (
            <ThemedText type="eyebrow" style={{ color: palette.tint }}>
              {v.nickname}
            </ThemedText>
          ) : null}
          <ThemedText type="title">{title}</ThemedText>
          <Pressable
            onPress={() => router.push(`/u/${v.ownerId}`)}
            style={({ hovered }) => [
              { marginTop: 2, alignSelf: 'flex-start' },
              hovered ? ({ cursor: 'pointer' } as object) : null,
            ]}>
            <ThemedText
              type="metadata"
              style={{ color: palette.textMuted }}>
              by{' '}
              <ThemedText
                type="metadata"
                style={{ color: palette.tint, fontWeight: '600' }}>
                {v.ownerDisplayName?.trim() || 'a Wheelbase member'}
              </ThemedText>
            </ThemedText>
          </Pressable>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />

          {/* Visibility + share badge — visible to everyone, action is owner-only */}
          <View style={styles.shareRow}>
            <VisibilityPill visibility={v.visibility} palette={palette} />
            {v.visibility !== 'private' ? (
              <ShareButton vehicleId={v.id} palette={palette} />
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.headlineStats,
            { borderColor: palette.border },
          ]}>
          <HeadlineStat label="Mileage" value={formatMileage(v.mileage)} palette={palette} />
          <HeadlineDivider color={palette.border} />
          <HeadlineStat label="Exterior" value={v.exteriorColor ?? '—'} palette={palette} />
          <HeadlineDivider color={palette.border} />
          <HeadlineStat label="Interior" value={v.interiorColor ?? '—'} palette={palette} />
          <HeadlineDivider color={palette.border} />
          <HeadlineStat
            label="Location"
            value={formatLocation(v.location) ?? '—'}
            palette={palette}
          />
        </View>

        {v.story?.trim() ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">The Story</ThemedText>
              <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
            </View>
            <ThemedText type="default" style={styles.storyBody}>
              {v.story.trim()}
            </ThemedText>
          </View>
        ) : null}

        <Section title="Vehicle Overview" palette={palette}>
          <DetailRow label="Year" value={String(v.year)} palette={palette} />
          <DetailRow label="Make" value={v.make} palette={palette} />
          <DetailRow label="Model" value={v.model} palette={palette} />
          {v.trim ? <DetailRow label="Trim" value={v.trim} palette={palette} /> : null}
          {v.vin ? <DetailRow label="VIN" value={v.vin} palette={palette} /> : null}
          {v.chassisNumber ? (
            <DetailRow label="Chassis Number" value={v.chassisNumber} palette={palette} />
          ) : null}
          {v.titleStatus ? (
            <DetailRow label="Title Status" value={v.titleStatus} palette={palette} />
          ) : null}
        </Section>

        <VehicleDetailsSection vehicle={v} palette={palette} isOwner={isOwner} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Build Sheet</ThemedText>
            <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
          </View>
          <BuildSheetDisplay buildSheet={v.buildSheet} isOwner={isOwner} />
        </View>

        {v.oemSpecs ? (
          <Section title={`OEM Specifications (${sourceName(v.oemSpecs.source)})`} palette={palette}>
            <DetailRow label="Body Class" value={v.oemSpecs.bodyClass} palette={palette} />
            <DetailRow
              label="Cylinders"
              value={v.oemSpecs.engineCylinders?.toString()}
              palette={palette}
            />
            <DetailRow
              label="Displacement"
              value={formatDisplacement(v.oemSpecs.displacementCc, v.oemSpecs.displacementCi)}
              palette={palette}
            />
            <DetailRow label="Fuel Type" value={v.oemSpecs.fuelType} palette={palette} />
            <DetailRow label="Drivetrain" value={v.oemSpecs.driveType} palette={palette} />
            <DetailRow
              label="Transmission"
              value={formatTransmission(
                v.oemSpecs.transmissionStyle,
                v.oemSpecs.transmissionSpeeds,
              )}
              palette={palette}
            />
            <DetailRow
              label="Plant"
              value={formatPlant(
                v.oemSpecs.plantCity,
                v.oemSpecs.plantState,
                v.oemSpecs.plantCountry,
              )}
              palette={palette}
            />
            <DetailRow label="Manufacturer" value={v.oemSpecs.manufacturer} palette={palette} />
            <DetailRow label="Vehicle Type" value={v.oemSpecs.vehicleType} palette={palette} />
          </Section>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText type="subtitle">Photos &amp; Videos</ThemedText>
              {isOwner ? (
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
                      {media.length === 0 ? 'Add photos or videos' : 'Add more'}
                    </ThemedText>
                  )}
                </Pressable>
              ) : null}
            </View>
            <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
          </View>

          {uploadProgress ? (
            <ThemedText type="metadata" style={{ color: palette.textMuted }}>
              Uploading {uploadProgress.current} of {uploadProgress.total}
              {uploadProgress.totalBytes > 0
                ? ` · ${formatBytes(uploadProgress.uploaded)} / ${formatBytes(
                    uploadProgress.totalBytes,
                  )}`
                : ''}
            </ThemedText>
          ) : null}

          {mediaError ? (
            <ThemedText type="metadata" style={{ color: palette.tint }}>
              {mediaError}
            </ThemedText>
          ) : null}

          {media.length === 0 ? (
            <ThemedText type="metadata" style={{ color: palette.placeholder }}>
              {isOwner
                ? 'No media yet. Add photos or videos to bring this build to life.'
                : 'No media yet.'}
            </ThemedText>
          ) : (
            <MediaGallery
              media={media}
              vehicle={v}
              isOwner={isOwner}
              onSetCover={handleSetCover}
              onRemove={handleRemovePhoto}
              onUpdateCaption={handleUpdateCaption}
              photoActionBusy={photoActionBusy}
              openIndex={lightboxIndex}
              onOpenChange={setLightboxIndex}
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Documentation</ThemedText>
            <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
          </View>
          <ThemedText type="metadata" style={{ color: palette.textMuted }}>
            Service records, shop invoices, awards, build sheets, Marti reports
            — any paperwork worth keeping with the car.
          </ThemedText>
          <DocumentList vehicleId={v.id} ownerId={v.ownerId} isOwner={isOwner} />
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => (user ? router.replace('/') : router.replace('/feed'))}
            style={[styles.ghostButton, { borderColor: palette.border }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              {user ? 'Back to garage' : 'Back to feed'}
            </ThemedText>
          </Pressable>
          {isOwner ? (
            <View style={styles.ownerActions}>
              <Pressable
                onPress={() => router.push(`/vehicles/edit/${v.id}`)}
                style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
                <ThemedText style={styles.primaryButtonText}>Edit vehicle</ThemedText>
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
                    Delete vehicle
                  </ThemedText>
                )}
              </Pressable>
            </View>
          ) : !user ? (
            // Anonymous visitor CTA — encourage sign-up to build their own.
            <Pressable
              onPress={() => router.push('/sign-in')}
              style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <ThemedText style={styles.primaryButtonText}>
                Start your own garage
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: Palette;
  children: React.ReactNode;
}) {
  const filtered = filterNonEmpty(children);
  if (filtered.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
      </View>
      <View style={[styles.detailTable, { borderColor: palette.border }]}>{filtered}</View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string | undefined;
  palette: Palette;
}) {
  if (!value) return null;
  return (
    <View style={[styles.detailRow, { borderBottomColor: palette.border }]}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted, flex: 1, maxWidth: 200 }}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={{ flex: 2, textAlign: 'right' }}>
        {value}
      </ThemedText>
    </View>
  );
}

function HeadlineStat({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: Palette;
}) {
  return (
    <View style={styles.headlineStat}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={{ marginTop: 4, fontWeight: '600' }}>
        {value}
      </ThemedText>
    </View>
  );
}

function HeadlineDivider({ color }: { color: string }) {
  return <View style={[styles.headlineDivider, { backgroundColor: color }]} />;
}

function filterNonEmpty(children: React.ReactNode) {
  const arr = Array.isArray(children) ? children : [children];
  return arr.filter(Boolean);
}

function formatMileage(m: number | undefined) {
  if (m == null) return '—';
  return `${m.toLocaleString()} mi`;
}

function formatLocation(loc: Vehicle['location']): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.stateRegion, loc.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function formatDisplacement(cc: number | undefined, ci: number | undefined) {
  if (cc) return `${(cc / 1000).toFixed(1)}L (${Math.round(cc)} cc)`;
  if (ci) return `${ci} CI`;
  return undefined;
}

function formatTransmission(style: string | undefined, speeds: number | undefined) {
  if (style && speeds) return `${speeds}-speed ${style}`;
  return style || (speeds ? `${speeds}-speed` : undefined);
}

function formatPlant(city?: string, state?: string, country?: string) {
  const parts = [city, state, country].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function sourceName(source: OemSpecs['source']) {
  switch (source) {
    case 'vpic':
      return 'NHTSA vPIC';
    case 'wikidata':
      return 'Wikidata';
    case 'carquery':
      return 'CarQuery';
    case 'manual':
      return 'Manual';
    default:
      return 'External';
  }
}

// ---------- Visibility pill + Share ----------

function VisibilityPill({
  visibility,
  palette,
}: {
  visibility: Visibility;
  palette: Palette;
}) {
  const styling: Record<Visibility, { bg: string; fg: string }> = {
    private: { bg: palette.surfaceDim, fg: palette.textMuted },
    unlisted: { bg: '#f4e4bc', fg: '#5a4a1a' },
    public: { bg: palette.tint, fg: '#fff' },
  };
  const s = styling[visibility];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <ThemedText
        type="metadata"
        style={{ color: s.fg, fontWeight: '700', letterSpacing: 1.2 }}>
        {VISIBILITY_LABELS[visibility].toUpperCase()}
      </ThemedText>
    </View>
  );
}

function ShareButton({
  vehicleId,
  palette,
}: {
  vehicleId: string;
  palette: Palette;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/vehicles/${vehicleId}`;
    try {
      navigator.clipboard?.writeText?.(url).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        () => {
          // Fallback — show the URL so the user can copy manually.
          window.prompt('Copy this link:', url);
        },
      );
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <Pressable
      onPress={copyLink}
      style={[styles.shareButton, { borderColor: palette.border }]}>
      <ThemedText type="metadata" style={{ color: palette.text, fontWeight: '600' }}>
        {copied ? '✓ Link copied' : 'Share link'}
      </ThemedText>
    </Pressable>
  );
}

// ---------- Vehicle Details (read view) ----------

function VehicleDetailsSection({
  vehicle,
  palette,
  isOwner,
}: {
  vehicle: Vehicle;
  palette: Palette;
  isOwner: boolean;
}) {
  const builder = vehicle.builder;
  const mods = vehicle.modifications ?? [];
  const owners = vehicle.ownershipHistory ?? [];

  const hasAnything =
    !!builder?.name ||
    !!builder?.location ||
    !!builder?.notes ||
    mods.length > 0 ||
    owners.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle">Vehicle Details</ThemedText>
        <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
      </View>

      {!hasAnything ? (
        <ThemedText type="metadata" style={{ color: palette.placeholder }}>
          {isOwner
            ? 'Add builder, modifications, and ownership history from the Edit vehicle page.'
            : 'No build details have been added yet.'}
        </ThemedText>
      ) : null}

      {builder && (builder.name || builder.location || builder.notes) ? (
        <View style={styles.subSection}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            Builder
          </ThemedText>
          <View style={[styles.detailTable, { borderColor: palette.border, marginTop: 8 }]}>
            <DetailRow label="Builder" value={builder.name} palette={palette} />
            <DetailRow label="Location" value={builder.location} palette={palette} />
            <DetailRow
              label="Build Date"
              value={formatDate(builder.date)}
              palette={palette}
            />
            <DetailRow label="Notes" value={builder.notes} palette={palette} />
          </View>
        </View>
      ) : null}

      {mods.length > 0 ? (
        <View style={styles.subSection}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            Modifications
          </ThemedText>
          <View style={styles.buildCards}>
            {mods.map((m) => (
              <ModificationCard key={m.id} mod={m} palette={palette} />
            ))}
          </View>
        </View>
      ) : null}

      {owners.length > 0 ? (
        <View style={styles.subSection}>
          <ThemedText type="eyebrow" style={{ color: palette.tint }}>
            Ownership History
          </ThemedText>
          <View style={styles.buildCards}>
            {owners.map((o) => (
              <OwnershipCard key={o.id} entry={o} palette={palette} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ModificationCard({ mod, palette }: { mod: Modification; palette: Palette }) {
  const date = formatDate(mod.installedAt);
  const mileage = mod.mileageAtInstall != null ? `${mod.mileageAtInstall.toLocaleString()} mi` : null;
  const cost = mod.cost != null ? `$${mod.cost.toLocaleString()}` : null;
  const subline = [date, mileage, cost, mod.vendor].filter(Boolean).join('  ·  ');

  return (
    <View style={[styles.buildCard, { borderColor: palette.border }]}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
        {formatCategory(mod.category)}
      </ThemedText>
      <ThemedText type="defaultSemiBold" style={{ marginTop: 2 }}>
        {mod.title || '(untitled modification)'}
      </ThemedText>
      {mod.description ? (
        <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 4 }}>
          {mod.description}
        </ThemedText>
      ) : null}
      {subline ? (
        <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 8 }}>
          {subline}
        </ThemedText>
      ) : null}
    </View>
  );
}

function OwnershipCard({
  entry,
  palette,
}: {
  entry: OwnershipEntry;
  palette: Palette;
}) {
  const acquired = formatDate(entry.acquiredAt);
  const relinquished = formatDate(entry.relinquishedAt);
  const span =
    acquired && relinquished
      ? `${acquired} – ${relinquished}`
      : acquired
        ? `Acquired ${acquired}`
        : relinquished
          ? `Relinquished ${relinquished}`
          : null;
  const loc = formatLocation(entry.location);
  const subline = [span, loc].filter(Boolean).join('  ·  ');

  return (
    <View style={[styles.buildCard, { borderColor: palette.border }]}>
      <ThemedText type="defaultSemiBold">
        {entry.ownerName || '(Unnamed owner)'}
      </ThemedText>
      {subline ? (
        <ThemedText type="metadata" style={{ color: palette.textMuted, marginTop: 6 }}>
          {subline}
        </ThemedText>
      ) : null}
      {entry.notes ? (
        <ThemedText type="default" style={{ color: palette.textMuted, marginTop: 6 }}>
          {entry.notes}
        </ThemedText>
      ) : null}
    </View>
  );
}

function formatDate(ts: Modification['installedAt']): string | undefined {
  if (!ts) return undefined;
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : (ts as unknown as Date);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return undefined;
  }
}

function formatCategory(c: Modification['category']): string {
  switch (c) {
    case 'engine':
      return 'Engine';
    case 'drivetrain':
      return 'Drivetrain';
    case 'suspension':
      return 'Suspension';
    case 'brakes':
      return 'Brakes';
    case 'wheels-tires':
      return 'Wheels & Tires';
    case 'exterior':
      return 'Exterior';
    case 'interior':
      return 'Interior';
    case 'audio-electronics':
      return 'Audio / Electronics';
    default:
      return 'Other';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 72,
    gap: 40,
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
  hero: {
    aspectRatio: 3 / 2,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    gap: 10,
    alignItems: 'flex-start',
  },
  rule: {
    width: 56,
    height: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  headlineStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  headlineStat: {
    flex: 1,
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  headlineDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 18,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionRule: {
    height: 1,
    width: '100%',
  },
  detailTable: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  subSection: {
    marginTop: 18,
    gap: 8,
  },
  buildCards: {
    gap: 10,
    marginTop: 6,
  },
  buildCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
  },
  storyBody: {
    fontSize: 17,
    lineHeight: 28,
    maxWidth: 680,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  shareButton: {
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  ghostButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 9,
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
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
