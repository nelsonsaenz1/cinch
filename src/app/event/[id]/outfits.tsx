import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OutfitPostCard } from '@/components/event-outfits/OutfitPostCard';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
// Batch-1 seam: the shared states kit. `Skeleton` is the loading primitive,
// `ErrorState` the title/body/retry sibling of `EmptyState`.
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useSignedUrls } from '@/features/closet/use-image-urls';
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
import { boardLeader, type AttendeeBoard, type PostedLook } from '@/features/event-outfits/types';
import { useEvent, useEventMembers } from '@/features/events/queries';
import { useEventChannel } from '@/features/events/use-event-channel';
import { REPORT_REASONS, useBlockUser, useReportContent } from '@/features/social-graph/moderation';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The same four reasons the comment thread and the profile screen offer —
 * the `content_reports.reason` column is free text, so the vocabulary is the
 * client's to keep consistent, and a reviewer reading the queue should see one
 * set of words whatever surface a report came from.
 */
/** "Fri 8 Aug, 7:30pm" — the mock's metadata line. */
function whenLabel(d: Date): string {
  const day = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
    .replace(' ', '');
  return `${day}, ${time}`;
}

/** Two bands' worth of shape while the board loads — a name row and a card. */
function BoardSkeleton() {
  return (
    <View accessibilityLabel="Reading the board">
      {[0, 1].map((i) => (
        <View key={i} className="mt-8">
          <View className="flex-row items-center gap-2.5 px-gutter">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-5 flex-1 rounded-md" />
          </View>
          <View className="px-gutter pt-3">
            {/* The card width the bands actually scroll at. */}
            <Skeleton className="h-72 rounded-plate" style={{ width: CARD_WIDTH }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Every option — the deciding surface. Per-attendee bands of looks with
 * signed, movable picks (product-spec §3.3–3.5). Grouping by attendee is
 * load-bearing: the page helps each person decide, it never ranks people
 * against each other.
 *
 * The founder mock's above-the-fold pair — YOUR LOOK and the WHO'S WEARING
 * WHAT grid — used to open this screen. They now open the event detail page
 * itself (`./index.tsx`, the composition point), which is where the mock and
 * the field guide both draw them, and this route is what it always was
 * underneath: all the options, side by side, with the picks on them.
 */
export default function EventOutfitBoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ?? null;
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();
  const me = session.userId;

  // Live votes/comments while this screen is open — EVENTS' channel hook
  // invalidates this feature's query keys; nothing here patches a cache.
  useEventChannel(eventId);

  const event = useEvent(eventId);
  const members = useEventMembers(eventId ?? '');
  const posts = useEventPosts(eventId);
  const myVote = useMyVote(eventId);
  const comments = useEventComments(eventId);

  const castVote = useCastVote();
  const retractVote = useRetractVote();
  const deletePost = useDeletePost();
  const report = useReportContent();
  const block = useBlockUser();

  const detail = event.data;
  const looks = useMemo(() => posts.data?.looks ?? [], [posts.data]);
  const boards = useMemo(() => posts.data?.boards ?? [], [posts.data]);

  // The board locks when the evening starts: tallies freeze into crowns.
  // "Now" is sampled once per mount — a screen sitting open across the lock
  // moment updates on its next focus/refetch, which is honest enough; a
  // ticking clock during render is a purity violation the linter rightly
  // refuses.
  const [openedAt] = useState(() => Date.now());
  const locked = detail ? openedAt >= detail.startsAt.getTime() : false;

  const nameOf = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of members.data ?? []) map.set(m.userId, m.displayName ?? m.username);
    return (userId: string): string | null =>
      userId === me ? 'You' : (map.get(userId) ?? null);
  }, [members.data, me]);

  const { urls } = useSignedUrls(
    looks.flatMap((l) => l.garments.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
  );

  /**
   * `useSignedUrls` builds a fresh `resolve` closure on every render, which
   * would quietly defeat `BoardBand`'s memo on the heaviest screen in the app
   * — every band draws Skia canvases. The hook itself is protected and not
   * this screen's to change, so the stable identity is made here over the URL
   * map it already exposes: the same lookup, re-created only when the map is.
   */
  const resolveImage = useCallback(
    (...paths: (string | null | undefined)[]): string | undefined => {
      for (const path of paths) if (path && urls[path]) return urls[path];
      return undefined;
    },
    [urls],
  );

  // Boards ordered: mine first, then roster order, then any stray poster.
  const orderedBoards = useMemo(() => {
    const roster = (members.data ?? []).map((m) => m.userId);
    return [...boards].sort((a, b) => {
      if (a.userId === me) return -1;
      if (b.userId === me) return 1;
      return roster.indexOf(a.userId) - roster.indexOf(b.userId);
    });
  }, [boards, members.data, me]);

  // One pass over the thread instead of one filter per card: with a dozen
  // looks on the page the old `commentCountFor` walked the whole comment list
  // a dozen times on every render, and every realtime invalidation is a
  // render. Same for the voter names below.
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

  // Signed picks by first name — "Picked by Dana, Maria". A voter the roster
  // query can't name (removed member) is dropped rather than shown as a blank.
  const voterNames = useMemo(() => {
    const names = new Map<string, string[]>();
    for (const look of looks) {
      names.set(
        look.id,
        look.voterIds
          .map((v) => nameOf(v))
          .filter((n): n is string => Boolean(n))
          .map((n) => n.split(/\s+/)[0]!),
      );
    }
    return names;
  }, [looks, nameOf]);

  const voterNamesFor = useCallback(
    (look: PostedLook): string[] => voterNames.get(look.id) ?? [],
    [voterNames],
  );

  const goPost = () =>
    router.push({ pathname: '/event/[id]/post', params: { id: eventId ?? '' } });
  // The handlers below are `useCallback`s so `BoardBand`'s memo can hold —
  // rebuilt on every render they would make it a no-op. Each depends only on
  // the mutation object (stable across renders) and the event id.
  const goComments = useCallback(
    (postId?: string) =>
      router.push({
        pathname: '/event/[id]/comments',
        params: postId ? { id: eventId ?? '', post: postId } : { id: eventId ?? '' },
      }),
    [router, eventId],
  );

  const toggleVote = useCallback(
    (look: PostedLook) => {
      if (!eventId) return;
      const opts = {
        onError: (error: unknown) =>
          Alert.alert('That pick didn’t land', socialErrorMessage(error)),
      };
      if (myVote.data?.postId === look.id) {
        retractVote.mutate({ eventId }, opts);
      } else {
        castVote.mutate({ eventId, postId: look.id }, opts);
      }
    },
    [eventId, myVote.data?.postId, retractVote, castVote],
  );

  const confirmDelete = useCallback(
    (look: PostedLook) => {
      if (!eventId) return;
      Alert.alert('Retire this look?', 'Its picks and comments go with it.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retire',
          style: 'destructive',
          onPress: () =>
            deletePost.mutate(
              { eventId, postId: look.id },
              {
                onError: (error) => Alert.alert('That didn’t work', socialErrorMessage(error)),
              },
            ),
        },
      ]);
    },
    [eventId, deletePost],
  );

  /**
   * Report a look. Same two-step Alert the comment thread uses — reason first,
   * then a plain thank-you — and silent to its author, like every report in
   * the app. The board does not change underneath the reporter: a reported
   * look is for the operator to judge, and anyone who wants it gone from their
   * own screen has Block in the same menu.
   *
   * The thank-you promises review, not a deadline. "Reviewed within 24 hours"
   * is an SLA nobody committed to operationally, and a promise the app cannot
   * keep is worse than no promise on the one surface whose entire value is
   * being believed.
   */
  const reportLook = useCallback(
    (look: PostedLook) => {
      Alert.alert('Report this look', 'What’s wrong with it?', [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () =>
            report.mutate(
              {
                subject: 'outfit_post' as const,
                subjectId: look.id,
                subjectUserId: look.userId,
                reason,
              },
              {
                onSuccess: () => Alert.alert('Thank you', 'Every report is reviewed.'),
                onError: (error: unknown) =>
                  Alert.alert('That didn’t go through', socialErrorMessage(error)),
              },
            ),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    },
    [report],
  );

  /**
   * Block from the board. Account-level, not event-level: the words say so
   * before the button, because "block" here reaches every screen that person
   * appears on, not just this one. Their looks, picks and words leave this
   * event too — RLS decides that, not this screen; the invalidations inside
   * the hook are only the board catching up with what is already true.
   */
  const confirmBlock = useCallback(
    (look: PostedLook) => {
      const who = nameOf(look.userId) ?? 'this person';
      Alert.alert(
        `Block ${who}`,
        'Their looks, picks and comments leave your board — here and everywhere else in Cinch. They won’t be told.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () =>
              block.mutate(
                { userId: look.userId },
                {
                  onError: (error: unknown) =>
                    Alert.alert('That didn’t work', socialErrorMessage(error)),
                },
              ),
          },
        ],
      );
    },
    [nameOf, block],
  );

  const votePendingFor = useCallback(
    (postId: string) =>
      (castVote.isPending && castVote.variables?.postId === postId) ||
      (retractVote.isPending && myVote.data?.postId === postId),
    [castVote.isPending, castVote.variables?.postId, retractVote.isPending, myVote.data?.postId],
  );

  const backRow = <ScreenHeader align="leading" title="Event" />;

  // A failed fetch is not an empty board and not a deleted event. Both of
  // those had one branch here, and it read as "nobody has posted a look yet"
  // — the single most misleading sentence this screen could print.
  if (event.isError || posts.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        {backRow}
        <ErrorState
          title="The board didn’t load"
          body="Everyone’s looks and picks are still there — the connection dropped on the way."
          onRetry={() => {
            void event.refetch();
            void posts.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  if (event.isLoading || posts.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        {backRow}
        <View className="px-gutter">
          <Skeleton className="mt-5 h-9 w-2/3 rounded-md" />
          <Skeleton className="mt-4 h-4 w-1/2 rounded-sm" />
        </View>
        <BoardSkeleton />
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <EmptyState
          symbol="calendar.badge.exclamationmark"
          title="This event is gone"
          body="It may have been canceled, or you may have been removed."
          actionTitle="Back"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-24">
        {/* ── Back row: chevron + small-caps EVENT (founder-mocks §1b) ── */}
        {backRow}

        {/* Top gap on the container: the trimmed title cannot carry `mt-*`
            without stacking against trim's negative margins. */}
        <View className="px-gutter pt-5">
          <Text variant="title" trim>
            {detail.title}
          </Text>
          {/* Metadata line. Weather is display-only enrichment with no venue
              forecast source yet — the mock's fallback is location only. */}
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

          {!locked && !detail.canceledAt ? (
            <Button
              title="Share a look"
              variant="secondary"
              haptic
              onPress={goPost}
              className="mt-3 self-stretch"
            />
          ) : null}
        </View>

        {orderedBoards.length === 0 ? (
          <Card border="hairline" padding="xl" className="mx-gutter mt-6">
            <Text variant="body" className="text-muted">
              Be the first to the mirror — share a look and the table follows.
            </Text>
          </Card>
        ) : (
          orderedBoards.map((board) => (
            <BoardBand
              key={board.userId}
              board={board}
              name={nameOf(board.userId)}
              isMineBoard={board.userId === me}
              locked={locked}
              myVotePostId={myVote.data?.postId ?? null}
              isHost={detail.isHost}
              me={me}
              resolveImage={resolveImage}
              commentCountFor={commentCountFor}
              voterNamesFor={voterNamesFor}
              onToggleVote={toggleVote}
              onReport={reportLook}
              onBlock={confirmBlock}
              onDelete={confirmDelete}
              onOpenComments={goComments}
              votePendingFor={votePendingFor}
            />
          ))
        )}

        {/* ── Table talk — the event-level thread ── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the event conversation"
          onPress={() => goComments()}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mx-gutter mt-8 flex-row items-center justify-between rounded-plate border border-rule bg-surface px-4 py-3.5 active:opacity-70">
          <View className="flex-row items-center gap-2.5">
            <SymbolView name="text.bubble" size={16} tintColor={theme.muted} resizeMode="scaleAspectFit" />
            <Text variant="body">Table talk</Text>
          </View>
          <Text variant="colophon">
            {(comments.data ?? []).filter((c) => !c.hidden).length || ''}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The card width the rail scrolls at, and the gap between two of them. */
const CARD_WIDTH = 300;
const CARD_GAP = 12;

/**
 * One attendee's band: their name and state, then their options side by side.
 * Pre-lock a member with no looks is "still deciding" — a state, not a
 * deficiency — and post-lock they simply have no band (absence gets no
 * spotlight, product-spec §5).
 *
 * Memoized because this screen re-renders on every realtime invalidation and
 * every vote, and each band draws a Skia canvas per look. The screen passes
 * `useCallback`ed handlers and a `urls`-keyed `resolveImage` precisely so this
 * holds; adding an inline arrow at the call site silently turns it off again.
 */
const BoardBand = memo(function BoardBand({
  board,
  name,
  isMineBoard,
  locked,
  myVotePostId,
  isHost,
  me,
  resolveImage,
  commentCountFor,
  voterNamesFor,
  onToggleVote,
  onReport,
  onBlock,
  onDelete,
  onOpenComments,
  votePendingFor,
}: {
  board: AttendeeBoard;
  name: string | null;
  isMineBoard: boolean;
  locked: boolean;
  myVotePostId: string | null;
  isHost: boolean;
  me: string | null;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  commentCountFor: (postId: string) => number;
  voterNamesFor: (look: PostedLook) => string[];
  onToggleVote: (look: PostedLook) => void;
  onReport: (look: PostedLook) => void;
  onBlock: (look: PostedLook) => void;
  onDelete: (look: PostedLook) => void;
  onOpenComments: (postId: string) => void;
  votePendingFor: (postId: string) => boolean;
}) {
  const crowned = locked ? boardLeader(board.looks) : null;
  const displayName = isMineBoard ? 'Your board' : (name ?? 'A friend');
  const stateLine = locked
    ? crowned
      ? 'The table has decided'
      : 'The evening has started'
    : `${board.looks.length === 1 ? '1 look' : `${board.looks.length} looks`} · deciding`;

  return (
    <View className="mt-8">
      <View className="flex-row items-center gap-2.5 px-gutter">
        <Avatar name={isMineBoard ? 'You' : name} size={24} tone="accent" />
        <Text variant="heading" className="flex-1" numberOfLines={1}>
          {displayName}
        </Text>
        <Text variant="colophon">{stateLine}</Text>
      </View>

      {/* The rail snaps. These are the options a person is choosing between,
          one card at a time — a free-scrolling rail leaves two half-cards on
          screen and no card being considered. `start` alignment plus the
          gutter-sized inset keeps the settled card on the page's own margin,
          so a snapped rail reads as a page turning, not a carousel. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerClassName="gap-3 px-gutter pt-3">
        {board.looks.map((look) => (
          <View key={look.id} style={{ width: CARD_WIDTH }}>
            <OutfitPostCard
              look={look}
              posterName={name}
              voterNames={voterNamesFor(look)}
              isMine={look.userId === me}
              crowned={crowned?.id === look.id}
              locked={locked}
              picked={myVotePostId === look.id}
              votePending={votePendingFor(look.id)}
              resolveImage={resolveImage}
              onToggleVote={() => onToggleVote(look)}
              // Report and block are for other people's looks only; retiring
              // is the owner's or the host's. Your own card therefore still
              // carries a ⋯ — with one item in it.
              onReport={look.userId === me ? undefined : () => onReport(look)}
              onBlock={look.userId === me ? undefined : () => onBlock(look)}
              onDelete={look.userId === me || isHost ? () => onDelete(look) : undefined}
              onOpenComments={() => onOpenComments(look.id)}
              commentCount={commentCountFor(look.id)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
});
