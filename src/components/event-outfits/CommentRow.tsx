import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { ActionSheetIOS, Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { isCompliment, type EventComment } from '@/features/event-outfits/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** "7:02pm" / "Tue" — enough to order a conversation, no timestamp noise. */
function timeLabel(d: Date): string {
  const now = Date.now();
  if (now - d.getTime() < 20 * 60 * 60_000) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * One comment: author, body, quiet time, and the ⋯ affordances the App Store
 * UGC minimum set requires on every piece of user content (report always;
 * delete for author/host; hide for host).
 *
 * Hidden rows reach only their author and the host (RLS decides, not the
 * client); this component's job is to LABEL that state honestly so the host
 * sees what they hid and the author knows their words are under review —
 * nobody is shown a silently vanished message they can still see.
 *
 * A compliment (fixed-vocabulary body) is typeset as the stylist would say
 * it — serif, no bubble weight — so praise reads as a printed note rather
 * than chat.
 *
 * Memoized, and the callbacks take the comment rather than closing over it:
 * a thread re-renders on every realtime invalidation and on every keystroke
 * in the composer above it, and none of that changes a row that has already
 * arrived. Handlers built per row in the parent's `.map` would be new objects
 * on every one of those renders and the memo would never hold, so the screen
 * passes three stable `useCallback`s and each row hands its own comment back.
 */
export const CommentRow = memo(function CommentRow({
  comment,
  authorName,
  isMine,
  isHost,
  onReport,
  onDelete,
  onToggleHidden,
}: {
  comment: EventComment;
  authorName: string | null;
  isMine: boolean;
  isHost: boolean;
  onReport: (comment: EventComment) => void;
  onDelete: (comment: EventComment) => void;
  onToggleHidden: (comment: EventComment) => void;
}) {
  const theme = useTheme();
  const compliment = isCompliment(comment.body);

  /**
   * The overflow as iOS's own content overflow — a bottom sheet with a red
   * destructive row — rather than an `Alert` with a list of verbs in it. Same
   * swap, same reasoning as `OutfitPostCard`'s menu, so a reader who has met
   * one has met both.
   */
  const openMenu = () => {
    const actions: { label: string; run: () => void }[] = [];
    if (!isMine) actions.push({ label: 'Report', run: () => onReport(comment) });
    if (isHost && !isMine) {
      actions.push({
        label: comment.hidden ? 'Unhide' : 'Hide from the table',
        run: () => onToggleHidden(comment),
      });
    }
    if (isMine || isHost) actions.push({ label: 'Delete', run: () => onDelete(comment) });
    if (actions.length === 0) return;

    // Delete when it is on offer, otherwise Report: the one row that cannot
    // be undone gets the tint. Hiding is reversible and takes none.
    const deleteIndex = actions.findIndex((a) => a.label === 'Delete');
    const destructiveIndex =
      deleteIndex >= 0 ? deleteIndex : actions.findIndex((a) => a.label === 'Report');

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'This comment',
        options: [...actions.map((a) => a.label), 'Cancel'],
        cancelButtonIndex: actions.length,
        ...(destructiveIndex >= 0 ? { destructiveButtonIndex: destructiveIndex } : {}),
      },
      (index) => actions[index]?.run(),
    );
  };

  return (
    <View className="flex-row gap-3 py-3" style={{ opacity: comment.hidden ? 0.5 : 1 }}>
      <Avatar name={authorName} size={28} tone="accent" />

      <View className="flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text variant="label" className="text-ink">
            {authorName ?? 'A friend'}
          </Text>
          <Text variant="caption">{timeLabel(comment.createdAt)}</Text>
        </View>

        {compliment ? (
          <Text variant="plate" className="mt-1" style={{ color: theme.ink }}>
            {comment.body}
          </Text>
        ) : (
          <Text variant="callout" className="mt-0.5">
            {comment.body}
          </Text>
        )}

        {comment.hidden ? (
          // `critical`, not `warning`. The palette is locked and `warning`
          // (#C58A2E) reads 2.85:1 on surface at 11px — under AA for the one
          // line on this row that tells someone their words are under review.
          // `critical` (#8A2E28) clears it at 7.4:1, and the stronger read is
          // the honest one: the row above it is already dimmed to 50%, so a
          // quieter label would be the second thing on the row apologising.
          <Text variant="caption" className="mt-1" style={{ color: theme.critical }}>
            {isMine ? 'Hidden while the host takes a look' : 'Hidden from the table'}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comment options"
        onPress={openMenu}
        hitSlop={10}
        style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}
        className="active:opacity-60">
        <SymbolView name="ellipsis" size={14} tintColor={theme.faint} resizeMode="scaleAspectFit" />
      </Pressable>
    </View>
  );
});
