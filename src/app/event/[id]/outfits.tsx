import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsSheet } from '@/components/event-outfits/CommentsSheet';
import { lookName, OutfitPostCard } from '@/components/event-outfits/OutfitPostCard';
import { Button } from '@/components/ui/button';
// Batch-1 seam: the shared states kit. `Skeleton` is the loading primitive,
// `ErrorState` the title/body/retry sibling of `EmptyState`.
import { ErrorState } from '@/components/ui/error-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  applyPickMove,
  favouriteId,
  pickLine,
  type LookTally,
  type PickLine,
  type PickMove,
} from '@/features/event-outfits/board-logic';
import {
  useEventComments,
  useEventPosts,
  useMyVote,
} from '@/features/event-outfits/queries';
import {
  socialErrorMessage,
  useCastVote,
  useDeletePost,
  useRetractVote,
} from '@/features/event-outfits/mutations';
import { MAX_LOOKS_PER_BOARD, type PostedLook } from '@/features/event-outfits/types';
import { useEvent, useEventMembers } from '@/features/events/queries';
import { useEventChannel } from '@/features/events/use-event-channel';
import { REPORT_REASONS, useBlockUser, useReportContent } from '@/features/social-graph/moderation';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Look Board — L-01…L-06 plus the Vote pill's six states (Look Board State
 * Atlas). One snapping rail across EVERY posted look in the event, not one
 * per attendee: `board-logic.ts`'s header explains why against the frozen
 * contract, which speaks of "the crown on the favourite" and "one crown, no
 * second or fifth" in the singular throughout. Rail order is posting order —
 * never vote order, never re-sorted as picks land.
 */

/** "Fri 8 Aug, 7:30pm" — the mock's metadata line. */
function whenLabel(d: Date | null): string | null {
  if (!d) return null;
  const day = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
    .replace(' ', '');
  return `${day}, ${time}`;
}

/** The day-of-week only, for "you can move it until Saturday." */
function untilWeekday(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

/** L-06's loading rail: one card-shaped skeleton, one blank next to it. */
function BoardSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <View className="flex-row gap-3 px-gutter pt-3" accessibilityLabel="Reading the board">
      <View style={{ width: cardWidth }}>
        <Skeleton className="h-44 rounded-plate" />
        <View className="mt-3 gap-2">
          <Skeleton className="h-3 w-2/5 rounded-sm" />
          <Skeleton className="h-5 w-3/5 rounded-sm" />
          <Skeleton className="mt-2 h-9 rounded-md" />
        </View>
      </View>
      <Skeleton className="h-72 rounded-plate" style={{ width: cardWidth * 0.3 }} />
    </View>
  );
}

export default function EventOutfitBoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ?? null;
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();
  const me = session.userId;
  const { width: winWidth } = useWindowDimensions();

  // Live votes/comments while this screen is open — EVENTS' channel hook
  // invalidates this feature's query keys; nothing here patches a cache.
  useEventChannel(eventId);

  const event = useEvent(eventId);
  const members = useEventMembers(eventId ?? '');
  const posts = useEventPosts(eventId);
  const myVote = useMyVote(eventId);
  const comments = useEventComments(eventId);

  const terms = useSocialTermsGate();
  const castVote = useCastVote();
  const retractVote = useRetractVote();
  const deletePost = useDeletePost();
  const report = useReportContent();
  const block = useBlockUser();

  const detail = event.data;
  // Posting order — `useEventPosts` already orders by `created_at` ascending;
  // re-sorted defensively so this screen never depends on query-internal order.
  const looks = useMemo(
    () => [...(posts.data?.looks ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [posts.data],
  );

  // The board locks when the evening starts: tallies freeze into crowns.
  // "Now" is sampled once per mount — a screen sitting open across the lock
  // moment updates on its next focus/refetch, which is honest enough; a
  // ticking clock during render is a purity violation the linter rightly
  // refuses. An occasion with no date never locks.
  const [openedAt] = useState(() => Date.now());
  const locked = detail?.startsAt ? openedAt >= detail.startsAt.getTime() : false;

  const nameOf = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of members.data ?? []) map.set(m.userId, m.displayName ?? m.username);
    return (userId: string): string | null =>
      userId === me ? 'You' : (map.get(userId) ?? null);
  }, [members.data, me]);

  const { urls } = useSignedUrls(
    looks.flatMap((l) => l.garments.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
  );
  const resolveImage = useCallback(
    (...paths: (string | null | undefined)[]): string | undefined => {
      for (const path of paths) if (path && urls[path]) return urls[path];
      return undefined;
    },
    [urls],
  );

  // ── The one pick, held on the board ───────────────────────────────────────
  // A tap answers optimistically before the write returns, and moves BOTH
  // cards in the same frame: the one joined and the one left. Held here, not
  // in any one card, because the arithmetic spans two cards a single
  // `VotePill` cannot see into each other.
  const [optimisticMove, setOptimisticMove] = useState<PickMove | null>(null);
  const [failedVotePostId, setFailedVotePostId] = useState<string | null>(null);

  // L-02's five-second undo toast — "Your pick moved to X" on a move, and
  // (per the Vote pill states: "pressing Picked again returns you to no
  // pick, which is the one case where the count falls with nothing rising,
  // so it takes the toast") the retraction gets one too. A first cast never
  // does: the pill itself is already the way to change your mind for that.
  const [moveToast, setMoveToast] = useState<{ message: string; fromPostId: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (toastTimer.current && clearTimeout(toastTimer.current)), []);

  const displayLooks = useMemo(
    () => (optimisticMove ? applyPickMove(looks, optimisticMove) : looks),
    [looks, optimisticMove],
  );
  const votesById = useMemo(
    () => new Map(displayLooks.map((l) => [l.id, l.votes])),
    [displayLooks],
  );

  // The board's one crown — sticky through a tie (board-logic.ts). The ref
  // carries the previous answer across renders; a fresh mount starts blank,
  // which is honest (nothing was watched climbing yet).
  const crownRef = useRef<string | null>(null);
  const crownId = useMemo(() => {
    const tallies: LookTally[] = displayLooks.map((l) => ({ id: l.id, votes: l.votes }));
    return favouriteId(tallies, crownRef.current);
  }, [displayLooks]);
  useEffect(() => {
    crownRef.current = crownId;
  }, [crownId]);

  const badgeFor = useCallback(
    (look: PostedLook): 'ahead' | 'favourite' | null =>
      crownId === look.id ? (locked ? 'favourite' : 'ahead') : null,
    [crownId, locked],
  );

  const currentPickId = optimisticMove ? optimisticMove.toPostId : (myVote.data?.postId ?? null);

  const pickLineFor = useCallback(
    (look: PostedLook) => {
      const iVoted = currentPickId === look.id;
      const otherNames = look.voterIds
        .filter((v) => v !== me)
        .map((v) => nameOf(v))
        .filter((n): n is string => Boolean(n))
        .map((n) => n.split(/\s+/)[0]!);
      return pickLine(votesById.get(look.id) ?? look.votes, iVoted, otherNames);
    },
    [currentPickId, me, nameOf, votesById],
  );

  const commentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of comments.data ?? []) {
      if (c.hidden) continue;
      counts.set(c.postId ?? '', (counts.get(c.postId ?? '') ?? 0) + 1);
    }
    return counts;
  }, [comments.data]);
  const commentCountFor = useCallback(
    (postId: string) => commentCounts.get(postId) ?? 0,
    [commentCounts],
  );

  const goPost = useCallback(
    () => router.push({ pathname: '/event/[id]/post', params: { id: eventId ?? '' } }),
    [router, eventId],
  );

  const showUndoToast = useCallback((fromPostId: string, message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setMoveToast({ message, fromPostId });
    toastTimer.current = setTimeout(() => setMoveToast(null), 5000);
  }, []);

  const toggleVote = useCallback(
    (look: PostedLook) => {
      if (!eventId) return;
      const from = myVote.data?.postId ?? null;
      const to = from === look.id ? null : look.id;

      const run = () => {
        setFailedVotePostId(null);
        setMoveToast(null);
        setOptimisticMove({ fromPostId: from, toPostId: to });
        const opts = {
          onSuccess: () => {
            // An existing pick changing state gets the five-second undo
            // toast — moving to a new look, or being taken back to nothing
            // ("the one case where the count falls with nothing rising, so
            // it takes the toast"). A first cast doesn't: the pill itself is
            // already the way to change your mind for that one.
            if (!from) return;
            showUndoToast(
              from,
              to
                ? `Your pick moved to ${lookName(look.garments, look.caption)}.`
                : 'Your pick was taken back.',
            );
          },
          onError: (error: unknown) => {
            setOptimisticMove(null);
            if (terms.intercept(error, run)) return;
            setFailedVotePostId(look.id);
            Alert.alert('That pick didn’t land', socialErrorMessage(error));
          },
          onSettled: () => setOptimisticMove(null),
        };
        if (to === null) {
          retractVote.mutate({ eventId }, opts);
        } else {
          castVote.mutate({ eventId, postId: look.id }, opts);
        }
      };
      run();
    },
    [eventId, myVote.data?.postId, retractVote, castVote, terms, showUndoToast],
  );

  const undoMove = useCallback(() => {
    if (!moveToast || !eventId) return;
    const backTo = moveToast.fromPostId;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setMoveToast(null);
    setOptimisticMove({ fromPostId: currentPickId, toPostId: backTo });
    castVote.mutate(
      { eventId, postId: backTo },
      {
        onError: (error: unknown) => Alert.alert('That didn’t undo', socialErrorMessage(error)),
        onSettled: () => setOptimisticMove(null),
      },
    );
  }, [moveToast, eventId, currentPickId, castVote]);

  const confirmDelete = useCallback(
    (look: PostedLook) => {
      if (!eventId) return;
      const mine = look.userId === me;
      Alert.alert(
        mine ? 'Take this look off the board?' : 'Retire this look?',
        'Its picks and comments go with it.',
        [
          // Contract §3: "its keep-option is named for the thing being
          // kept — never 'Cancel'."
          { text: 'Keep it on the board', style: 'cancel' },
          {
            text: mine ? 'Take it off' : 'Retire',
            style: 'destructive',
            onPress: () =>
              deletePost.mutate(
                { eventId, postId: look.id },
                { onError: (error) => Alert.alert('That didn’t work', socialErrorMessage(error)) },
              ),
          },
        ],
      );
    },
    [eventId, deletePost, me],
  );

  const reportLook = useCallback(
    (look: PostedLook) => {
      Alert.alert('Report this look', 'What’s wrong with it?', [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () =>
            report.mutate(
              { subject: 'outfit_post' as const, subjectId: look.id, subjectUserId: look.userId, reason },
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

  const confirmBlock = useCallback(
    (look: PostedLook) => {
      const who = nameOf(look.userId) ?? 'this person';
      Alert.alert(
        `Block ${who}?`,
        'Their looks, picks and comments leave your board — here and everywhere else in Cinch. They won’t be told.',
        [
          { text: `Keep seeing ${who}`, style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () =>
              block.mutate(
                { userId: look.userId },
                { onError: (error: unknown) => Alert.alert('That didn’t work', socialErrorMessage(error)) },
              ),
          },
        ],
      );
    },
    [nameOf, block],
  );

  const shareLook = useCallback(
    (look: PostedLook) => {
      const posterFirst = (look.userId === me ? 'Your' : (nameOf(look.userId) ?? "A friend's")) + ' look';
      void Share.share({ message: `${posterFirst} on ${detail?.title ?? 'the board'} — take a look on Cinch.` });
    },
    [nameOf, me, detail?.title],
  );

  const votePendingFor = useCallback(
    (postId: string) =>
      (castVote.isPending && castVote.variables?.postId === postId) ||
      (retractVote.isPending && myVote.data?.postId === postId),
    [castVote.isPending, castVote.variables?.postId, retractVote.isPending, myVote.data?.postId],
  );

  // ── Comments sheet (L-03) — over the board, not a route ───────────────────
  const [openCommentsFor, setOpenCommentsFor] = useState<PostedLook | null>(null);
  const hostName = detail?.hostId ? nameOf(detail.hostId) : null;

  const backRow = <ScreenHeader align="leading" title="Event" />;

  if (event.isError || posts.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        {backRow}
        <ErrorState
          title="The board didn’t load"
          body="Nobody’s look is lost — the connection dropped on the way. Your pick is still where you left it."
          onRetry={() => {
            void event.refetch();
            void posts.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  const cardWidth = Math.round(winWidth - GUTTER - 44);

  if (event.isLoading || posts.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        {backRow}
        <View className="px-gutter">
          <Skeleton className="mt-5 h-9 w-2/3 rounded-md" />
          <Skeleton className="mt-4 h-4 w-1/2 rounded-sm" />
        </View>
        <BoardSkeleton cardWidth={cardWidth} />
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <ErrorState
          title="This event is gone"
          body="It may have been canceled, or you may have been removed."
          onRetry={() => router.back()}
          retryTitle="Back"
        />
      </SafeAreaView>
    );
  }

  const totalPicks = displayLooks.reduce((sum, l) => sum + l.votes, 0);
  const until = untilWeekday(detail.startsAt);
  const subtitle = locked
    ? `Voting closed. ${displayLooks.length === 1 ? '1 look' : `${displayLooks.length} looks`}, ${totalPicks} ${totalPicks === 1 ? 'pick' : 'picks'} between them.`
    : `${displayLooks.length === 1 ? '1 look' : `${displayLooks.length} looks`} on the table. You have one pick${until ? ` — you can move it until ${until}` : ''}.`;

  const myLookCount = looks.filter((l) => l.userId === me).length;

  const crownedLook = crownId ? displayLooks.find((l) => l.id === crownId) : null;
  const closingNote = locked
    ? crownedLook
      ? `Everyone’s picks are in. ${nameOf(crownedLook.userId) ?? 'A friend'}’s look took the room.`
      : 'Everyone’s picks are in — a tie holds the room this time.'
    : detail.startsAt
      ? `Voting closes ${whenLabel(detail.startsAt)}. Everyone sees the counts; nobody sees who didn’t vote.`
      : 'Everyone sees the counts; nobody sees who didn’t vote.';

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-24">
        {backRow}

        <View className="px-gutter pt-5">
          <Text variant="title" trim>
            {detail.title}
          </Text>
          <Text variant="callout" className="mt-3 text-muted">
            {[whenLabel(detail.startsAt), detail.venueName].filter(Boolean).join(' · ')}
            {detail.dressCode ? ` · ${detail.dressCode}` : ''}
          </Text>

          <SectionHeader
            title="Every option"
            className="mt-6"
            trailing={
              <Text variant="colophon">
                {looks.length === 1 ? '1 look' : `${looks.length} looks`}
              </Text>
            }
          />

          {looks.length > 0 ? (
            <Text variant="callout" className="mt-1.5 text-muted">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {looks.length === 0 ? (
          // L-06 · nobody has posted yet — the only thing that fills it is
          // someone posting, so the state is one instruction with the button
          // under it.
          <View className="mx-gutter mt-6">
            <Text variant="eyebrow" className="mb-2">
              Nobody has posted yet
            </Text>
            <Text variant="title" trim>
              Be the first on the board
            </Text>
            <Text variant="callout" className="mt-2 text-muted">
              Boards fill up fast once one look is on them. Post yours and the others follow.
            </Text>
            {!detail.canceledAt ? (
              <Button title="Share your look" haptic onPress={goPost} className="mt-4 self-start px-6" />
            ) : null}
          </View>
        ) : (
          <BoardRail
            looks={displayLooks}
            cardWidth={cardWidth}
            me={me}
            locked={locked}
            currentPickId={currentPickId}
            failedVotePostId={failedVotePostId}
            isHost={detail.isHost}
            canceled={Boolean(detail.canceledAt)}
            nameOf={nameOf}
            resolveImage={resolveImage}
            commentCountFor={commentCountFor}
            badgeFor={badgeFor}
            pickLineFor={pickLineFor}
            votePendingFor={votePendingFor}
            onToggleVote={toggleVote}
            onReport={reportLook}
            onBlock={confirmBlock}
            onDelete={confirmDelete}
            onShare={shareLook}
            onShareAnother={myLookCount < MAX_LOOKS_PER_BOARD ? goPost : undefined}
            onAddYours={goPost}
            onOpenComments={setOpenCommentsFor}
          />
        )}

        {looks.length > 0 ? (
          <View className="mx-gutter mt-5 rounded-plate bg-tray px-4 py-3.5">
            <Text variant="callout" className="text-muted">
              {closingNote}
            </Text>
          </View>
        ) : null}

        {locked && looks.length > 0 ? (
          // L-05's closing pair. "Save mine to Lately" stays unbuilt — Cinch
          // has no save-to-Lately mutation anywhere yet, and this screen
          // isn't the place to invent one; see
          // .redesign/primitive-requests/board-comments.md.
          <Button
            title="Share the board"
            variant="secondary"
            haptic
            onPress={() =>
              void Share.share({
                message: `${detail.title} — the board's closed and the picks are in. Take a look on Cinch.`,
              })
            }
            className="mx-gutter mt-3 self-stretch"
          />
        ) : null}

        {/* ── Table talk — the event-level thread, still its own route ── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the event conversation"
          onPress={() =>
            router.push({ pathname: '/event/[id]/comments', params: { id: eventId ?? '' } })
          }
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mx-gutter mt-3 flex-row items-center justify-between rounded-plate border border-rule bg-surface px-4 py-3.5 active:opacity-70">
          <View className="flex-row items-center gap-2.5">
            <SymbolView name="text.bubble" size={16} tintColor={theme.muted} resizeMode="scaleAspectFit" />
            <Text variant="body">Table talk</Text>
          </View>
          <Text variant="colophon">
            {(comments.data ?? []).filter((c) => !c.hidden).length || ''}
          </Text>
        </Pressable>
      </ScrollView>

      <CommentsSheet
        visible={openCommentsFor !== null}
        onClose={() => setOpenCommentsFor(null)}
        eventId={eventId ?? ''}
        look={openCommentsFor}
        posterName={openCommentsFor ? nameOf(openCommentsFor.userId) : null}
        pickCount={openCommentsFor ? (votesById.get(openCommentsFor.id) ?? openCommentsFor.votes) : 0}
        isHost={detail.isHost}
        hostName={hostName}
        memberCount={members.data?.length ?? null}
        resolveImage={resolveImage}
        nameOf={nameOf}
      />

      {moveToast ? (
        // L-02's undo toast — five seconds, not a permanent control, because
        // the pill itself is already the way to change your mind.
        <View
          pointerEvents="box-none"
          className="absolute bottom-6 left-0 right-0 px-gutter">
          <View
            className="flex-row items-center gap-2.5 rounded-plate px-4 py-3.5"
            style={{ backgroundColor: theme.blush, borderColor: theme.blushRule, borderWidth: 1 }}>
            <Text variant="callout" className="flex-1">
              {moveToast.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo — move your pick back"
              onPress={undoMove}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET - 20 }}>
              <Text variant="label" className="font-semibold" style={{ color: theme.accent }}>
                Undo
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {terms.sheet}
    </SafeAreaView>
  );
}

/** The gap between two cards in the rail. */
const CARD_GAP = 12;

/**
 * The board's one rail — every posted look, mixed posters, posting order,
 * snapping card to card with 40–50pt of the next showing. Dot pagination
 * tracks the settled card; a one-look board centres its single card with no
 * peek and no dots (L-06).
 */
const BoardRail = memo(function BoardRail({
  looks,
  cardWidth,
  me,
  locked,
  currentPickId,
  failedVotePostId,
  isHost,
  canceled,
  nameOf,
  resolveImage,
  commentCountFor,
  badgeFor,
  pickLineFor,
  votePendingFor,
  onToggleVote,
  onReport,
  onBlock,
  onDelete,
  onShare,
  onShareAnother,
  onAddYours,
  onOpenComments,
}: {
  looks: PostedLook[];
  cardWidth: number;
  me: string | null;
  locked: boolean;
  currentPickId: string | null;
  failedVotePostId: string | null;
  isHost: boolean;
  canceled: boolean;
  nameOf: (userId: string) => string | null;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  commentCountFor: (postId: string) => number;
  badgeFor: (look: PostedLook) => 'ahead' | 'favourite' | null;
  pickLineFor: (look: PostedLook) => PickLine | null;
  votePendingFor: (postId: string) => boolean;
  onToggleVote: (look: PostedLook) => void;
  onReport: (look: PostedLook) => void;
  onBlock: (look: PostedLook) => void;
  onDelete: (look: PostedLook) => void;
  onShare: (look: PostedLook) => void;
  onShareAnother?: () => void;
  onAddYours: () => void;
  onOpenComments: (look: PostedLook) => void;
}) {
  const [index, setIndex] = useState(0);
  const single = looks.length === 1;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setIndex(Math.round(x / (cardWidth + CARD_GAP)));
  };

  return (
    <View className="mt-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={single ? undefined : cardWidth + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerClassName="gap-3 px-gutter"
        // A single-look board centres its one card — no peek, no rail to scroll.
        contentContainerStyle={single ? { justifyContent: 'center', width: '100%' } : undefined}>
        {looks.map((look) => {
          const isMine = look.userId === me;
          return (
            <View key={look.id} style={{ width: cardWidth }}>
              <OutfitPostCard
                look={look}
                posterName={nameOf(look.userId)}
                pickLine={pickLineFor(look)}
                isMine={isMine}
                badge={badgeFor(look)}
                locked={locked}
                picked={currentPickId === look.id}
                votePending={votePendingFor(look.id)}
                voteFailed={failedVotePostId === look.id}
                resolveImage={resolveImage}
                width={cardWidth}
                onToggleVote={() => onToggleVote(look)}
                onRetryVote={() => onToggleVote(look)}
                onAddYours={single && !canceled ? onAddYours : undefined}
                onShare={!isMine ? () => onShare(look) : undefined}
                onShareAnother={
                  isMine && !locked && !canceled ? onShareAnother : undefined
                }
                onReport={!isMine ? () => onReport(look) : undefined}
                onBlock={!isMine ? () => onBlock(look) : undefined}
                onDelete={isMine || isHost ? () => onDelete(look) : undefined}
                onOpenComments={() => onOpenComments(look)}
                commentCount={commentCountFor(look.id)}
              />
            </View>
          );
        })}
      </ScrollView>

      {!single && looks.length > 1 ? (
        <View className="mt-4 flex-row items-center justify-center gap-1.5">
          {looks.map((look, i) => (
            <View
              key={look.id}
              className="rounded-full bg-ink"
              style={{
                width: i === index ? 18 : 4,
                height: 4,
                opacity: i === index ? 1 : 0.22,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});
