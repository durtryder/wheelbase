/**
 * Photo gallery inspired by echeng.com:
 *
 *   - Row-justified wall (variable widths, uniform per-row height, tight gutters)
 *   - Hover state dims the thumbnail and surfaces its caption
 *   - Click opens a fullscreen dark lightbox with keyboard navigation
 *   - Owners get "Set as cover" / "Remove" actions inside the lightbox (keeps
 *     the grid visually clean)
 */

import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
  photoActionBusy: string | null;
};

const GAP = 4;
const TARGET_ROW_HEIGHT_WIDE = 220;
const TARGET_ROW_HEIGHT_NARROW = 140;

export function PhotoGallery({
  media,
  vehicle,
  isOwner,
  onSetCover,
  onRemove,
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
          photoActionBusy={photoActionBusy}
        />
      ) : null}
    </View>
  );
}

// ---------- Thumbnail ----------

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
      <Image
        source={{ uri: item.downloadUrl }}
        style={styles.thumbImage}
        contentFit="cover"
        transition={200}
      />

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
  photoActionBusy: string | null;
}) {
  const item = media[index];
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const prev = () => onIndexChange((index - 1 + media.length) % media.length);
  const next = () => onIndexChange((index + 1) % media.length);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, media.length]);

  if (!item) return null;

  const isCover = item.id === vehicle.coverPhotoId;
  const isBusy = photoActionBusy === item.id;
  const createdAt = formatTimestamp(item.createdAt);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={lightboxStyles.backdrop}>
        {/* Close-on-background-click */}
        <Pressable style={lightboxStyles.closeLayer} onPress={onClose} />

        {/* Counter */}
        <View style={lightboxStyles.counter} pointerEvents="none">
          <Text style={lightboxStyles.counterText}>
            {index + 1} / {media.length}
          </Text>
        </View>

        {/* Close button */}
        <Pressable onPress={onClose} style={lightboxStyles.closeButton}>
          <Text style={lightboxStyles.closeButtonText}>Close</Text>
        </Pressable>

        {/* Prev / Next */}
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

        {/* Image */}
        <View style={lightboxStyles.imageWrap} pointerEvents="box-none">
          <Image
            source={{ uri: item.downloadUrl }}
            style={{
              width: windowWidth * 0.9,
              height: windowHeight * 0.78,
            }}
            contentFit="contain"
            transition={250}
          />
        </View>

        {/* Caption / metadata */}
        <View style={lightboxStyles.captionWrap} pointerEvents="box-none">
          {item.caption ? (
            <Text style={lightboxStyles.caption}>{item.caption}</Text>
          ) : null}
          <Text style={lightboxStyles.metadata}>
            {[
              createdAt,
              item.width && item.height ? `${item.width} × ${item.height}` : null,
              isCover ? 'Cover photo' : null,
            ]
              .filter(Boolean)
              .join('    ·    ')}
          </Text>

          {isOwner ? (
            <View style={lightboxStyles.actions}>
              {!isCover ? (
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
                  // Close if we removed the last item, else show the previous
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
        </View>
      </View>
    </Modal>
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
      ? Math.min(availableWidth / totalAspect, targetRowHeight * 1.35) // cap vertical stretching
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

  // Last partial row — don't stretch, keep target height
  finalizeRow(current, false);
  return rows;
}

function aspectOf(item: MediaItem): number {
  const w = item.width;
  const h = item.height;
  if (w && h && w > 0 && h > 0) return w / h;
  return 4 / 3;
}

function formatTimestamp(ts: MediaItem['createdAt']): string | null {
  if (!ts) return null;
  // Firestore Timestamp has toDate(); handle both that and already-hydrated Date.
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
    gap: 6,
  },
  caption: {
    color: '#f4e4bc',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 640,
  },
  metadata: {
    color: '#8b867a',
    fontSize: 12,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 14,
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
    color: '#f4e4bc',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
});
