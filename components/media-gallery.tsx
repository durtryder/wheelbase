/**
 * Media gallery inspired by echeng.com, now handling photos and videos:
 *
 *   - Row-justified wall (variable widths, uniform per-row height, tight gutters)
 *   - Videos render a still frame with a play chevron and duration badge
 *   - Hover state dims the thumbnail and surfaces its caption
 *   - Click opens a fullscreen dark lightbox with keyboard navigation
 *   - Owner actions live inside the lightbox: edit caption, set as cover,
 *     remove — keeps the grid visually quiet
 */

import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MediaItem, Vehicle } from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

type Props = {
  media: MediaItem[];
  vehicle: Vehicle;
  isOwner: boolean;
  onSetCover: (mediaId: string) => Promise<void> | void;
  onRemove: (item: MediaItem) => Promise<void> | void;
  onUpdateCaption: (mediaId: string, caption: string) => Promise<void> | void;
  photoActionBusy: string | null;
};

const GAP = 4;
const TARGET_ROW_HEIGHT_WIDE = 220;
const TARGET_ROW_HEIGHT_NARROW = 140;

export function MediaGallery({
  media,
  vehicle,
  isOwner,
  onSetCover,
  onRemove,
  onUpdateCaption,
  photoActionBusy,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { width: windowWidth } = useWindowDimensions();

  const [containerWidth, setContainerWidth] = useState(
    Math.min(900, windowWidth - 48),
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const targetRowHeight =
    windowWidth < 640 ? TARGET_ROW_HEIGHT_NARROW : TARGET_ROW_HEIGHT_WIDE;

  const rows = useMemo(
    () => justifyGrid(media, containerWidth, targetRowHeight, GAP),
    [media, containerWidth, targetRowHeight],
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - containerWidth) > 1) setContainerWidth(w);
  };

  return (
    <View onLayout={handleLayout}>
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={[
            styles.row,
            { marginBottom: rowIdx === rows.length - 1 ? 0 : GAP },
          ]}>
          {row.items.map((item, itemIdx) => {
            const isCover = item.id === vehicle.coverPhotoId;
            const mediaIndex = media.findIndex((m) => m.id === item.id);
            return (
              <Thumbnail
                key={item.id}
                item={item}
                width={item.width}
                height={item.height}
                isCover={isCover}
                onOpen={() => setLightboxIndex(mediaIndex)}
                palette={palette}
                marginRight={itemIdx === row.items.length - 1 ? 0 : GAP}
              />
            );
          })}
        </View>
      ))}

      {lightboxIndex !== null ? (
        <Lightbox
          media={media}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          isOwner={isOwner}
          vehicle={vehicle}
          onSetCover={onSetCover}
          onRemove={onRemove}
          onUpdateCaption={onUpdateCaption}
          photoActionBusy={photoActionBusy}
        />
      ) : null}
    </View>
  );
}

// ---------- Thumbnails ----------

function Thumbnail({
  item,
  width,
  height,
  isCover,
  onOpen,
  palette,
  marginRight,
}: {
  item: MediaItem;
  width: number;
  height: number;
  isCover: boolean;
  onOpen: () => void;
  palette: Palette;
  marginRight: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onOpen}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.thumb,
        {
          width,
          height,
          marginRight,
          opacity: pressed ? 0.95 : 1,
        },
      ]}>
      {item.kind === 'video' ? (
        <VideoThumbnailSurface item={item} />
      ) : (
        <Image
          source={{ uri: item.downloadUrl }}
          style={styles.thumbImage}
          contentFit="cover"
          transition={200}
        />
      )}

      {item.kind === 'video' ? (
        <View style={styles.playOverlay} pointerEvents="none">
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
          {item.durationMs ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(item.durationMs)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {isCover ? (
        <View style={[styles.coverBadge, { backgroundColor: palette.accent }]}>
          <Text style={styles.coverBadgeText}>COVER</Text>
        </View>
      ) : null}

      {hovered ? (
        <View style={styles.hoverOverlay} pointerEvents="none">
          {item.caption ? (
            <View style={styles.hoverCaption}>
              <Text style={styles.hoverCaptionText} numberOfLines={2}>
                {item.caption}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Render the first frame of a video as the thumbnail. expo-video's VideoView
 * shows the first playable frame; we pause the player at creation so we don't
 * autoplay N videos at once.
 */
function VideoThumbnailSurface({ item }: { item: MediaItem }) {
  const player = useVideoPlayer(item.downloadUrl ?? '', (p) => {
    try {
      p.muted = true;
      p.pause();
    } catch {
      /* ignore */
    }
  });

  return (
    <VideoView
      player={player}
      style={styles.thumbImage}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ---------- Lightbox ----------

function Lightbox({
  media,
  index,
  onIndexChange,
  onClose,
  isOwner,
  vehicle,
  onSetCover,
  onRemove,
  onUpdateCaption,
  photoActionBusy,
}: {
  media: MediaItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  isOwner: boolean;
  vehicle: Vehicle;
  onSetCover: (mediaId: string) => Promise<void> | void;
  onRemove: (item: MediaItem) => Promise<void> | void;
  onUpdateCaption: (mediaId: string, caption: string) => Promise<void> | void;
  photoActionBusy: string | null;
}) {
  const item = media[index];
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);

  // Reset caption editor whenever we move to a different item.
  useEffect(() => {
    setEditingCaption(false);
    setCaptionDraft(item?.caption ?? '');
    setSavingCaption(false);
  }, [item?.id]);

  const prev = () => onIndexChange((index - 1 + media.length) % media.length);
  const next = () => onIndexChange((index + 1) % media.length);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      // Don't hijack keys while the user is editing the caption.
      if (editingCaption) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, media.length, editingCaption]);

  if (!item) return null;

  const isCover = item.id === vehicle.coverPhotoId;
  const isBusy = photoActionBusy === item.id;
  const createdAt = formatTimestamp(item.createdAt);

  async function handleSaveCaption() {
    if (savingCaption) return;
    setSavingCaption(true);
    try {
      await onUpdateCaption(item.id, captionDraft);
      setEditingCaption(false);
    } finally {
      setSavingCaption(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={lightboxStyles.backdrop}>
        <Pressable style={lightboxStyles.closeLayer} onPress={onClose} />

        <View style={lightboxStyles.counter} pointerEvents="none">
          <Text style={lightboxStyles.counterText}>
            {index + 1} / {media.length}
          </Text>
        </View>

        <Pressable onPress={onClose} style={lightboxStyles.closeButton}>
          <Text style={lightboxStyles.closeButtonText}>Close</Text>
        </Pressable>

        {media.length > 1 ? (
          <>
            <Pressable onPress={prev} style={[lightboxStyles.navButton, lightboxStyles.navLeft]}>
              <Text style={lightboxStyles.navText}>‹</Text>
            </Pressable>
            <Pressable onPress={next} style={[lightboxStyles.navButton, lightboxStyles.navRight]}>
              <Text style={lightboxStyles.navText}>›</Text>
            </Pressable>
          </>
        ) : null}

        <View style={lightboxStyles.imageWrap} pointerEvents="box-none">
          {item.kind === 'video' ? (
            <LightboxVideo
              key={item.id}
              item={item}
              width={windowWidth * 0.9}
              height={windowHeight * 0.72}
            />
          ) : (
            <Image
              source={{ uri: item.downloadUrl }}
              style={{
                width: windowWidth * 0.9,
                height: windowHeight * 0.72,
              }}
              contentFit="contain"
              transition={250}
            />
          )}
        </View>

        {/* Caption / metadata */}
        <View style={lightboxStyles.captionWrap} pointerEvents="box-none">
          {editingCaption ? (
            <View style={lightboxStyles.captionEditor}>
              <TextInput
                value={captionDraft}
                onChangeText={setCaptionDraft}
                placeholder="Write a caption…"
                placeholderTextColor="#5a564f"
                style={lightboxStyles.captionInput}
                multiline
                numberOfLines={3}
                autoFocus
              />
              <View style={lightboxStyles.captionActions}>
                <Pressable
                  disabled={savingCaption}
                  onPress={() => {
                    setCaptionDraft(item.caption ?? '');
                    setEditingCaption(false);
                  }}
                  style={lightboxStyles.actionButton}>
                  <Text style={lightboxStyles.actionButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={savingCaption}
                  onPress={handleSaveCaption}
                  style={[
                    lightboxStyles.actionButton,
                    { borderColor: '#c9a24a', opacity: savingCaption ? 0.6 : 1 },
                  ]}>
                  {savingCaption ? (
                    <ActivityIndicator color="#f4e4bc" />
                  ) : (
                    <Text style={[lightboxStyles.actionButtonText, { color: '#f4e4bc' }]}>
                      Save caption
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {item.caption ? (
                <Text style={lightboxStyles.caption}>{item.caption}</Text>
              ) : isOwner ? (
                <Pressable onPress={() => setEditingCaption(true)}>
                  <Text style={lightboxStyles.captionPlaceholder}>+ Add a caption</Text>
                </Pressable>
              ) : null}
              <Text style={lightboxStyles.metadata}>
                {[
                  item.kind === 'video' ? 'Video' : null,
                  item.kind === 'video' && item.durationMs
                    ? formatDuration(item.durationMs)
                    : null,
                  createdAt,
                  item.width && item.height ? `${item.width} × ${item.height}` : null,
                  isCover ? 'Cover photo' : null,
                ]
                  .filter(Boolean)
                  .join('    ·    ')}
              </Text>

              {isOwner ? (
                <View style={lightboxStyles.actions}>
                  {item.caption ? (
                    <Pressable
                      onPress={() => setEditingCaption(true)}
                      style={lightboxStyles.actionButton}>
                      <Text style={lightboxStyles.actionButtonText}>Edit caption</Text>
                    </Pressable>
                  ) : null}
                  {!isCover && item.kind === 'photo' ? (
                    <Pressable
                      disabled={isBusy}
                      onPress={() => onSetCover(item.id)}
                      style={lightboxStyles.actionButton}>
                      {isBusy ? (
                        <ActivityIndicator color="#f4e4bc" />
                      ) : (
                        <Text style={lightboxStyles.actionButtonText}>Set as cover</Text>
                      )}
                    </Pressable>
                  ) : null}
                  <Pressable
                    disabled={isBusy}
                    onPress={async () => {
                      await onRemove(item);
                      if (media.length <= 1) {
                        onClose();
                      } else if (index >= media.length - 1) {
                        onIndexChange(Math.max(0, index - 1));
                      }
                    }}
                    style={[lightboxStyles.actionButton, lightboxStyles.dangerAction]}>
                    <Text style={[lightboxStyles.actionButtonText, { color: '#ff8080' }]}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function LightboxVideo({
  item,
  width,
  height,
}: {
  item: MediaItem;
  width: number;
  height: number;
}) {
  const player = useVideoPlayer(item.downloadUrl ?? '', (p) => {
    try {
      p.loop = false;
      p.muted = false;
      p.play();
    } catch {
      /* ignore */
    }
  });

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit="contain"
      nativeControls
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

// ---------- Justified grid algorithm ----------

function justifyGrid(
  items: MediaItem[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number,
): { items: (MediaItem & { width: number; height: number })[] }[] {
  if (containerWidth <= 0 || items.length === 0) return [];

  const rows: { items: (MediaItem & { width: number; height: number })[] }[] = [];
  let current: { item: MediaItem; aspect: number }[] = [];
  let currentScaledWidth = 0;

  const finalizeRow = (rowItems: { item: MediaItem; aspect: number }[], stretch: boolean) => {
    if (!rowItems.length) return;
    const totalAspect = rowItems.reduce((s, r) => s + r.aspect, 0);
    const availableWidth = containerWidth - gap * (rowItems.length - 1);
    const rowHeight = stretch
      ? Math.min(availableWidth / totalAspect, targetRowHeight * 1.35)
      : targetRowHeight;
    rows.push({
      items: rowItems.map((r) => ({
        ...r.item,
        width: Math.round(rowHeight * r.aspect),
        height: Math.round(rowHeight),
      })),
    });
  };

  for (const item of items) {
    const aspect = aspectOf(item);
    const scaledWidth = targetRowHeight * aspect;
    const nextWidth = currentScaledWidth + scaledWidth + (current.length > 0 ? gap : 0);

    if (nextWidth > containerWidth && current.length > 0) {
      finalizeRow(current, true);
      current = [];
      currentScaledWidth = 0;
    }

    current.push({ item, aspect });
    currentScaledWidth += scaledWidth + (current.length > 1 ? gap : 0);
  }

  finalizeRow(current, false);
  return rows;
}

function aspectOf(item: MediaItem): number {
  const w = item.width;
  const h = item.height;
  if (w && h && w > 0 && h > 0) return w / h;
  return 4 / 3;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(ts: MediaItem['createdAt']): string | null {
  if (!ts) return null;
  try {
    const d = typeof (ts as { toDate?: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : (ts as unknown as Date);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  thumb: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#111',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: 20,
    marginLeft: 3,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  coverBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 2,
  },
  coverBadgeText: {
    color: '#1a1a1a',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  hoverCaption: {
    padding: 10,
  },
  hoverCaptionText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
  },
});

const lightboxStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: 20,
    left: 24,
  },
  counterText: {
    color: '#bbb5a6',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  closeButtonText: {
    color: '#f4e4bc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 56,
    height: 80,
    marginTop: -40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: { left: 10 },
  navRight: { right: 10 },
  navText: {
    color: '#f4e4bc',
    fontSize: 48,
    fontWeight: '400',
    lineHeight: 48,
  },
  captionWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  caption: {
    color: '#f4e4bc',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 640,
    lineHeight: 22,
  },
  captionPlaceholder: {
    color: '#8b867a',
    fontSize: 14,
    fontStyle: 'italic',
  },
  metadata: {
    color: '#8b867a',
    fontSize: 12,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  captionEditor: {
    width: '100%',
    maxWidth: 640,
    gap: 10,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#3a3730',
    borderRadius: 4,
    backgroundColor: 'rgba(20,20,20,0.9)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: '#f4e4bc',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  captionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3a3730',
    borderRadius: 3,
  },
  dangerAction: {
    borderColor: '#5a2a2a',
  },
  actionButtonText: {
    color: '#bbb5a6',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
});
