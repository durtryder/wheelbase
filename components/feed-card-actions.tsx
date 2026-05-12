import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import {
  markFeedItemSaved,
  setFeedReaction,
} from '@/services/feed-reactions';
import { saveFeedItemToNotebook } from '@/services/notebook';
import type { FeedReaction, ReactionKind } from '@/types/feed-reaction';
import { NEWS_SOURCE_LABELS, type BaTListing, type NewsArticle } from '@/types/feed';

type Palette = (typeof Colors)['light'];

/**
 * Action bar that sits at the bottom of a Feed card. Three icons:
 *
 *   👍 / 👎 — quick signal to tune the feed (no immediate effect on
 *             ranking; written for future personalization to consume)
 *   🔖     — save the linked item to the user's Notebook
 *
 * Each icon is press-eatable: the card's outer Pressable opens the
 * external link, but actions stopPropagation so they don't bubble up.
 * The component owns its own service calls — the parent just hands
 * it the item plus the user's existing reaction record.
 */
export function FeedCardActions({
  userId,
  feedItem,
  existingReaction,
  palette,
}: {
  userId: string;
  feedItem: NewsArticle | BaTListing;
  existingReaction: FeedReaction | undefined;
  palette: Palette;
}) {
  const [busy, setBusy] = useState<'like' | 'dislike' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reaction = existingReaction?.reaction;
  const savedEntryId = existingReaction?.savedNotebookEntryId;

  async function handleReaction(next: ReactionKind) {
    if (busy) return;
    setBusy(next);
    setError(null);
    try {
      // Tapping the active reaction clears it; tapping the inactive
      // one switches sides.
      const target = reaction === next ? null : next;
      await setFeedReaction({
        userId,
        feedItemId: feedItem.id,
        feedItemKind: feedItem.kind,
        reaction: target,
      });
    } catch (e) {
      console.warn('[feed-actions] reaction failed', e);
      setError('Could not record reaction. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (busy || savedEntryId) return;
    setBusy('save');
    setError(null);
    try {
      const siteName =
        feedItem.kind === 'article'
          ? NEWS_SOURCE_LABELS[feedItem.source] ?? feedItem.source
          : 'Bring a Trailer';
      const entryId = await saveFeedItemToNotebook({
        ownerId: userId,
        title: feedItem.title,
        url: feedItem.url,
        siteName,
        thumbnailUrl: feedItem.imageUrl,
      });
      await markFeedItemSaved({
        userId,
        feedItemId: feedItem.id,
        feedItemKind: feedItem.kind,
        savedNotebookEntryId: entryId,
      });
    } catch (e) {
      console.warn('[feed-actions] save failed', e);
      setError('Could not save to Notebook.');
    } finally {
      setBusy(null);
    }
  }

  // The bar lives inside the card's Pressable, so each action button
  // must swallow press events to avoid double-firing the "open link"
  // handler when the user taps the icon.
  function swallow(handler: () => void) {
    return (e: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      handler();
    };
  }

  return (
    <View
      style={[
        styles.row,
        { borderTopColor: palette.border },
      ]}
      onStartShouldSetResponder={() => true}>
      <ActionButton
        active={reaction === 'like'}
        loading={busy === 'like'}
        iconActive="thumb-up"
        iconInactive="thumb-up-off-alt"
        accessibilityLabel={reaction === 'like' ? 'Remove like' : 'Like this'}
        onPress={swallow(() => handleReaction('like'))}
        palette={palette}
      />
      <ActionButton
        active={reaction === 'dislike'}
        loading={busy === 'dislike'}
        iconActive="thumb-down"
        iconInactive="thumb-down-off-alt"
        accessibilityLabel={
          reaction === 'dislike' ? 'Remove dislike' : 'Less of this'
        }
        onPress={swallow(() => handleReaction('dislike'))}
        palette={palette}
      />
      <View style={{ flex: 1 }} />
      <ActionButton
        active={!!savedEntryId}
        loading={busy === 'save'}
        iconActive="bookmark"
        iconInactive="bookmark-border"
        accessibilityLabel={
          savedEntryId ? 'Saved to Notebook' : 'Save to Notebook'
        }
        label={savedEntryId ? 'Saved' : 'Save'}
        onPress={swallow(handleSave)}
        palette={palette}
        disabled={!!savedEntryId}
      />
      {error ? (
        <ThemedText
          type="metadata"
          style={{ color: palette.tint, marginLeft: 10 }}
          numberOfLines={1}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function ActionButton({
  active,
  loading,
  iconActive,
  iconInactive,
  label,
  accessibilityLabel,
  onPress,
  palette,
  disabled,
}: {
  active: boolean;
  loading: boolean;
  iconActive: React.ComponentProps<typeof MaterialIcons>['name'];
  iconInactive: React.ComponentProps<typeof MaterialIcons>['name'];
  label?: string;
  accessibilityLabel: string;
  onPress: (e: { stopPropagation?: () => void }) => void;
  palette: Palette;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || loading}
      style={({ hovered, pressed }) => [
        styles.button,
        {
          opacity: pressed ? 0.7 : disabled ? 0.85 : 1,
        },
        hovered ? ({ cursor: 'pointer' } as object) : null,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.textMuted} />
      ) : (
        <MaterialIcons
          name={active ? iconActive : iconInactive}
          size={18}
          color={active ? palette.tint : palette.textMuted}
        />
      )}
      {label ? (
        <ThemedText
          type="metadata"
          style={{
            color: active ? palette.tint : palette.textMuted,
            fontWeight: '600',
          }}>
          {label}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 12,
    marginTop: 14,
    borderTopWidth: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
});
