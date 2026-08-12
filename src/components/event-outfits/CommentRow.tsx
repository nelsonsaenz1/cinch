import { SymbolView } from 'expo-symbols';
import { memo, useState } from 'react';
import { ActionSheetIOS, Pressable, Text as RNText, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { NoticeBand } from '@/components/ui/notice-band';
import { Text } from '@/components/ui/text';
import { commentColumn } from '@/features/event-outfits/comment-geometry';
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
  onEditFailed,
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
  /**
   * Present on a `failed` row. Edits the kept words IN PLACE — audit 94 is
   * explicit that they are "never moved back into the composer, where they
   * could be overwritten", so a handler that repopulated the field would be
   * the exact defect this control exists to avoid.
   */
  onEditFailed?: (comment: ThreadComment, body: string) => void;
  /** Present on a `pending` or `failed` (client-only) row. */
  onDeletePending?: (comment: ThreadComment) => void;
  /** Present only on the dev-fixture `blockedAuthorName` row. */
  onUndoBlock?: (comment: ThreadComment) => void;
}) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  // The failed row's in-place edit. Seeded from the comment at the moment Edit
  // is pressed, never at mount: a draft seeded on every render would fight a
  // retry that changed the body under it.
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const reply = isReplyBody(comment.body) ? splitMention(comment.body) : null;
  // Audit 93 — the reading column, and the one indent level. 261 at the top
  // level, 235 under a 26 pt indent, and neither derived from the window or
  // the type size. `comment-geometry.ts` carries the whole argument.
  const { width: column, indent } = commentColumn(Boolean(reply));

  // EC-03 · the fourth moderation state — a blocked author's row, dev-fixture
  // only (see the type doc above).
  //
  // Drawn as a `NoticeBand` like every other moderation and system message in
  // the thread: "Tray fill is reserved for system and moderation messages,
  // which is why the hidden, reported and closed notices look alike and unlike
  // a person's comment." The band being one shared object is the whole reason
  // they can look alike without anybody maintaining three copies of a tray.
  if (comment.blockedAuthorName) {
    return (
      <NoticeBand
        className="my-1"
        cause="BLOCKED"
        title={`You blocked ${comment.blockedAuthorName}`}
        body="Their comment is hidden for you. Nothing else in the thread changed, and they were not told."
        actions={onUndoBlock ? [{ label: 'Undo', onPress: () => onUndoBlock(comment) }] : []}
      />
    );
  }

  // EC-02 · sending. "A sending comment is already in the thread in secondary
  // ink with its state on the name line" — deliberately NOT a tray, because a
  // tray would say a system spoke; this is the user's own sentence, already
  // placed, waiting.
  if (comment.pending) {
    return (
      <View className="flex-row gap-3 py-3" style={{ opacity: 0.55 }}>
        <Avatar name={null} size={32} tone="accent" fallback="ME" />
        <View style={{ width: column }}>
          <Text variant="label" className="text-muted">
            <RNText style={{ fontWeight: '500', color: theme.ink }}>You</RNText>
            {' · sending'}
          </Text>
          <Text variant="callout" className="mt-1">
            {comment.body}
          </Text>
        </View>
      </View>
    );
  }

  // EC-02 · not sent. Audit 94: "A failure keeps the full text inside a tray
  // at the same 261 pt column with Retry and Edit — the words are never lost
  // and never moved back into the composer, where they could be overwritten."
  //
  // So the body is printed IN FULL (no `numberOfLines`) at the same column
  // width as every other comment, and neither action puts it back in the
  // field. `Edit` re-opens the words here; `Retry` sends what is already here.
  if (comment.failed) {
    return (
      <View className="flex-row gap-3 py-3">
        <Avatar name={null} size={32} tone="accent" fallback="ME" />
        <View style={{ width: column }}>
          <Text variant="label" className="text-muted">
            <RNText style={{ fontWeight: '500', color: theme.ink }}>You</RNText>
            {' · not sent'}
          </Text>
          <View className="mt-1 rounded-md bg-tray p-3">
            {editing ? (
              // Editing happens HERE, in the tray, at the same column. The
              // words never travel back to the composer.
              <TextInput
                value={editDraft}
                onChangeText={setEditDraft}
                multiline
                autoFocus
                accessibilityLabel="Edit the comment that did not send"
                className="font-body text-callout"
                style={{ color: theme.ink, padding: 0 }}
              />
            ) : (
              // No `numberOfLines`: the full text, always.
              <Text variant="callout">{comment.body}</Text>
            )}
            <Text variant="note" className="mt-1.5">
              This did not send. Your words are kept here.
            </Text>
            <View className="mt-3 flex-row items-center gap-5">
              {editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save the edit and send again"
                  onPress={() => {
                    setEditing(false);
                    onEditFailed?.(comment, editDraft);
                  }}
                  hitSlop={8}
                  style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}>
                  <Text variant="label" className="font-medium" style={{ color: theme.ink }}>
                    Send it
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Try sending again"
                  onPress={() => onRetry?.(comment)}
                  hitSlop={8}
                  style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}>
                  <Text variant="label" className="font-medium" style={{ color: theme.ink }}>
                    Retry
                  </Text>
                </Pressable>
              )}
              {onEditFailed && !editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit this comment before sending it again"
                  onPress={() => {
                    setEditDraft(comment.body);
                    setEditing(true);
                  }}
                  hitSlop={8}
                  style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}>
                  <Text variant="label" className="font-medium" style={{ color: theme.ink }}>
                    Edit
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete this comment"
                onPress={() => onDeletePending?.(comment)}
                hitSlop={8}
                style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}>
                <Text variant="label">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // EC-03 · hidden by the host. "A removal names who did it and what it did
  // not affect." Named, never silent (contract: "'Mel hid this comment' — and
  // the author still sees their own line"). The host also sees the real text —
  // they are the one deciding whether to unhide.
  if (comment.hidden && !isMine && !isHost) {
    return (
      <NoticeBand
        className="my-1"
        cause="HIDDEN"
        title={hiddenByName ? `${hiddenByName} hid a comment here` : 'A comment here was hidden'}
        body="Nothing else in the thread changed."
      />
    );
  }

  // EC-03 · under review after a report, collapsed but openable — "hiding
  // text from the person who reported it is how a thread becomes a rumour."
  // "A report names what the other person was not told."
  if (comment.reported && !comment.hidden && !revealed) {
    return (
      <NoticeBand
        className="my-1"
        cause="REPORTED"
        title="You reported a comment"
        body="It is hidden for you while Cinch looks at it, and the person was not told who reported it."
        actions={[{ label: 'See it', onPress: () => setRevealed(true) }]}
      />
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
    // `items-start`, and NO `flex-1` anywhere in this row. Audit 93: "the
    // avatar and the overflow control are both flex:none outside it, so
    // wrapping never depends on how long a name is." A `flex-1` column would
    // hand the leftover width to the text and make the reading measure a
    // function of the name, the avatar and whether the row happens to have an
    // overflow control — the three variables the fixed column exists to
    // remove.
    <View
      className="flex-row items-start gap-3 py-3"
      style={{ paddingLeft: indent, opacity: hiddenButVisible ? 0.55 : 1 }}>
      <Avatar name={isMine ? null : authorName} size={32} tone="accent" fallback="ME" />

      <View style={{ width: column }}>
        {/* Name and timestamp share ONE line, and the name is the only
            Medium string on it. 13 pt rather than the atlas's 14: the scale
            in tailwind.config.js runs 11 / 13 / 16 / 17 and has no 14, and
            adding a step to the type scale is the integrator's file, not a
            lane's. Reported rather than taken. */}
        <View className="flex-row items-baseline gap-1.5">
          <Text variant="label" className="font-medium text-ink">
            {isMine ? 'You' : (authorName ?? 'A friend')}
          </Text>
          <Text variant="note">{`· ${timeLabel(comment.createdAt)}`}</Text>
        </View>

        {/* The body: 16 pt regular (`callout`), no `numberOfLines`. It grows
            taller; it never grows wider and never truncates. */}
        {compliment ? (
          <Text variant="plate" className="mt-1" style={{ color: theme.ink }}>
            {comment.body}
          </Text>
        ) : (
          <Text variant="callout" className="mt-1">
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
          <Text variant="caption" className="mt-1" style={{ color: theme.critical }}>
            {isMine
              ? `Hidden by ${hiddenByName ?? 'the host'} · only you can see this`
              : `Hidden · only you and ${authorName ?? 'its author'} can see this`}
          </Text>
        ) : null}

        <View className="mt-1.5 flex-row items-center gap-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${authorName ?? 'this comment'}`}
            onPress={() => onReply(comment)}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}>
            <Text variant="label" className="font-medium">
              Reply
            </Text>
          </Pressable>
          {isMine ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete this comment"
              onPress={() => onDelete(comment)}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}>
              <Text variant="label" className="font-medium">
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
