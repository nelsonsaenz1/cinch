import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AttendeeLookCard,
  InitialAvatar,
  OutfitPostCard,
  PlateTriptych,
  lookDescriptor,
  lookName,
} from '@/components/event-outfits/OutfitPostCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The YOUR LOOK card's blush treatment (founder-mocks §1b): rose-tinted sand
 * with a hairline rose border. Local literals, not theme tokens — this
 * surface exists on exactly one card in the app, and a token would invite it
 * elsewhere. Derived from accentWarm (#B08A76) over tray.
 */
const BLUSH_SURFACE = '#F7EDE8';
const BLUSH_BORDER = 'rgba(176,138,118,0.45)';

/** "Fri 8 Aug, 7:30pm" — the mock's metadata line. */
function whenLabel(d: Date): string {
  const day = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
    .replace(' ', '');
  return `${day}, ${time}`;
}

/**
 * The board — the event's outfit page. Founder-mocks §1b above the fold
 * (YOUR LOOK, WHO'S WEARING WHAT), product-spec §3.3–3.5 mechanics below it:
 * per-attendee bands of options with signed, movable picks. Grouping by
 * attendee is load-bearing — the page helps each person decide, it never
 * ranks people against each other.
 *
 * This is its own route rather than part of EVENTS' detail screen because
 * file-based routing is the decoupler between the two agents' work: the
 * detail screen links here by path string and imports nothing from this
 * feature.
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

  const { resolve } = useSignedUrls(
    looks.flatMap((l) => l.garments.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
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

  const myBoard = orderedBoards.find((b) => b.userId === me) ?? null;
  const otherBoards = orderedBoards.filter((b) => b.userId !== me);

  const joinedCount = (members.data ?? []).filter((m) => m.state === 'joined').length;
  const sharedCount = boards.length;

  const commentCountFor = (postId: string) =>
    (comments.data ?? []).filter((c) => c.postId === postId && !c.hidden).length;

  // Signed picks by first name — "Picked by Dana, Maria". A voter the roster
  // query can't name (removed member) is dropped rather than shown as a blank.
  const voterNamesFor = (look: PostedLook): string[] =>
    look.voterIds
      .map((v) => nameOf(v))
      .filter((n): n is string => Boolean(n))
      .map((n) => n.split(/\s+/)[0]);

  const goPost = () =>
    router.push({ pathname: '/event/[id]/post', params: { id: eventId ?? '' } });
  const goComments = (postId?: string) =>
    router.push({
      pathname: '/event/[id]/comments',
      params: postId ? { id: eventId ?? '', post: postId } : { id: eventId ?? '' },
    });

  const toggleVote = (look: PostedLook) => {
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
  };

  const confirmDelete = (look: PostedLook) => {
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
  };

  const votePendingFor = (postId: string) =>
    (castVote.isPending && castVote.variables?.postId === postId) ||
    (retractVote.isPending && myVote.data?.postId === postId);

  if (event.isLoading || posts.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color={theme.muted} />
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

  const myLeading = myBoard ? (boardLeader(myBoard.looks) ?? myBoard.looks[0]) : null;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-24">
        {/* ── Back row: chevron + small-caps EVENT (founder-mocks §1b) ── */}
        <View className="flex-row items-center gap-3 px-gutter pt-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60">
            <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
          </Pressable>
          <Text variant="colophon">Event</Text>
        </View>

        <View className="px-gutter">
          <Text variant="display" trim className="mt-5">
            {detail.title}
          </Text>
          {/* Metadata line. Weather is display-only enrichment with no venue
              forecast source yet — the mock's fallback is location only. */}
          <Text variant="callout" className="mt-3 text-muted">
            {[whenLabel(detail.startsAt), detail.venueName].filter(Boolean).join(' · ')}
            {detail.dressCode ? ` · ${detail.dressCode}` : ''}
          </Text>

          {/* ── YOUR LOOK — the viewer's own board, blush-set ── */}
          <View
            className="mt-6 rounded-plate border p-4"
            style={{ backgroundColor: BLUSH_SURFACE, borderColor: BLUSH_BORDER, borderWidth: 1 }}>
            <Text variant="colophon" style={{ color: theme.accent }}>
              Your look
            </Text>

            {myLeading ? (
              <>
                <View className="mt-3 flex-row items-center gap-3">
                  <PlateTriptych garments={myLeading.garments} resolveImage={resolve} cell={52} />
                </View>
                <Text variant="plate" numberOfLines={1} className="mt-3">
                  {lookName(myLeading.garments, myLeading.caption)}
                </Text>
                <Text variant="label" numberOfLines={1} className="mt-1">
                  {myLeading.caption ? lookDescriptor(myLeading.garments) : 'Your friends are picking below.'}
                </Text>
              </>
            ) : (
              <Text variant="callout" className="mt-3 text-muted">
                Nothing shared yet — pick a look from your closet and let the
                table weigh in.
              </Text>
            )}

            {!locked ? (
              <View className="mt-4 flex-row gap-2">
                {myLeading ? (
                  <Button
                    title="Swap a piece"
                    variant="secondary"
                    haptic
                    onPress={goPost}
                    className="flex-1"
                  />
                ) : null}
                <Button
                  title={myLeading ? 'Share another' : 'Share with group'}
                  variant="secondary"
                  haptic
                  onPress={goPost}
                  className="flex-1"
                />
              </View>
            ) : null}
          </View>

          {/* ── WHO'S WEARING WHAT — each attendee's leading look ── */}
          <View className="mt-8 flex-row items-baseline justify-between">
            <Text variant="eyebrow">Who’s wearing what</Text>
            <Text variant="colophon">
              {sharedCount} of {Math.max(joinedCount, sharedCount)} shared
            </Text>
          </View>

          {otherBoards.length === 0 && !myBoard ? (
            <View className="mt-4 rounded-plate border border-hairline bg-surface p-5">
              <Text variant="body" className="text-muted">
                Be the first to the mirror — share a look and the table follows.
              </Text>
            </View>
          ) : (
            <View className="-mx-1.5 mt-3 flex-row flex-wrap">
              {orderedBoards.map((board) => {
                const leading = boardLeader(board.looks) ?? board.looks[0];
                if (!leading) return null;
                return (
                  <View key={board.userId} className="w-1/2 p-1.5">
                    <AttendeeLookCard
                      look={leading}
                      attendeeName={nameOf(board.userId)}
                      resolveImage={resolve}
                      onPress={() => goComments(leading.id)}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Below the fold: the boards — help each person decide ── */}
        {orderedBoards.map((board) => (
          <BoardBand
            key={board.userId}
            board={board}
            name={nameOf(board.userId)}
            isMineBoard={board.userId === me}
            locked={locked}
            myVotePostId={myVote.data?.postId ?? null}
            isHost={detail.isHost}
            me={me}
            resolveImage={resolve}
            commentCountFor={commentCountFor}
            voterNamesFor={voterNamesFor}
            onToggleVote={toggleVote}
            onDelete={confirmDelete}
            onOpenComments={goComments}
            votePendingFor={votePendingFor}
          />
        ))}

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

/**
 * One attendee's band: her name and state, then her options side by side.
 * Pre-lock a member with no looks is "still deciding" — a state, not a
 * deficiency — and post-lock she simply has no band (absence gets no
 * spotlight, product-spec §5).
 */
function BoardBand({
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
        <InitialAvatar name={isMineBoard ? 'You' : name} size={24} />
        <Text variant="heading" className="flex-1" numberOfLines={1}>
          {displayName}
        </Text>
        <Text variant="colophon">{stateLine}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-gutter pt-3">
        {board.looks.map((look) => (
          <View key={look.id} style={{ width: 300 }}>
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
              onDelete={look.userId === me || isHost ? () => onDelete(look) : undefined}
              onOpenComments={() => onOpenComments(look.id)}
              commentCount={commentCountFor(look.id)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
