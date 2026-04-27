/**
 * MediaReorderGrid (native fallback)
 *
 * Native platforms get arrow buttons on each tile, mirroring the Garage's
 * reorder pattern. The web build uses media-reorder-grid.web.tsx, which
 * Metro picks up automatically via the platform extension.
 */

import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MediaItem } from '@/types/vehicle';

type Props = {
  media: MediaItem[];
  onReorder: (orderedIds: string[]) => void;
};

const TILE_SIZE = 130;

export function MediaReorderGrid({ media, onReorder }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next.map((m) => m.id));
  }

  return (
    <View style={styles.grid}>
      {media.map((item, i) => {
        const isPhoto = item.kind === 'photo' && !!item.downloadUrl;
        return (
          <View
            key={item.id}
            style={[
              styles.tile,
              { borderColor: palette.border, backgroundColor: palette.surfaceDim },
            ]}>
            {isPhoto ? (
              <Image
                source={{ uri: item.downloadUrl! }}
                style={styles.image}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.image, styles.videoTile]}>
                <ThemedText
                  type="eyebrow"
                  style={{ color: '#f4e4bc', letterSpacing: 1.4 }}>
                  VIDEO
                </ThemedText>
              </View>
            )}
            <View style={styles.controls}>
              <Pressable
                disabled={i === 0}
                onPress={() => move(i, -1)}
                style={[
                  styles.controlBtn,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    opacity: i === 0 ? 0.4 : 1,
                  },
                ]}>
                <ThemedText style={[styles.controlText, { color: palette.text }]}>
                  ↑
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={i === media.length - 1}
                onPress={() => move(i, 1)}
                style={[
                  styles.controlBtn,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    opacity: i === media.length - 1 ? 0.4 : 1,
                  },
                ]}>
                <ThemedText style={[styles.controlText, { color: palette.text }]}>
                  ↓
                </ThemedText>
              </Pressable>
            </View>
            <View style={[styles.indexBadge, { backgroundColor: palette.tint }]}>
              <ThemedText style={styles.indexBadgeText}>{i + 1}</ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoTile: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    top: 4,
    right: 4,
    gap: 4,
  },
  controlBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  indexBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 2,
  },
  indexBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 12,
  },
});
