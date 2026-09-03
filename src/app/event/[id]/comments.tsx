import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentComposer } from '@/components/event-outfits/CommentComposer';
import { CommentRow, type ThreadComment } from '@/components/event-outfits/CommentRow';
import { lookName } from '@/components/event-outfits/OutfitPostCard';
import { VotePill } from '@/components/event-outfits/VotePill';
import { LookPlate } from '@/components/look/look-plate';
// Batch-1 seam: the shared states kit.
import { ErrorState } from '@/components/ui/error-state';
import { NoticeBand } from '@/components/ui/notice-band';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  CLOSED_THREAD_TITLE,
  audienceScopeLine,
  closedThreadLine,
  commentCountLine,
} from '@/features/event-outfits/comment-thread';
import { useEventPosts, useMyVote } from '@/features/event-outfits/queries';
import type { PostedLook } from '@/features/event-outfits/types';
import {
  socialErrorMessage,
  useCastVote,
  useDeleteComment,
  useHideComment,
  useRetractVote,
} from '@/features/event-outfits/mutations';
import { useCommentThread } from '@/features/event-outfits/use-comment-thread';
import { voteCountLine } from '@/features/event-outfits/board-copy';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { useEvent, useEventMembers } from '@/features/events/queries';
import { useEventChannel } from '@/features/events/use-event-channel';
import { REPORT_REASONS, useReportContent } from '@/features/social-graph/moderation';
import { useTheme } from '@/theme/tokens';

/**
 * One option card in the voting rail. Narrower than the board's snapping card
 * on purpose: this is a row of choices to compare at a glance with the
 * conversation about them directly underneath, not a rail to live in.
 */
const OPTION_CARD = 132;

/** The rail's own label. Says what the row is FOR, in the sheet's own words. */
const OUTFIT_VOTING_EYEBROW = 'Outfit voting';

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
 * The options, with their vote controls, at the top of the merged sheet.
 *
 * ── WHY THIS IS HERE AND NOT ON A BOARD OF ITS OWN ────────────────────────
 *
 * The founder's items 7 and 8. `Every option` was a separate screen and
 * `Table talk` was a separate route, so deciding what everybody should wear
 * meant reading in one place and saying so in another — and the poster carried
 * a menu row for each. They are one sheet now: the looks across the top, the
 * conversation beneath them, one door down from the poster.
 *
 * ── WHAT IS COPIED AND WHAT IS NOT ────────────────────────────────────────
 *
 * The visibility semantics are the board's, EXACTLY, because they are a
 * privacy decision rather than a layout one:
 *
 *  · the read is `useEventPosts`, which is gated on membership by RLS and is
 *    the same query the board fires — no wider select, no second source;
 *  · the tally is a BARE COUNT (`voteCountLine`) and never a list of voters.
 *    The board deleted the names deliberately — "a rail that prints who voted
 *    for which friend's clothes turns a vote into a public statement about
 *    somebody else's outfit" — and this must not quietly restore them;
 *  · `Your vote` in blush is the one thing a reader learns about a person, and
 *    that person is themselves;
 *  · zero is quiet: a look nobody has picked prints no count at all;
 *  · the caller's own look gets a tally and no control (`mine`), the DB refuses
 *    a self-vote anyway (22023), and a locked board keeps its counts and loses
 *    its buttons.
 *
 * Nothing here is a new mutation: `useCastVote` / `useRetractVote` are the
 * board's, including the delete-then-insert that makes the one pick movable.
 */
function OutfitVoting({
  looks,
  eventId,
  me,
  locked,
  nameOf,
  resolveImage,
}: {
  looks: PostedLook[];
  eventId: string;
  me: string | null;
  locked: boolean;
  nameOf: (userId: string) => string | null;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
}) {
  const theme = useTheme();
  const terms = useSocialTermsGate();
  const myVote = useMyVote(eventId);
  const castVote = useCastVote();
  const retractVote = useRetractVote();
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const currentPickId = myVote.data?.postId ?? null;

  const toggle = useCallback(
    (look: PostedLook) => {
      const from = currentPickId;
      const to = from === look.id ? null : look.id;
      const run = () => {
        setFailedFor(null);
        const opts = {
          onError: (error: unknown) => {
            if (terms.intercept(error, run)) return;
            setFailedFor(look.id);
            Alert.alert('That pick didn’t land', socialErrorMessage(error));
          },
        };
        if (to === null) retractVote.mutate({ eventId }, opts);
        else castVote.mutate({ eventId, postId: look.id }, opts);
      };
      run();
    },
    [castVote, currentPickId, eventId, retractVote, terms],
  );

  if (looks.length === 0) return null;

  return (
    <View className="border-b border-hairline pb-4">
      <Text variant="eyebrow" className="px-gutter pb-2.5">
        {OUTFIT_VOTING_EYEBROW}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-gutter">
        {looks.map((look) => {
          const mine = look.userId === me;
          const countLine = voteCountLine(look.votes);
          const picked = currentPickId === look.id;
          const posterName = nameOf(look.userId);
          return (
            <View key={look.id} style={{ width: OPTION_CARD }} className="gap-2">
              <LookPlate
                pieces={look.garments}
                width={OPTION_CARD}
                resolveImage={resolveImage}
                padding={6}
                gap={3}
              />
              <Text variant="label" numberOfLines={1}>
                {lookName(look.garments, look.caption)}
              </Text>
              {posterName ? (
                <Text variant="caption" numberOfLines={1}>
                  {posterName}
                </Text>
              ) : null}
              <VotePill
                votes={look.votes}
                picked={picked}
                mine={mine}
                locked={locked}
                pending={
                  (castVote.isPending && castVote.variables?.postId === look.id) ||
                  (retractVote.isPending && picked)
                }
                failed={failedFor === look.id}
                onToggle={() => toggle(look)}
                onRetry={() => toggle(look)}
              />
              {countLine ? (
                <Text variant="note">
                  {countLine}
                  {/* `RNText` inside a `Text`, the way the board's own card
                      does it: a nested variant component would re-apply its
                      whole style and break the run. */}
                  {picked ? (
                    <RNText style={{ color: theme.accent }}>{' · Your vote'}</RNText>
                  ) : null}
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      {terms.sheet}
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

  /**
   * Every option on this occasion, in posting order — the board's one rail,
   * moved here. Only for the EVENT thread: a deep link to one look's own
   * thread is already about that look, and printing the whole slate above it
   * would make the sheet argue with its own title.
   */
  const votableLooks = useMemo(
    () =>
      postId
        ? []
        : [...(posts.data?.looks ?? [])].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          ),
    [posts.data, postId],
  );
  const { resolve } = useSignedUrls(
    votableLooks.flatMap((l) => l.garments.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
  );

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

          A serif word and the audience, no longer sharing one baseline.
          AUDIT 100 #60: the title and the full-width "ONLY THE INVITED CAN
          READ THIS" eyebrow used to sit in the same `flex-row`, each fighting
          the other for width — a long look name, or Dynamic Type on either
          string, collides them. The title now takes its own row in full, the
          way a navigation title would if this sheet drew one (it does not —
          see below); the privacy line drops to a compact subline directly
          under it, free to wrap on its own line without taking the title's
          space. The back chevron went with the push: the route is a sheet now
          (see `event/_layout.tsx`) and a sheet's way out is its grabber and
          its swipe, so a header row whose only content was a duplicate
          dismissal is a row of nothing.

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
        <View className="px-gutter pt-4">
          <Text variant="title" trim numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text variant="eyebrow" className="px-gutter pb-3 pt-1.5">
          {audienceScopeLine}
        </Text>
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
          <ScrollView contentContainerClassName="pb-4 pt-2">
            {/* The options, above the thread. Inside the scroll rather than
                pinned over it: at the accessibility sizes a fixed rail of
                cards and a fixed composer would leave the conversation three
                lines tall, and the conversation is what the sheet is. */}
            <OutfitVoting
              looks={votableLooks}
              eventId={eventId ?? ''}
              me={session.userId}
              locked={afterOccasion}
              nameOf={nameOf}
              resolveImage={resolve}
            />
            <View className="px-gutter">
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
            </View>
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
