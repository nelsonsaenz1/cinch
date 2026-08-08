import { SymbolView } from 'expo-symbols';
import { memo, useState } from 'react';
import { ActionSheetIOS, Pressable, Text as RNText, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { isReplyBody, splitMention } from '@/features/event-outfits/comment-thread';
import { isCompliment, type EventComment } from '@/features/event-outfits/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * A thread row, widened with the client-only states a comment can be in
 * before or instead of a real server row: `pending` (drawn the instant Send
 * is pressed, at 55%), `failed` (kept in place with a retry — contract §3,
 * "optimistic writes keep their text where it was written"), or
 * `blockedAuthorName` — EC-03's "Hidden because you blocked Rob" row.
 *
 * `blockedAuthorName` is real UI but never reachable from the live thread:
 * `event_comments: members can select` (20260807120000) already screens a
 * blocked author's rows out at the query, so the client never receives one to
 * render this way. It exists so the dev fixture can still show EC-03's fourth
 * moderation state honestly — see `.redesign/primitive-requests/board-comments.md`.
 */
export type ThreadComment = EventComment & {
  pending?: boolean;
  failed?: boolean;
  /** Dev-fixture-only: see the type doc above. */
  blockedAuthorName?: string;
};

/** "7:02pm" / "Tue" — enough to order a conversation, no timestamp noise. */
function timeLabel(d: Date): string {
  const now = Date.now();
  if (now - d.getTime() < 20 * 60 * 60_000) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * One thread row. EC-01…EC-04 (the atlas's own M-01…M-04 — renumbered per
 * the contract §5 to avoid the Match & Confirm collision), all in one
 * component because a thread renders every row through the same list and a
 * row's state can change under it (a hide lands mid-scroll via realtime).
 *
 * One indent level, never more: a reply is detected by its leading "@Name"
 * (`isReplyBody` — see `comment-thread.ts` for why this is inferred rather
 * than a stored parent id) and rendered 40px in with the mention in accent.
 * No likes, no reaction, no reply count on any row (contract: "no likes on
 * comments... four sentences do not need a popularity layer").
 *
 * Memoized, and every callback takes the comment rather than closing over
 * it — the thread re-renders on every realtime invalidation and every
 * composer keystroke, and a handler rebuilt per row in the parent's `.map`
 * would defeat the memo every time.
 */
export const CommentRow = memo(function CommentRow({
  comment,
  authorName,
  isMine,
  isHost,
  hiddenByName,
  onReply,
  onReport,
  onDelete,
  onToggleHidden,
  onBlock,
  onRetry,
  onDeletePending,
  onUndoBlock,
}: {
  comment: ThreadComment;
  authorName: string | null;
  isMine: boolean;
  isHost: boolean;
  /** Who hid this row — always the host, the only role the schema lets. */
  hiddenByName: string | null;
  onReply: (comment: ThreadComment) => void;
  onReport: (comment: ThreadComment) => void;
  onDelete: (comment: ThreadComment) => void;
  onToggleHidden: (comment: ThreadComment) => void;
  /** Two taps deep behind the row's own overflow — never a visible affordance. */
  onBlock?: (comment: ThreadComment) => void;
  /** Present on a `failed` row. */
  onRetry?: (comment: ThreadComment) => void;
  /** Present on a `pending` or `failed` (client-only) row. */
  onDeletePending?: (comment: ThreadComment) => void;
  /** Present only on the dev-fixture `blockedAuthorName` row. */
  onUndoBlock?: (comment: ThreadComment) => void;
}) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  const reply = isReplyBody(comment.body) ? splitMention(comment.body) : null;
  const indent = reply ? 40 : 0;

  // EC-03 · the fourth moderation state — a blocked author's row, dev-fixture
  // only (see the type doc above).
  if (comment.blockedAuthorName) {
    return (
      <View
        className="flex-row items-center gap-2.5 rounded-md py-3 pl-0"
        style={{ backgroundColor: theme.tray, paddingHorizontal: 14, marginVertical: 4 }}>
        <Text variant="callout" className="flex-1 text-muted">
          {`Hidden because you blocked ${comment.blockedAuthorName}.`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Undo block on ${comment.blockedAuthorName}`}
          onPress={() => onUndoBlock?.(comment)}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET - 24 }}>
          <Text variant="label" className="font-semibold" style={{ color: theme.accent }}>
            Undo
          </Text>
        </Pressable>
      </View>
    );
  }

  // EC-02 · sending / didn't send.
  if (comment.pending || comment.failed) {
    return (
      <View className="flex-row gap-3 py-3" style={{ opacity: comment.pending ? 0.55 : 1 }}>
        <Avatar name={null} size={30} tone="accent" fallback="ME" />
        <View className="flex-1">
          <Text variant="callout">
            <RNText style={{ fontWeight: '600' }}>You</RNText> {comment.body}
          </Text>
          {comment.pending ? (
            <Text variant="caption" className="mt-1">
              Sending…
            </Text>
          ) : (
            <View className="mt-1 flex-row items-center gap-3.5">
              <Text variant="caption" style={{ color: theme.critical }}>
                Didn’t send
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try sending again"
                onPress={() => onRetry?.(comment)}
                hitSlop={8}>
                <Text variant="caption" className="font-semibold" style={{ color: theme.accent }}>
                  Try again
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete this comment"
                onPress={() => onDeletePending?.(comment)}
                hitSlop={8}>
                <Text variant="caption">Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }

  // EC-03 · hidden by the host. Named, never silent (contract: "'Mel hid
  // this comment' — and the author still sees their own line"). The host
  // also sees the real text — they are the one deciding whether to unhide.
  if (comment.hidden && !isMine && !isHost) {
    return (
      <View
        className="rounded-md py-3"
        style={{ backgroundColor: theme.tray, paddingHorizontal: 14, marginVertical: 4 }}>
        <Text variant="callout" className="text-muted">
          {hiddenByName ? `${hiddenByName} hid this comment.` : 'This comment was hidden.'}
        </Text>
      </View>
    );
  }

  // EC-03 · under review after a report, collapsed but openable — "hiding
  // text from the person who reported it is how a thread becomes a rumour."
  if (comment.reported && !comment.hidden && !revealed) {
    return (
      <View
        className="flex-row items-center gap-2.5 rounded-md py-3"
        style={{ backgroundColor: theme.tray, paddingHorizontal: 14, marginVertical: 4 }}>
        <Text variant="callout" className="flex-1 text-muted">
          This comment is being looked at.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See this comment"
          onPress={() => setRevealed(true)}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET - 24 }}>
          <Text variant="label" className="font-semibold" style={{ color: theme.accent }}>
            See it
          </Text>
        </Pressable>
      </View>
    );
  }

  /**
   * The overflow — someone else's row only. `Reply` and (for your own row)
   * `Delete` stay inline per the atlas's own M-01 row (never buried a tap
   * deeper); the sheet carries what's left. "Copy text" is in the atlas's
   * M-03 menu but no clipboard module is installed anywhere in this app
   * (hard rule: no new native modules) — dropped rather than faked; see
   * `.redesign/primitive-requests/board-comments.md`.
   */
  const openMenu = () => {
    const actions: { label: string; run: () => void }[] = [
      { label: 'Report', run: () => onReport(comment) },
    ];
    if (onBlock) {
      actions.push({
        label: authorName ? `Block ${authorName.split(/\s+/)[0]}` : 'Block this person',
        run: () => onBlock(comment),
      });
    }
    if (isHost) {
      actions.push({
        label: comment.hidden ? 'Unhide' : 'Hide from the table',
        run: () => onToggleHidden(comment),
      });
    }

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'This comment',
        options: [...actions.map((a) => a.label), 'Cancel'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: 0,
      },
      (index) => actions[index]?.run(),
    );
  };

  const compliment = !reply && isCompliment(comment.body);

  // EC-03 · hidden, but seen by the two people the schema still lets read it
  // — the author ("only you can see this") and the host who hid it. Not an
  // early return: the row is the same content, dimmed, with one caption line
  // added below it.
  const hiddenButVisible = comment.hidden && (isMine || isHost);

  return (
    <View className="flex-row gap-3 py-3" style={{ paddingLeft: indent, opacity: hiddenButVisible ? 0.55 : 1 }}>
      <Avatar name={isMine ? null : authorName} size={30} tone="accent" fallback="ME" />

      <View className="flex-1">
        {compliment ? (
          <Text variant="plate" style={{ color: theme.ink }}>
            {comment.body}
          </Text>
        ) : (
          <Text variant="callout">
            <RNText style={{ fontWeight: '600' }}>{isMine ? 'You' : (authorName ?? 'A friend')}</RNText>{' '}
            {reply ? (
              <>
                <RNText style={{ color: theme.accent }}>{reply.mention}</RNText> {reply.rest}
              </>
            ) : (
              comment.body
            )}
          </Text>
        )}

        {hiddenButVisible ? (
          <Text variant="caption" className="mt-0.5" style={{ color: theme.critical }}>
            {isMine
              ? `Hidden by ${hiddenByName ?? 'the host'} · only you can see this`
              : `Hidden · only you and ${authorName ?? 'its author'} can see this`}
          </Text>
        ) : null}

        <View className="mt-1.5 flex-row items-center gap-3.5">
          <Text variant="caption">{timeLabel(comment.createdAt)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${authorName ?? 'this comment'}`}
            onPress={() => onReply(comment)}
            hitSlop={8}>
            <Text variant="caption" className="font-medium">
              Reply
            </Text>
          </Pressable>
          {isMine ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete this comment"
              onPress={() => onDelete(comment)}
              hitSlop={8}>
              <Text variant="caption" className="font-medium">
                Delete
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {!isMine ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comment options"
          onPress={openMenu}
          hitSlop={10}
          style={{ minHeight: MIN_TAP_TARGET - 24, paddingTop: 4 }}
          className="active:opacity-60">
          <SymbolView name="ellipsis" size={13} tintColor={theme.byline} resizeMode="scaleAspectFit" />
        </Pressable>
      ) : null}
    </View>
  );
});
