import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentComposer } from '@/components/event-outfits/CommentComposer';
import { CommentRow, type ThreadComment } from '@/components/event-outfits/CommentRow';
import { lookName } from '@/components/event-outfits/OutfitPostCard';
// Batch-1 seam: the shared states kit.
import { ErrorState } from '@/components/ui/error-state';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
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
      Alert.alert('Delete this comment?', undefined, [
        { text: 'Cancel', style: 'cancel' },
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
  const afterOccasion = Boolean(event.data?.startsAt && event.data.startsAt.getTime() < Date.now());

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardAvoidingScreen className="flex-1">
        <ScreenHeader align="leading" title={look ? 'On this look' : 'Table talk'} />

        <View className="px-gutter">
          <Text variant="title" trim numberOfLines={1} className="mt-4">
            {title}
          </Text>
        </View>

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
                  onDeletePending={thread.deletePending}
                />
              ))
            )}
          </ScrollView>
        )}

        {afterOccasion ? (
          // EC-04 · after the occasion — the composer is removed, not
          // disabled, and the rows keep their overflow menus.
          <View className="mx-gutter mb-3 rounded-md bg-tray px-3.5 py-3">
            <Text variant="callout" className="text-muted">
              The dinner’s been and gone. The thread stays readable.
            </Text>
          </View>
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
