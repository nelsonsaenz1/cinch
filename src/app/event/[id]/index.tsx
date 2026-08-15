import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttendeeLookGrid, type AttendeeLook } from '@/components/events/AttendeeLookGrid';
import { ConfirmSheet } from '@/components/events/ConfirmSheet';
import { YourLookCard } from '@/components/events/YourLookCard';
import { daysFromToday, weatherLineFor } from '@/components/events/EventCard';
import { DateSheet } from '@/components/events/date-sheet';
import { PlaceSheet } from '@/components/events/place-sheet';
import { DEFAULT_TIME_MINUTES, TimeSheet } from '@/components/events/time-sheet';
import { RosterRow } from '@/components/events/RosterRow';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast } from '@/features/context/weather';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { NoticeBand } from '@/components/ui/notice-band';
import {
  CANCELLATION_FACTS,
  HOST_CANCELLATION_FACTS,
  cancelledHeading,
  inviteeStatusLine,
  noLookYetLine,
} from '@/features/event-outfits/occasion-copy';
import { useEventComments, useEventPosts } from '@/features/event-outfits/queries';
import { boardLeader } from '@/features/event-outfits/types';
import { dateTimeLine, venueLines, viewerStanding } from '@/features/events/event-lines';
import { groupStyleNote } from '@/features/events/group-note';
import {
  socialDenialCopy,
  useCancelEvent,
  useLeaveEvent,
  useRemoveMember,
  useRespondToInvite,
  useUpdateEvent,
} from '@/features/events/mutations';
import { useOccasionWeather } from '@/features/events/occasion-weather';
import { useEvent, useEventMembers } from '@/features/events/queries';
import { useEventChannel } from '@/features/events/use-event-channel';
import { reservationLabel } from '@/features/events/venue-search';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** Open-Meteo's free forecast horizon; past it the metadata simply omits weather. */
const FORECAST_DAYS = 16;

/**
 * The viewer's standing RSVP state — "Hosting", "Going" — as the Event Detail
 * State Atlas draws it: an ink fill beside the outline action, never a
 * button.
 *
 * NO LONGER DRAWN ON THIS PAGE. LP-04 puts the viewer's standing in the header
 * as one quiet tracked word beside the back button, so the top of the page is
 * back-affordance, status, title, facts, look — in that order, with nothing
 * competing for the height the look needs. The component stays exported for
 * `dev-event-detail.tsx`, which photographs it.
 *
 * Inert on purpose. "Going" used to be a button whose press opened "Leave
 * this occasion?" — a trap in both directions. The exit lives where the host's
 * own exit lives, as a quiet `critical` link at the foot of the page.
 */
export function StatePill({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`You are ${label.toLowerCase()}`}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-center rounded-md bg-ink px-5">
      <Text variant="body" style={{ color: theme.canvas }}>
        {label}
      </Text>
    </View>
  );
}

/** A quiet push-row into the surfaces that keep their own route. */
export function NavRow({
  label,
  hint,
  trailing,
  role = 'button',
  onPress,
}: {
  label: string;
  hint?: string;
  trailing?: string;
  /** `link` for the outbound reservation, which leaves the app. */
  role?: 'button' | 'link';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-between gap-3 border-b border-hairline py-3 active:opacity-60">
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      {trailing ? <Text variant="colophon">{trailing}</Text> : null}
      <SymbolView name="chevron.right" size={12} tintColor={theme.faint} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

/**
 * One of LP-04's two scannable rows — a label over its fact, with the host's
 * repair action on the right when the fact is missing.
 *
 * NO FIXED HEIGHT. `minHeight` is the 44pt floor and the row grows from there,
 * so at AX3 and AX5 the venue's second line pushes the row taller instead of
 * being clipped inside a box sized for standard type (the implementation
 * plan's layout rule: "flexible min-height and vertical padding over
 * fixed-height text containers").
 *
 * When a repair action is given the WHOLE ROW is the control, rather than a
 * chip beside it: one 44pt target instead of a 44pt chip next to 200pt of
 * inert text that looks equally tappable, and one VoiceOver stop that reads
 * the fact and then what pressing it does.
 */
function FactRow({
  label,
  value,
  secondary,
  actionLabel,
  onAction,
  last = false,
}: {
  label: string;
  value: string;
  secondary?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  last?: boolean;
}) {
  const theme = useTheme();

  const body = (
    <>
      <View className="flex-1" style={{ flexBasis: 'auto' }}>
        <Text variant="colophon">{label}</Text>
        {/* 8pt, the minimum label-to-content step (LP-07). */}
        <Text variant="body" className="mt-2">
          {value}
        </Text>
        {secondary ? (
          <Text variant="label" className="mt-1">
            {secondary}
          </Text>
        ) : null}
      </View>
      {onAction ? (
        <Text variant="label" style={{ color: theme.accent }}>
          {actionLabel}
        </Text>
      ) : null}
    </>
  );

  const className = [
    'flex-row items-center justify-between gap-3 py-3',
    last ? '' : 'border-b border-hairline',
  ].join(' ');

  if (!onAction) {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={[label, value, secondary].filter(Boolean).join(', ')}
        style={{ minHeight: MIN_TAP_TARGET }}
        className={className}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onAction}
      accessibilityRole="button"
      accessibilityLabel={[label, value, secondary].filter(Boolean).join(', ')}
      accessibilityHint={actionLabel}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`${className} active:opacity-60`}>
      {body}
    </Pressable>
  );
}

/**
 * The page's shape while it loads — title, the two fact rows, and the blush
 * card — in the order LP-04 puts them, rather than a spinner in the middle of
 * an empty screen.
 */
export function DetailSkeleton() {
  return (
    <View className="px-gutter" accessibilityLabel="Opening this occasion">
      <Skeleton className="mt-5 h-9 w-2/3 rounded-md" />
      <View className="mt-6">
        <Skeleton className="h-12 w-full rounded-sm" />
        <Skeleton className="mt-3 h-12 w-full rounded-sm" />
      </View>
      <Skeleton className="mt-8 h-44 w-full rounded-plate" />
      <View className="-mx-1.5 mt-6 flex-row">
        <View className="w-1/2 p-1.5">
          <Skeleton className="aspect-[4/5] w-full rounded-plate" />
        </View>
        <View className="w-1/2 p-1.5">
          <Skeleton className="aspect-[4/5] w-full rounded-plate" />
        </View>
      </View>
    </View>
  );
}

/** The one destructive confirmation up at a time. */
type ConfirmState =
  | { kind: 'cancel' }
  | { kind: 'leave' }
  | { kind: 'remove'; userId: string; name: string }
  | null;

/**
 * Occasion detail — LP-04.
 *
 * ── The order, and why it is this order ────────────────────────────────────
 *
 * ABOVE THE FOLD, in this sequence and nothing between:
 *
 *   1. the back affordance, with the viewer's own standing as one quiet
 *      tracked word beside it;
 *   2. the event title;
 *   3. WHEN and WHERE as two scannable rows — a label over a fact, the
 *      forecast as the when-row's second line, the host's repair action on the
 *      right when a fact is missing;
 *   4. `Your look`, the page's primary content and its primary action.
 *
 * BELOW THE FOLD: who is wearing what and who is coming, the group note only
 * when there is one, then logistics and host controls.
 *
 * ── What was removed, and what replaced it ─────────────────────────────────
 *
 * The page used to open with a dense metadata line ("Sat, Aug 8, 7:30 PM ·
 * Bar Ideale · Feels 70°, clear evening"), a colophon of three more facts, a
 * status SENTENCE, a readiness sentence, and up to two further explanatory
 * notes — five stacked blocks of prose before the look. Every fact survives;
 * the sentences do not:
 *
 * · the metadata line and the venue card both printed the venue. It is printed
 *   once now, in the WHERE row, and the venue card's only unique content — the
 *   outbound reservation link — became a link row in the logistics list.
 * · `hostStatusLine` ("You are hosting. 6 invited, 4 ready.") restated the
 *   header's HOSTING, the guest list's "n going" and the board's "n of m
 *   shared". Three of those are labels beside the thing they count; the
 *   sentence was the fourth telling.
 * · `readyLine` ("4 have chosen a look") is `n of m shared`, one section down.
 * · the undated occasion's explanation and the host's "friends can be invited
 *   to an occasion with no date" note are what the WHEN row now says by being
 *   a labelled, tappable `No date yet`.
 *
 * The functions themselves are untouched in `occasion-copy.ts` — this page
 * stopped calling two of them.
 *
 * ── What is unchanged ──────────────────────────────────────────────────────
 *
 * Every capability, every membership and privacy gate, and every data
 * contract. §7.1 still withholds time, venue and weather from someone who has
 * only been invited — enforced now by `dateTimeLine`'s `coarse` flag and by
 * the WHERE row not rendering at all for a non-member. The board is still
 * gated on MEMBERSHIP rather than on the route. Attendance is still coarse in
 * both directions and no absent person is ever named.
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const theme = useTheme();
  const me = session.userId;

  const eventQuery = useEvent(id ?? null);
  const members = useEventMembers(id ?? '');

  const respond = useRespondToInvite();
  const leave = useLeaveEvent();
  const cancel = useCancelEvent();
  const removeMember = useRemoveMember();
  const update = useUpdateEvent();

  const [dateSheet, setDateSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [placeSheet, setPlaceSheet] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  // Live votes/comments for the board composed onto this page.
  useEventChannel(id ?? null);

  const event = eventQuery.data ?? null;
  const isMember = Boolean(event && (event.isHost || event.myState === 'joined'));

  // The board itself. Gated on MEMBERSHIP, not on `id`: event-social-
  // contract.md §3 — "the gate is membership, not the route." An invitee's
  // page fires no board read at all, rather than firing one the server is
  // certain to refuse and inventing an error branch for it.
  const boardEventId = isMember ? (id ?? null) : null;
  const posts = useEventPosts(boardEventId);
  const comments = useEventComments(boardEventId);

  // Display-only weather for the WHEN row, read at the VENUE's own
  // coordinates when the place was resolved through the gazetteer.
  const venueWeather = useOccasionWeather(event?.startsAt ?? null, event?.venueMeta ?? null);
  const { coords } = useStyleContext();
  const dayIndex = event ? daysFromToday(event.startsAt) : -1;
  const forecast = useQuery({
    queryKey: [
 'forecast',
      coords.latitude.toFixed(2),
      coords.longitude.toFixed(2),
      FORECAST_DAYS,
    ],
    enabled: isMember && !event?.venueMeta && dayIndex >= 0 && dayIndex < FORECAST_DAYS,
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchForecast(coords.latitude, coords.longitude, FORECAST_DAYS, signal),
  });
  const weather =
    venueWeather ?? (!event?.venueMeta && dayIndex >= 0 ? (forecast.data?.[dayIndex] ?? null) : null);

  const roster = useMemo(() => members.data ?? [], [members.data]);
  const boards = useMemo(() => posts.data?.boards ?? [], [posts.data]);
  const looks = useMemo(() => posts.data?.looks ?? [], [posts.data]);

  const nameOf = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of roster) map.set(m.userId, m.displayName ?? m.username);
    return (userId: string): string | null => (userId === me ? 'You' : (map.get(userId) ?? null));
  }, [roster, me]);

  // Boards ordered: mine first, then roster order, then any stray poster.
  const orderedBoards = useMemo(() => {
    const order = roster.map((m) => m.userId);
    return [...boards].sort((a, b) => {
      if (a.userId === me) return -1;
      if (b.userId === me) return 1;
      return order.indexOf(a.userId) - order.indexOf(b.userId);
    });
  }, [boards, roster, me]);

  const myBoard = orderedBoards.find((b) => b.userId === me) ?? null;
  const myLeading = myBoard ? (boardLeader(myBoard.looks) ?? myBoard.looks[0] ?? null) : null;

  const { resolve } = useSignedUrls(
    looks.flatMap((l) => l.garments.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
  );

  // Every board's leading look, reduced to the shape both the grid and the
  // group note need — computed once so neither re-derives "which look counts"
  // on its own.
  const attendeeLooks: AttendeeLook[] = useMemo(
    () =>
      orderedBoards.flatMap((b) => {
        const leading = boardLeader(b.looks) ?? b.looks[0];
        return leading ? [{ userId: b.userId, id: leading.id, garments: leading.garments }] : [];
      }),
    [orderedBoards],
  );

  const groupNote = useMemo(() => groupStyleNote(attendeeLooks, me), [attendeeLooks, me]);

  // The evening starts, the board locks: tallies freeze into crowns and the
  // share controls go. "Now" is sampled once per mount rather than per render.
  const [openedAt] = useState(() => Date.now());

  const writeFailed = (title: string) => (error: unknown) =>
    Alert.alert(title, socialDenialCopy(error) ?? 'Check your connection and try again.');

  if (eventQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <ScreenHeader align="leading" title="Event" />
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  if (eventQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <ScreenHeader align="leading" title="Event" />
        <ErrorState
          title="This occasion didn’t load"
          body="It’s still there — the connection dropped on the way. Try again in a moment."
          onRetry={() => void eventQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <ScreenHeader align="leading" title="Event" />
        <View className="flex-1 items-center justify-center px-gutter">
          <Text variant="body">This occasion isn’t available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const joinedCount = roster.filter((m) => m.state === 'joined').length;
  // Resolved from the roster, not stored on the row — the host is a role, and
  // `nameOf` already answers 'You' for the signed-in user, which is exactly
  // right for a host reading their own cancellation.
  const hostName = event.hostId ? nameOf(event.hostId) : null;
  const sharedCount = orderedBoards.length;
  const openComments = (comments.data ?? []).filter((c) => !c.hidden).length;
  const canceled = Boolean(event.canceledAt);
  const standing = viewerStanding(event);

  // ── The two rows above the fold ─────────────────────────────────────────
  //
  // §7.1: coarse before joined, precise after. An invitee gets the day and
  // nothing else — no time, no venue, no weather. `coarse` carries that rule
  // into the string rather than the string being assembled twice here.
  const whenValue = dateTimeLine(event.startsAt, event.endsAt, { coarse: !isMember });
  const whenSecondary = isMember && weather ? weatherLineFor(weather) : null;
  const where = venueLines(event.venueName, event.venueAddress);
  // A host can still fill a gap from this page, and only a gap: the repair
  // action appears exactly where the fact is missing, which is the same set of
  // writes the two chips used to offer.
  const hostCanRepair = event.isHost && !canceled;

  // Occasion, party size and dress code — real facts, and secondary ones.
  // They sit with the logistics below rather than as a fourth line under the
  // title. Member-only, same as the rest of the precise half.
  const colophonBits = isMember
    ? [event.occasion, event.partySize ? `table for ${event.partySize}` : null, event.dressCode].filter(
        Boolean,
      )
    : [];

  const confirmLeave = () => setConfirm({ kind: 'leave' });
  const confirmCancel = () => setConfirm({ kind: 'cancel' });
  const confirmRemove = (userId: string, name: string) => setConfirm({ kind: 'remove', userId, name });

  const closeConfirm = () => setConfirm(null);

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'cancel') {
      cancel.mutate(
        { eventId: event.id },
        {
          onSuccess: () => {
            closeConfirm();
            router.back();
          },
          onError: () => {
            closeConfirm();
            writeFailed('It’s still on')(cancel.error);
          },
        },
      );
    } else if (confirm.kind === 'leave') {
      leave.mutate(
        { eventId: event.id },
        {
          onSuccess: () => {
            closeConfirm();
            router.back();
          },
          onError: () => {
            closeConfirm();
            writeFailed('You’re still on the list')(leave.error);
          },
        },
      );
    } else {
      removeMember.mutate(
        { eventId: event.id, userId: confirm.userId },
        {
          onSuccess: closeConfirm,
          onError: () => {
            const name = confirm.name;
            closeConfirm();
            writeFailed(`${name} is still on the list`)(removeMember.error);
          },
        },
      );
    }
  };

  /**
   * `edit` is what separates the atlas's two paths. "Swapping a piece edits in
   * place and keeps the picks, because the look is the same look. Replacing
   * every piece is a new post, and says so." Without the param both buttons
   * opened the same blank compose flow, so swapping one garment silently threw
   * away the votes and the comment thread the look had already earned.
   */
  const goPost = (editPostId?: string) =>
    router.push({
      pathname: '/event/[id]/post',
      params: editPostId ? { id: event.id, edit: editPostId } : { id: event.id },
    });
  const goComments = (postId?: string) =>
    router.push({
      pathname: '/event/[id]/comments',
      params: postId ? { id: event.id, post: postId } : { id: event.id },
    });

  // An undated occasion never locks: the evening the tallies would freeze at
  // has not been chosen yet.
  const locked = event.startsAt ? openedAt >= event.startsAt.getTime() : false;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* 1 — back, and the viewer's own standing as one quiet word. It is the
          viewer's OWN state, so it can carry no coarse attendance about
          anyone else. */}
      <ScreenHeader
        align="leading"
        title="Event"
        trailing={
          standing ? (
            <Text
              variant="colophon"
              accessibilityLabel={
                canceled ? 'This occasion is cancelled' : `You are ${standing.toLowerCase()}`
              }>
              {standing}
            </Text>
          ) : undefined
        }
      />

      <ScrollView contentContainerClassName="px-gutter pb-16" showsVerticalScrollIndicator={false}>
        {/* 2 — the title. */}
        <View className="mt-5">
          <Text variant="title" trim style={canceled ? { color: theme.muted } : undefined}>
            {event.title}
          </Text>
        </View>

        {/*
          ── Correction 26 · cancellation, and only what the app does ────────

          Every sentence in `CANCELLATION_FACTS` was checked against the
          repository before it was written — the mutation that sets
          `canceled_at` and touches nothing else, the cascades that only fire
          on a deleted event row, and the diary's ownership by the wearer.

          Three things are deliberately NOT here: a notification promise, a
          crown promise, and any hint of who had answered. This band is a
          destructive-state explanation and is preserved verbatim.
        */}
        {canceled ? (
          <View className="mt-4">
            <NoticeBand
              cause="CANCELLED"
              title={cancelledHeading(hostName, event.title)}
              body={CANCELLATION_FACTS.join(' ')}
            />
            <View className="mt-3 flex-row flex-wrap gap-2">
              {myLeading ? (
                <Button
                  title="See the look I chose"
                  variant="secondary"
                  onPress={() => goComments(myLeading.id)}
                />
              ) : null}
              <Button title="Read the comments" variant="secondary" onPress={() => goComments()} />
            </View>
          </View>
        ) : null}

        {/* 3 — when and where, two scannable rows. The WHERE row is absent
            entirely for someone who has only been invited: §7.1 withholds the
            place until they join, and an honest missing-state for a fact that
            exists but is being withheld would be a lie. */}
        <View className="mt-6">
          <FactRow
            label="When"
            value={whenValue}
            secondary={whenSecondary}
            actionLabel={hostCanRepair && !event.startsAt ? 'Add a date' : undefined}
            onAction={hostCanRepair && !event.startsAt ? () => setDateSheet(true) : undefined}
            last={!isMember}
          />
          {isMember ? (
            <FactRow
              label="Where"
              value={where.value}
              secondary={where.secondary}
              actionLabel={hostCanRepair && !event.venueName ? 'Add a place' : undefined}
              onAction={hostCanRepair && !event.venueName ? () => setPlaceSheet(true) : undefined}
              last
            />
          ) : null}
        </View>

        {/* The invitee's one decision, and the two facts it needs: who asked,
            and what joining changes. EV-02's pair — the accent moves to Join,
            and "Decide later" is a real 44pt exit that SENDS NOTHING: it
            navigates back and writes no response at all, which is the whole of
            the atlas's coarse-attendance position. */}
        {!canceled && !event.isHost && event.myState === 'invited' ? (
          <View className="mt-6">
            <Text variant="body" style={{ color: theme.muted }}>
              {inviteeStatusLine(hostName, false)}
            </Text>
            <View className="mt-4 flex-row gap-3">
              <Button
                title="Join"
                haptic
                loading={respond.isPending && respond.variables?.response === 'joined'}
                onPress={() =>
                  respond.mutate(
                    { eventId: event.id, response: 'joined' },
                    { onError: writeFailed('That didn’t go through') },
                  )
                }
              />
              <Button title="Decide later" variant="ghost" onPress={() => router.back()} />
            </View>
            {/* Kept: it is the honest explanation for why this page is coarse,
                which is a withheld-data rule rather than a caption. */}
            <Text variant="note" className="mt-3">
              Joining puts it on your Plan — and shows you where and when.
            </Text>
          </View>
        ) : null}

        {isMember ? (
          <>
            {/* 4 — Your look. Nothing logistical between the facts and this
                card (event-social-contract.md §2). */}
            {posts.isError ? (
              <View className="-mx-gutter mt-6">
                <ErrorState
                  compact
                  title="The looks didn’t load"
                  body="Nobody’s board is lost — the connection dropped on the way."
                  onRetry={() => void posts.refetch()}
                  retrying={posts.isRefetching}
                />
              </View>
            ) : posts.isLoading ? (
              <View className="mt-8" accessibilityLabel="Reading the board">
                <Skeleton className="h-44 w-full rounded-plate" />
              </View>
            ) : (
              <View className="mt-8">
                <YourLookCard
                  leading={myLeading}
                  resolveImage={resolve}
                  locked={locked || canceled}
                  onSwap={() => goPost(myLeading?.id)}
                  onShare={() => goPost()}
                />
              </View>
            )}

            {/* ── Below the fold ─────────────────────────────────────────── */}

            {/* 5 — people. Who is wearing what, then who is coming. */}
            {posts.isError || posts.isLoading ? null : (
              <>
                <SectionHeader
                  title="Who’s wearing what"
                  className="mt-8"
                  trailing={
                    // The denominator is everyone who could plausibly share a
                    // look — joined and still-deciding both. `roster` already
                    // carries exactly that set (useEventMembers filters to
                    // joined | invited), so it needs no re-derivation here.
                    <Text variant="colophon">
                      {sharedCount} of {Math.max(roster.length, sharedCount)} shared
                    </Text>
                  }
                />

                {attendeeLooks.length === 0 ? (
                  <Card border="hairline" padding="xl" className="mt-3">
                    <Text variant="body" style={{ color: theme.muted }}>
                      Be the first to the mirror — share a look and the table follows.
                    </Text>
                  </Card>
                ) : (
                  <View className="mt-3">
                    <AttendeeLookGrid
                      boards={attendeeLooks}
                      nameOf={nameOf}
                      resolveImage={resolve}
                      onOpen={(look) => goComments(look.id)}
                    />
                  </View>
                )}

                {/* 6 — the stylist's group note, computed and never authored
                    (Event Detail State Atlas E-07). Absent when there is
                    nothing true to say. `body` (17), not `callout` (16): this
                    is the stylist speaking, and the stylist sits at 17
                    everywhere else. */}
                {groupNote ? (
                  <View className="mt-4 rounded-plate bg-tray p-4">
                    <Text variant="body">{groupNote}</Text>
                  </View>
                ) : null}
              </>
            )}

            {/* The host's own note to the group — only when there is one. */}
            {event.note ? (
              <View className="mt-4 rounded-lg border border-rule bg-surface p-4">
                <Text variant="body" style={{ color: theme.muted }}>
                  {event.note}
                </Text>
              </View>
            ) : null}

            <SectionHeader
              title="The guests"
              className="mt-8"
              trailing={members.isError ? null : <Text variant="label">{joinedCount} going</Text>}
            />
            {members.isError ? (
              <View className="-mx-gutter">
                <ErrorState
                  compact
                  title="The guest list didn’t load"
                  body="This is a connection problem, not a change to who is coming."
                  onRetry={() => void members.refetch()}
                  retrying={members.isRefetching}
                />
              </View>
            ) : members.isLoading ? (
              <View className="mt-3 gap-3">
                <Skeleton className="h-8 w-2/3 rounded-md" />
                <Skeleton className="h-8 w-1/2 rounded-md" />
              </View>
            ) : (
              <View className="mt-1">
                {roster
                  // Still-deciding rows are the host's private knowledge; a
                  // guest's roster shows who is actually coming, nothing more.
                  .filter((m) => m.state === 'joined' || event.isHost)
                  .map((m, i, list) => (
                    <RosterRow
                      key={m.userId}
                      member={m}
                      isSelf={m.userId === session.userId}
                      isLast={i === list.length - 1}
                      onRemove={
                        event.isHost && m.role !== 'host' && m.userId !== session.userId
                          ? () => confirmRemove(m.userId, m.displayName ?? m.username ?? 'this guest')
                          : undefined
                      }
                    />
                  ))}
              </View>
            )}

            {/* 7 — secondary logistics and host controls. These rows are
                routes rather than board data, so they render whatever the
                board fetch did: a dropped board is exactly when somebody is
                standing outside needing the reservation. */}
            <View className="mt-8">
              {colophonBits.length > 0 ? (
                <Text variant="colophon" className="mb-3">
                  {colophonBits.join(' · ')}
                </Text>
              ) : null}
              {event.reservationUrl ? (
                <NavRow
                  role="link"
                  label={reservationLabel(event.reservationUrl)}
                  onPress={() => {
                    void Linking.openURL(event.reservationUrl!).catch(() => {
                      // A dead or malformed link is the platform's business,
                      // not a crash — the row simply does nothing, like Safari
                      // would.
                    });
                  }}
                />
              ) : null}
              <NavRow
                label="Every option"
                hint="All the looks, with picks"
                onPress={() => router.push(`/event/${event.id}/outfits`)}
              />
              <NavRow
                label="Table talk"
                trailing={openComments > 0 ? String(openComments) : undefined}
                onPress={() => goComments()}
              />
              {event.isHost && !canceled ? (
                <NavRow
                  label="Invite more people"
                  onPress={() => router.push(`/event/${event.id}/invite`)}
                />
              ) : null}
            </View>
          </>
        ) : (
          // EV-02 — "Your look becomes a PAPER card explaining what happens
          // after joining rather than a blush card with nothing in it." The
          // page's one accent is Join, above; spending a second one on an
          // empty card would make the invitee's single decision compete with
          // a card that has nothing in it yet.
          <View className="mt-8">
            <Card border="hairline" padding="xl">
              <Text variant="colophon">Your look</Text>
              <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
                {noLookYetLine()}
              </Text>
            </Card>
          </View>
        )}

        {/* The page's one destructive line: the foot, quiet, left-aligned,
            in `critical` — never the biggest control on the screen. The host
            cancels; everyone else leaves. */}
        {!canceled && event.isHost ? (
          <Pressable
            onPress={confirmCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel this occasion"
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="mt-10 self-start active:opacity-60">
            <Text variant="label" style={{ color: theme.critical }}>
              Cancel this occasion
            </Text>
          </Pressable>
        ) : null}
        {!canceled && !event.isHost && event.myState === 'joined' ? (
          <Pressable
            onPress={confirmLeave}
            accessibilityRole="button"
            accessibilityLabel="Leave this occasion"
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="mt-10 self-start active:opacity-60">
            <Text variant="label" style={{ color: theme.critical }}>
              Leave this occasion
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* The three confirmations (E-09). Each says what is lost in one
          sentence; each keep-option is named for the thing being kept. */}
      <ConfirmSheet
        visible={confirm?.kind === 'cancel'}
        title="Cancel this occasion?"
        // Correction 26 — the host's confirmation carries the same facts as
        // the attendee's notice, plus the one-way door. It does not promise
        // anyone is notified, does not promise anything about crowns, and does
        // not expose who had answered.
        body={HOST_CANCELLATION_FACTS.join(' ')}
        keepLabel="Keep it"
        destructiveLabel="Cancel it"
        destructiveBusy={cancel.isPending}
        onKeep={closeConfirm}
        onConfirm={runConfirm}
      />
      <ConfirmSheet
        visible={confirm?.kind === 'leave'}
        title="Leave this occasion?"
        body="Your looks and comments go with you."
        keepLabel="Stay"
        destructiveLabel="Leave"
        destructiveBusy={leave.isPending}
        onKeep={closeConfirm}
        onConfirm={runConfirm}
      />
      <ConfirmSheet
        visible={confirm?.kind === 'remove'}
        title={confirm?.kind === 'remove' ? `Remove ${confirm.name}?` : ''}
        body="They lose access to the occasion. Nobody else is told."
        keepLabel="Keep them"
        destructiveLabel="Remove"
        destructiveBusy={removeMember.isPending}
        onKeep={closeConfirm}
        onConfirm={runConfirm}
      />

      {/* The same three sheets the form uses, so filling a gap after the fact
          is the same interaction as answering it in the first place. */}
      <DateSheet
        visible={dateSheet}
        value={event.startsAt}
        onChange={(picked) => {
          const at = new Date(picked);
          at.setHours(Math.floor(DEFAULT_TIME_MINUTES / 60), DEFAULT_TIME_MINUTES % 60, 0, 0);
          update.mutate(
            { eventId: event.id, patch: { startsAt: at } },
            { onError: writeFailed('That date didn’t save') },
          );
        }}
        onClose={() => setDateSheet(false)}
      />
      <TimeSheet
        visible={timeSheet}
        value={event.startsAt ? event.startsAt.getHours() * 60 + event.startsAt.getMinutes() : null}
        onChange={(minutes) => {
          if (!event.startsAt) return;
          const at = new Date(event.startsAt);
          at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
          update.mutate(
            { eventId: event.id, patch: { startsAt: at } },
            { onError: writeFailed('That time didn’t save') },
          );
        }}
        onClose={() => setTimeSheet(false)}
      />
      <PlaceSheet
        visible={placeSheet}
        onDone={(selection) => {
          setPlaceSheet(false);
          if (!selection) return;
          update.mutate(
            {
              eventId: event.id,
              patch:
                selection.kind === 'resolved'
                  ? {
                      venueName: selection.name,
                      venueAddress: selection.address,
                      venueMeta: {
                        latitude: selection.latitude,
                        longitude: selection.longitude,
                      },
                    }
                  : { venueName: selection.name, venueAddress: null, venueMeta: null },
            },
            { onError: writeFailed('That place didn’t save') },
          );
        }}
        onClose={() => setPlaceSheet(false)}
      />
    </SafeAreaView>
  );
}
