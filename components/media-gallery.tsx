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
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
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
  /**
   * Optional controlled lightbox state. If `openIndex` is provided, the
   * parent owns the value and the gallery won't keep its own copy. Useful
   * for opening the lightbox from outside the gallery (e.g., the hero).
   */
  openIndex?: number | null;
  onOpenChange?: (index: number | null) => void;
  /**
   * When set, only the first N justified rows render until the user taps
   * "Show more". Matches the echeng editorial style — the grid stays
   * digestible, but a single tap unlocks the full wall. Set to
   * `Infinity` to disable collapsing. Defaults to 3.
   */
  collapsedRowLimit?: number;
};

const GAP = 4;
const TARGET_ROW_HEIGHT_WIDE = 220;
const TARGET_ROW_HEIGHT_NARROW = 140;
const DEFAULT_COLLAPSED_ROWS = 3;

export function MediaGallery({
  media,
  vehicle,
  isOwner,
  onSetCover,
  onRemove,
  onUpdateCaption,
  photoActionBusy,
  openIndex,
  onOpenChange,
  collapsedRowLimit = DEFAULT_COLLAPSED_ROWS,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { width: windowWidth } = useWindowDimensions();

  const [containerWidth, setContainerWidth] = useState(
    Math.min(900, windowWidth - 48),
  );
  const [internalIndex, setInternalIndex] = useState<number | null>(null);
  const [fullGalleryOpen, setFullGalleryOpen] = useState(false);
  const controlled = openIndex !== undefined;
  const lightboxIndex = controlled ? (openIndex ?? null) : internalIndex;
  const setLightboxIndex = (idx: number | null) => {
    if (!controlled) setInternalIndex(idx);
    onOpenChange?.(idx);
  };

  const targetRowHeight =
    windowWidth < 640 ? TARGET_ROW_HEIGHT_NARROW : TARGET_ROW_HEIGHT_WIDE;

  const rows = useMemo(
    () => justifyGrid(media, containerWidth, targetRowHeight, GAP),
    [media, containerWidth, targetRowHeight],
  );

  // The detail page always shows at most `collapsedRowLimit` rows — tapping
  // Show More opens a separate full-screen dark modal rather than expanding
  // in place. Keeps the editorial page tidy and lets the full wall live
  // against the same black ground as the lightbox.
  const canCollapse =
    Number.isFinite(collapsedRowLimit) && rows.length > collapsedRowLimit;
  const visibleRows = canCollapse ? rows.slice(0, collapsedRowLimit) : rows;
  const hiddenCount = canCollapse
    ? rows.slice(collapsedRowLimit).reduce((sum, r) => sum + r.items.length, 0)
    : 0;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - containerWidth) > 1) setContainerWidth(w);
  };

  return (
    <View onLayout={handleLayout}>
      {visibleRows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={[
            styles.row,
            { marginBottom: rowIdx === visibleRows.length - 1 ? 0 : GAP },
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

      {canCollapse ? (
        <View style={styles.showMoreWrap}>
          <Pressable
            onPress={() => setFullGalleryOpen(true)}
            style={({ hovered, pressed }) => [
              styles.showMoreButton,
              { borderColor: palette.border },
              {
                opacity: pressed ? 0.75 : 1,
                ...(hovered ? ({ cursor: 'pointer' } as object) : {}),
              },
            ]}>
            <Text style={[styles.showMoreText, { color: palette.text }]}>
              Show all {media.length} · {hiddenCount} more
            </Text>
            <Text style={[styles.showMoreChevron, { color: palette.text }]}>⌄</Text>
          </Pressable>
        </View>
      ) : null}

      {fullGalleryOpen ? (
        <FullGalleryModal
          media={media}
          vehicle={vehicle}
          onClose={() => setFullGalleryOpen(false)}
          onOpenLightbox={(idx) => setLightboxIndex(idx)}
          palette={palette}
        />
      ) : null}

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

// ---------- Full gallery modal ----------

/**
 * Fullscreen dark overlay modeled on echeng.com's "photo of the day"
 * pattern: the cover photo gets hero treatment at the top with its
 * metadata beside (or below, on narrow screens), and the remaining
 * media flows in a justified grid underneath.
 *
 * Tapping any photo — hero or tile — opens the lightbox on top. The
 * user can dismiss the lightbox to keep browsing, then dismiss the
 * wall to return to the detail page. Escape closes on web.
 */
function FullGalleryModal({
  media,
  vehicle,
  onClose,
  onOpenLightbox,
  palette,
}: {
  media: MediaItem[];
  vehicle: Vehicle;
  onClose: () => void;
  onOpenLightbox: (index: number) => void;
  palette: Palette;
}) {
  const { width: windowWidth } = useWindowDimensions();
  // Reserve a bit of horizontal padding on every device so thumbs never
  // butt against the screen edge. Tighter on narrow screens.
  const horizontalPadding = windowWidth < 640 ? 12 : 24;
  const gridWidth = Math.max(0, windowWidth - horizontalPadding * 2);
  const isWide = windowWidth >= 900;
  // The fullscreen gallery wants larger thumbs than the inline preview —
  // give each row more height so photography can breathe.
  const targetRowHeight = windowWidth < 640 ? 160 : 220;

  // Pick the vehicle's chosen cover; fall back to first media item if
  // no cover has been designated (e.g., videos-only vehicle).
  const heroItem = useMemo(
    () =>
      media.find((m) => m.id === vehicle.coverPhotoId) ?? media[0] ?? null,
    [media, vehicle.coverPhotoId],
  );
  const heroIndex = heroItem
    ? media.findIndex((m) => m.id === heroItem.id)
    : -1;
  const restMedia = useMemo(
    () => (heroItem ? media.filter((m) => m.id !== heroItem.id) : media),
    [media, heroItem],
  );

  const rows = useMemo(
    () => justifyGrid(restMedia, gridWidth, targetRowHeight, GAP),
    [restMedia, gridWidth, targetRowHeight],
  );

  // Hero layout: echeng-style 7:3 split on wide, stacked on narrow.
  // Heights are generous so the image reads as a true hero without
  // eating the whole viewport.
  const heroPhotoWidth = isWide
    ? Math.round(gridWidth * 0.68)
    : gridWidth;
  const heroPhotoHeight = isWide
    ? Math.min(540, Math.round(windowWidth * 0.42))
    : Math.min(400, Math.round(windowWidth * 0.65));
  const heroMetaWidth = isWide
    ? Math.max(0, gridWidth - heroPhotoWidth - 24)
    : gridWidth;

  const heroIsCover = heroItem?.id === vehicle.coverPhotoId;
  const heroDate = heroItem ? formatDateForItem(heroItem) : null;
  const heroCamera = heroItem ? formatCameraLine(heroItem.exif) : null;
  const heroExposure = heroItem ? formatExposureLine(heroItem.exif) : null;
  const heroVehicleTitle = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(' ');

  // Escape to close (web only).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={fullGalleryStyles.backdrop}>
        <View style={fullGalleryStyles.topBar}>
          <View style={fullGalleryStyles.topBarLeft}>
            <Text style={fullGalleryStyles.topBarEyebrow}>
              {heroVehicleTitle || 'Gallery'}
            </Text>
            <Text style={fullGalleryStyles.topBarCount}>
              {media.length} {media.length === 1 ? 'photo' : 'photos'}
            </Text>
          </View>
          <Pressable onPress={onClose} style={fullGalleryStyles.closeButton}>
            <Text style={fullGalleryStyles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            fullGalleryStyles.scrollContent,
            { paddingHorizontal: horizontalPadding },
          ]}
          showsVerticalScrollIndicator={false}>
          {heroItem ? (
            <View
              style={[
                fullGalleryStyles.hero,
                isWide ? fullGalleryStyles.heroRow : fullGalleryStyles.heroCol,
              ]}>
              <Pressable
                onPress={() =>
                  heroIndex >= 0 ? onOpenLightbox(heroIndex) : null
                }
                style={({ hovered, pressed }) => [
                  {
                    width: heroPhotoWidth,
                    height: heroPhotoHeight,
                    backgroundColor: '#050505',
                    opacity: pressed ? 0.95 : 1,
                    ...(hovered ? ({ cursor: 'pointer' } as object) : {}),
                  },
                ]}>
                {heroItem.kind === 'video' ? (
                  <VideoThumbnailSurface item={heroItem} />
                ) : (
                  <Image
                    source={{ uri: heroItem.downloadUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={250}
                  />
                )}
                {heroItem.kind === 'video' ? (
                  <View style={styles.playOverlay} pointerEvents="none">
                    <View style={styles.playButton}>
                      <Text style={styles.playIcon}>▶</Text>
                    </View>
                  </View>
                ) : null}
              </Pressable>

              <View
                style={[
                  fullGalleryStyles.heroMeta,
                  { width: heroMetaWidth },
                  isWide ? null : fullGalleryStyles.heroMetaStacked,
                ]}>
                <Text style={fullGalleryStyles.heroEyebrow}>
                  {heroIsCover ? 'Cover photo' : 'Featured'}
                </Text>
                {heroItem.caption ? (
                  <Text style={fullGalleryStyles.heroTitle}>
                    {heroItem.caption}
                  </Text>
                ) : (
                  <Text style={fullGalleryStyles.heroTitle}>
                    {heroVehicleTitle || 'Gallery'}
                  </Text>
                )}
                {heroItem.caption && heroVehicleTitle ? (
                  <Text style={fullGalleryStyles.heroBody}>
                    {heroVehicleTitle}
                  </Text>
                ) : null}
                {heroDate ? (
                  <Text style={fullGalleryStyles.heroMetaLine}>{heroDate}</Text>
                ) : null}
                {heroCamera ? (
                  <Text style={fullGalleryStyles.heroMetaLine}>
                    {heroCamera}
                  </Text>
                ) : null}
                {heroExposure ? (
                  <Text style={fullGalleryStyles.heroMetaLine}>
                    {heroExposure}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {restMedia.length > 0 ? (
            <View style={fullGalleryStyles.gridBlock}>
              <Text style={fullGalleryStyles.gridEyebrow}>
                {restMedia.length === 1
                  ? '1 more photo'
                  : `${restMedia.length} more photos`}
              </Text>
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
                        onOpen={() => onOpenLightbox(mediaIndex)}
                        palette={palette}
                        marginRight={itemIdx === row.items.length - 1 ? 0 : GAP}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
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

  // Touch swipe: left = next, right = prev, down = close. Horizontal must
  // outrun vertical by a small margin so scrolling the caption area on
  // mobile doesn't flip photos. The responder defers to child touches
  // (buttons, video controls) unless the gesture is clearly a swipe.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !editingCaption &&
          (Math.abs(g.dx) > 12 || Math.abs(g.dy) > 24) &&
          Math.abs(g.dx) > Math.abs(g.dy) * 0.8,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderRelease: (_, g) => {
          const { dx, dy } = g;
          // Downward swipe (|dy| significantly greater than |dx|) → close.
          if (dy > 120 && Math.abs(dy) > Math.abs(dx) * 1.5) {
            onClose();
            return;
          }
          const threshold = Math.max(50, windowWidth * 0.12);
          if (media.length > 1 && Math.abs(dx) > threshold) {
            if (dx < 0) next();
            else prev();
          }
        },
        onPanResponderTerminationRequest: () => true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingCaption, index, media.length, windowWidth],
  );

  if (!item) return null;

  const isCover = item.id === vehicle.coverPhotoId;
  const isBusy = photoActionBusy === item.id;
  const dateDisplay = formatDateForItem(item);

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

        <View
          style={lightboxStyles.imageWrap}
          pointerEvents="box-none"
          {...(item.kind === 'photo' ? panResponder.panHandlers : {})}>
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
                  dateDisplay,
                  formatCameraLine(item.exif),
                  formatExposureLine(item.exif),
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

/**
 * Show the capture date only (EXIF DateTimeOriginal). The upload timestamp
 * is not a signal most viewers care about, so we omit it rather than
 * muddle the metadata line. Returns null when EXIF lacks a taken date.
 */
function formatDateForItem(item: MediaItem): string | null {
  return item.takenAt ? formatTimestamp(item.takenAt) : null;
}

function formatCameraLine(exif: MediaItem['exif']): string | null {
  if (!exif) return null;
  const make = exif.cameraMake;
  const model = exif.cameraModel;
  if (!make && !model) return null;
  // Apple camera models are already prefixed with "iPhone …" etc. — avoid
  // stuttering "Apple iPhone 15 Pro" by skipping redundant makes.
  if (make && model && model.toLowerCase().startsWith(make.toLowerCase())) {
    return model;
  }
  return [make, model].filter(Boolean).join(' ');
}

function formatExposureLine(exif: MediaItem['exif']): string | null {
  if (!exif) return null;
  const parts: string[] = [];
  if (exif.focalLengthMm) parts.push(`${Math.round(exif.focalLengthMm)}mm`);
  if (exif.aperture) parts.push(`f/${exif.aperture.toFixed(1).replace(/\.0$/, '')}`);
  if (exif.shutterSeconds) parts.push(formatShutter(exif.shutterSeconds));
  if (exif.iso) parts.push(`ISO ${exif.iso}`);
  return parts.length ? parts.join(' · ') : null;
}

function formatShutter(seconds: number): string {
  if (seconds >= 1) return `${seconds}s`;
  const denom = Math.round(1 / seconds);
  return `1/${denom}s`;
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
    fontFamily: Fonts.sans.semibold,
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
    fontFamily: Fonts.sans.bold,
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
    fontFamily: Fonts.sans.regular,
  },
  showMoreWrap: {
    alignItems: 'center',
    marginTop: 18,
  },
  // Pill sits under the 3-row wall against the page's light editorial
  // ground — border + text pick up palette colors at call time so the
  // treatment stays consistent with the rest of the UI rather than
  // borrowing the lightbox's gold-on-black accents.
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 999,
  },
  showMoreText: {
    fontSize: 12,
    fontFamily: Fonts.sans.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  showMoreChevron: {
    fontSize: 18,
    lineHeight: 16,
    marginTop: -4,
  },
});

const fullGalleryStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Near-black (same recipe as the lightbox) so the wall view reads
    // as "same universe" when the user transitions from Show More.
    backgroundColor: '#0c0c0c',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 12,
  },
  topBarLeft: {
    flexShrink: 1,
  },
  topBarEyebrow: {
    color: '#f4e4bc',
    fontSize: 13,
    fontFamily: Fonts.sans.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  topBarCount: {
    color: '#bbb5a6',
    fontSize: 11,
    fontFamily: Fonts.sans.semibold,
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3a3730',
    borderRadius: 999,
  },
  closeButtonText: {
    color: '#f4e4bc',
    fontSize: 12,
    fontFamily: Fonts.sans.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  hero: {
    marginBottom: 36,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 24,
  },
  heroCol: {
    flexDirection: 'column',
    gap: 16,
  },
  heroMeta: {
    paddingVertical: 18,
    paddingRight: 12,
    gap: 10,
    justifyContent: 'center',
  },
  heroMetaStacked: {
    // Narrow screens: metadata sits below the photo with a bit less
    // vertical padding so the sheet doesn't feel oversized on a phone.
    paddingVertical: 6,
    paddingRight: 0,
  },
  heroEyebrow: {
    color: '#f4e4bc',
    fontSize: 11,
    fontFamily: Fonts.sans.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#f4e4bc',
    fontSize: 22,
    lineHeight: 30,
    fontFamily: Fonts.sans.semibold,
    marginTop: 4,
  },
  heroBody: {
    color: '#bbb5a6',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Fonts.sans.regular,
  },
  heroMetaLine: {
    color: '#8b867a',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.6,
    fontFamily: Fonts.sans.regular,
  },
  gridBlock: {
    gap: 14,
  },
  gridEyebrow: {
    color: '#8b867a',
    fontSize: 11,
    fontFamily: Fonts.sans.bold,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 4,
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
    fontFamily: Fonts.sans.semibold,
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
    fontFamily: Fonts.sans.bold,
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
    fontFamily: Fonts.sans.regular,
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
    fontFamily: Fonts.sans.regular,
  },
  captionPlaceholder: {
    color: '#8b867a',
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: Fonts.sans.regular,
  },
  metadata: {
    color: '#8b867a',
    fontSize: 12,
    letterSpacing: 0.8,
    textAlign: 'center',
    fontFamily: Fonts.sans.regular,
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
    fontFamily: Fonts.sans.regular,
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
    fontFamily: Fonts.sans.semibold,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
});
