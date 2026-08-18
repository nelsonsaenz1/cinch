import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentComposer } from '@/components/event-outfits/CommentComposer';
import { CommentRow, type ThreadComment } from '@/components/event-outfits/CommentRow';
import { lookName } from '@/components/event-outfits/OutfitPostCard';
// Batch-1 seam: the shared states kit.
import { ErrorState } from '@/components/ui/error-state';
import { NoticeBand } from '@/components/ui/notice-band';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import {
  CLOSED_THREAD_TITLE,
  audienceScopeLine,
  closedThreadLine,
  commentCountLine,
} from '@/features/event-outfits/comment-thread';
import { useEventPosts } from '@/features/event-outfits/queries';
import { socialErrorMessage, useDeleteComment, useHideComment } from '@/features/event-outfits/mutations';
import { useCommentThread } from '@/features/event-outfits/use-comment-thread';
import { useEvent, useEventMembers } from '@/features/events/queries';
import { useEventChannel } from '@/features/events/use-event-channel';
import { REPORT_REASONS, useReportContent } from '@/features/social-graph/moderation';

/** Three comment rows' worth of shape — avatar disc, name, two lines of body. */
function ThreadSkeleton() {
  return (
    <View className="px-gutter pt-4" accessibilityLabel="Reading the thread">
      {[0, 1, 2].map((i) => (
        <View key={i} className="flex-row gap-3 py-3">
          <Skeleton className="h-7 w-7 rounded-full" />
          <View className="flex-1">
            <Skeleton className="h-3 w-24 rounded-sm" />
            <Skeleton className="mt-2 h-4 w-full rounded-sm" />
            <Skeleton className="mt-1.5 h-4 w-2/3 rounded-sm" />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Event Comments — EC-01…EC-04 (renumbered from the atlas's own M-01…M-04
 * per `docs/design/event-social-contract.md` §5, to avoid the collision with
 * the shipped Match & Confirm atlas's own M-01…M-12).
 *
 * The primary way a look's own thread opens is `CommentsSheet` (L-03), a
 * modal over the Look Board — this route stays standalone for a deep link
 * and for the event-level thread ("Table talk", no `post` param), sharing
 * `useCommentThread` with the sheet so the optimistic-row rules live once.
 *
 * Rows sit directly on the canvas, no card, no bubble (contract: "a card per
 * comment would make four sentences look like a forum").
 */
export default function EventCommentsScreen() {
  const { id, post } = useLocalSearchParams<{ id: string; post?: string }>();
  const eventId = id ?? null;
  const postId = post ?? null;
  const session = useSession();

  useEventChannel(eventId);

  const event = useEvent(eventId);
  const members = useEventMembers(eventId ?? '');
  const posts = useEventPosts(eventId);

  const thread = useCommentThread(eventId, postId);
  const deleteComment = useDeleteComment();
  const hideComment = useHideComment();
  const report = useReportContent();

  const nameOf = (userId: string): string | null => {
    const m = (members.data ?? []).find((mm) => mm.userId === userId);
    return m?.displayName ?? m?.username ?? null;
  };
  const authorNameOf = (comment: ThreadComment) =>
    comment.userId === session.userId ? 'You' : nameOf(comment.userId);

  const look = postId ? (posts.data?.looks ?? []).find((l) => l.id === postId) : null;
  const isHost = event.data?.isHost ?? false;
  // Always the host — the schema's only "who can hide" role (Server ground
  // truth: `event_comments: host can moderate`). Resolved by role, not by a
  // stored actor, since the row itself carries no "hidden by" column.
  const hostName = event.data?.hostId ? nameOf(event.data.hostId) : null;

  const mutateErr = (error: unknown) => Alert.alert('That didn’t work', socialErrorMessage(error));

  const reportComment = useCallback(
    (comment: ThreadComment) => {
      Alert.alert('Report this comment', 'What’s wrong with it?', [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () =>
            report.mutate(
              { subject: 'comment' as const, subjectId: comment.id, subjectUserId: comment.userId, reason },
              {
                onSuccess: () => Alert.alert('Thank you', 'Every report is reviewed.'),
                onError: (error: unknown) => Alert.alert('That didn’t go through', socialErrorMessage(error)),
              },
            ),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    },
    [report],
  );

  const confirmDeleteComment = useCallback(
    (comment: ThreadComment) => {
      if (!eventId) return;
      Alert.alert('Delete this comment?', 'This can’t be undone.', [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteComment.mutate({ eventId, commentId: comment.id }, { onError: mutateErr }),
        },
      ]);
    },
    [eventId, deleteComment],
  );

  const toggleHidden = useCallback(
    (comment: ThreadComment) => {
      if (!eventId) return;
      hideComment.mutate({ eventId, commentId: comment.id, hidden: !comment.hidden }, { onError: mutateErr });
    },
    [eventId, hideComment],
  );

  const startReply = useCallback(
    (comment: ThreadComment) => {
      const name = authorNameOf(comment);
      if (!name) return;
      thread.setReplyTo({ userId: comment.userId, firstName: name.split(/\s+/)[0]! });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members.data, session.userId, thread],
  );

  const title = look ? lookName(look.garments, look.caption) : (event.data?.title ?? 'Table talk');
  // `Date.now()` during render is impure — the same render could answer this
  // question differently twice. One reading, taken when the screen mounts, is
  // also the honest semantics: this decides which copy the thread shows, and a
  // screen that silently changed its wording mid-session as a start time passed
  // would be stranger than one that is a few minutes stale.
  const [mountedAt] = useState(() => Date.now());
  const afterOccasion = Boolean(event.data?.startsAt && event.data.startsAt.getTime() < mountedAt);
  // Correction 25 names closure's cause as the occasion's start TIME rather
  // than a vague elapsed interval, so the notice has to be able to print it.
  // Absent on an undated occasion, which never closes at all — `starts_at` is
  // nullable (migration 20260808130000).
  const startLabel =
    event.data?.startsAt
      ?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      .toLowerCase()
      .replace(' ', '') ?? null;
  const visibleCount = thread.rows.filter((c) => !c.hidden && !c.pending && !c.failed).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardAvoidingScreen className="flex-1">
        {/*
          ── Redesign 03 · the accepted frame's masthead ────────────────────

          A serif word and the audience, on one baseline. The back chevron went
          with the push: the route is a sheet now (see `event/_layout.tsx`) and
          a sheet's way out is its grabber and its swipe, so a header row whose
          only content was a duplicate dismissal is a row of nothing.

          Audit 94 is unchanged and is the reason the scope is UP here rather
          than under the field: the closed thread has no composer, so a line
          beneath it vanishes exactly when a reader most needs to know who can
          still see what they wrote.

          THE ARTIFACT'S OWN LABEL IS NOT USED. It sets this eyebrow to
          "FRIENDS ONLY", and that is not what the server does — the read
          policy is `is_event_member(event_id)`, membership rather than
          friendship, and an event member need not be a friend of the reader.
          `audienceScopeLine` says the true thing and `comments-column.test.ts`
          pins the words; the frame's typography is kept and its claim is not.
        */}
        <View className="flex-row items-baseline justify-between gap-3 px-gutter pt-4 pb-3">
          <Text variant="title" trim numberOfLines={1} className="min-w-0 flex-shrink">
            {title}
          </Text>
          <Text variant="eyebrow" style={{ flexShrink: 0 }}>
            {audienceScopeLine}
          </Text>
        </View>
        {visibleCount > 0 ? (
          <Text variant="note" className="px-gutter pb-2">
            {commentCountLine(visibleCount)}
          </Text>
        ) : null}

        {event.isError || posts.isError ? (
          <View className="flex-1 pt-4">
            <ErrorState
              compact
              title="This thread didn’t load"
              body="Nothing was lost — the connection dropped on the way."
              onRetry={() => {
                void event.refetch();
                void posts.refetch();
              }}
            />
          </View>
        ) : thread.comments.isError ? (
          <View className="flex-1 pt-4">
            <ErrorState
              compact
              title="This thread didn’t load"
              body="Nothing was lost — the connection dropped on the way. You can still say something below."
              onRetry={() => void thread.comments.refetch()}
              retrying={thread.comments.isRefetching}
            />
          </View>
        ) : thread.comments.isLoading ? (
          <ThreadSkeleton />
        ) : (
          <ScrollView contentContainerClassName="px-gutter pb-4 pt-2">
            {thread.rows.length === 0 ? (
              <Text variant="body" className="mt-6 text-muted">
                Nobody’s said anything yet.
              </Text>
            ) : (
              thread.rows.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  authorName={authorNameOf(comment)}
                  isMine={comment.userId === session.userId}
                  isHost={isHost}
                  hiddenByName={hostName}
                  onReply={startReply}
                  onReport={reportComment}
                  onDelete={confirmDeleteComment}
                  onToggleHidden={toggleHidden}
                  onRetry={thread.retry}
                  onEditFailed={thread.editAndRetry}
                  onDeletePending={thread.deletePending}
                />
              ))
            )}
          </ScrollView>
        )}

        {afterOccasion ? (
          // EC-04 / CM-02 · past the occasion's start — the composer is
          // REMOVED, not disabled: "a disabled field would invite a draft the
          // server will refuse." The rows keep their overflow menus.
          //
          // The same `NoticeBand` the hidden and reported rows use, because
          // this is a system message and they are moderation messages, and the
          // whole point of the tray fill is that the three read as one voice.
          //
          // PARKED (dependency A): the atlas ends this notice "nothing new can
          // be added". The server has no such rule — see `closedThreadLine`'s
          // own docs for the policy and line numbers — so the copy stops at
          // what the client does.
          <NoticeBand
            className="mx-gutter mb-3"
            cause="CLOSED"
            title={CLOSED_THREAD_TITLE}
            body={closedThreadLine(startLabel)}
          />
        ) : (
          <CommentComposer
            replyToName={thread.replyTo?.firstName ?? null}
            onCancelReply={() => thread.setReplyTo(null)}
            onSend={thread.send}
          />
        )}
      </KeyboardAvoidingScreen>

      {thread.termsSheet}
    </SafeAreaView>
  );
}
