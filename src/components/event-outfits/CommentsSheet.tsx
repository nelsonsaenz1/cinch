import { useCallback } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentComposer } from '@/components/event-outfits/CommentComposer';
import { CommentRow, type ThreadComment } from '@/components/event-outfits/CommentRow';
import { lookName } from '@/components/event-outfits/OutfitPostCard';
import { LookPlate } from '@/components/look/look-plate';
import { ReportFlowSheets } from '@/components/report/ReportFlowSheets';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import {
  socialErrorMessage,
  useDeleteComment,
  useHideComment,
} from '@/features/event-outfits/mutations';
import type { PostedLook } from '@/features/event-outfits/types';
import { useCommentThread } from '@/features/event-outfits/use-comment-thread';
import { useReportFlow } from '@/features/social-graph/use-report-flow';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

type ResolveImage = (...paths: (string | null | undefined)[]) => string | undefined;

/**
 * L-03 — comments on one look, as a sheet over the board rather than a route:
 * "the count you tapped is still on screen behind it and the pick you were
 * weighing is not lost." The header repeats the poster thumb, the title and
 * the pick count — "a comment thread with no look above it is a conversation
 * about nothing."
 *
 * `src/app/event/[id]/comments.tsx` stays the standalone route (deep links,
 * "Table talk"); this is the primary way a look's own thread opens from the
 * board, and shares `useCommentThread` with it so the optimistic-row rules
 * are written once.
 */
export function CommentsSheet({
  visible,
  onClose,
  eventId,
  look,
  posterName,
  pickCount,
  isHost,
  hostName,
  memberCount,
  /** EC-04 · after the occasion — the composer is removed, not disabled. */
  afterOccasion = false,
  resolveImage,
  nameOf,
}: {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  look: PostedLook | null;
  posterName: string | null;
  pickCount: number;
  isHost: boolean;
  /** Who hid a comment, if any — always the host. */
  hostName: string | null;
  /** For the audience line under the composer — "Only the five people…" */
  memberCount: number | null;
  afterOccasion?: boolean;
  resolveImage: ResolveImage;
  nameOf: (userId: string) => string | null;
}) {
  const theme = useTheme();
  const session = useSession();
  const postId = look?.id ?? null;

  const thread = useCommentThread(eventId, postId);
  const deleteComment = useDeleteComment();
  const hideComment = useHideComment();
  const reportFlow = useReportFlow();

  const mutateErr = (error: unknown) => Alert.alert('That didn’t work', socialErrorMessage(error));

  const authorNameOf = useCallback(
    (comment: ThreadComment) => (comment.userId === session.userId ? 'You' : nameOf(comment.userId)),
    [nameOf, session.userId],
  );

  // RP-01…RP-04 — the same three sheets a look or a profile reports through
  // (contract: "reporting is a flow, not a page"). The header names exactly
  // what is being acted on: "Comment by {name}".
  const reportComment = useCallback(
    (comment: ThreadComment) => {
      const authorName = nameOf(comment.userId) ?? 'this person';
      reportFlow.open({
        subject: 'comment',
        subjectId: comment.id,
        subjectUserId: comment.userId,
        label: `Comment by ${authorName}`,
        handle: authorName,
      });
    },
    [nameOf, reportFlow],
  );

  const confirmDeleteComment = useCallback(
    (comment: ThreadComment) => {
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
    [authorNameOf, thread],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-canvas" edges={['bottom']}>
        <KeyboardAvoidingScreen className="flex-1">
          <View className="items-center pt-2.5">
            <View className="h-1 w-9 rounded-full bg-hairline" />
          </View>

          {look ? (
            <View className="flex-row items-center gap-3 border-b border-hairline px-gutter pb-4 pt-3">
              {/* The 44pt thumb size the contract names for "the composed
                  look" — `LookPlate`, not `PlateTriptych`: a 44px box is too
                  narrow for a row of 44px tiles (it would clip to the first
                  garment), where the grid scales itself to fit. */}
              <LookPlate pieces={look.garments} width={44} resolveImage={resolveImage} padding={3} gap={2} />
              <View className="flex-1">
                <Text variant="plate" trim numberOfLines={1}>
                  {lookName(look.garments, look.caption)}
                </Text>
                <Text variant="caption" numberOfLines={1} className="mt-0.5">
                  {[posterName, pickCount > 0 ? `${pickCount} picks` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close comments"
                onPress={onClose}
                hitSlop={10}
                style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                className="active:opacity-60">
                <Text variant="label" style={{ color: theme.accent }}>
                  Done
                </Text>
              </Pressable>
            </View>
          ) : null}

          {thread.comments.isLoading ? (
            <View className="px-gutter pt-4">
              {[0, 1, 2].map((i) => (
                <View key={i} className="flex-row gap-3 py-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <View className="flex-1">
                    <Skeleton className="h-3 w-24 rounded-sm" />
                    <Skeleton className="mt-2 h-4 w-full rounded-sm" />
                  </View>
                </View>
              ))}
            </View>
          ) : thread.comments.isError ? (
            <View className="px-gutter pt-6">
              <Text variant="plate" trim>
                This thread didn’t load
              </Text>
              <Text variant="callout" className="mt-2 text-muted">
                Nothing was lost — the connection dropped on the way.
              </Text>
              <Pressable onPress={() => void thread.comments.refetch()} className="mt-4 self-start">
                <Text variant="label" style={{ color: theme.accent }}>
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerClassName="px-gutter pb-4 pt-1">
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
            <View className="mx-gutter mb-3 rounded-md bg-tray px-3.5 py-3">
              <Text variant="callout" className="text-muted">
                The evening’s been and gone. The thread stays readable.
              </Text>
            </View>
          ) : (
            <>
              <CommentComposer
                replyToName={thread.replyTo?.firstName ?? null}
                onCancelReply={() => thread.setReplyTo(null)}
                onSend={thread.send}
              />
              {/* The audience line — the last thing before typing, and it
                  names people, not a setting. */}
              <Text variant="caption" className="px-gutter pb-3">
                {memberCount
                  ? `Only the ${memberCount} people at this event can read this.`
                  : 'Only the people at this event can read this.'}
              </Text>
            </>
          )}
        </KeyboardAvoidingScreen>
        {thread.termsSheet}
        <ReportFlowSheets flow={reportFlow} />
      </SafeAreaView>
    </Modal>
  );
}
