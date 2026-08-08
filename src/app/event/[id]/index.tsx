import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttendeeLookGrid, type AttendeeLook } from '@/components/events/AttendeeLookGrid';
import { ConfirmSheet } from '@/components/events/ConfirmSheet';
import { YourLookCard } from '@/components/events/YourLookCard';
import {
  daysFromToday,
  isSameDay,
  timeLabel,
  weatherLineFor,
  whenLabel,
} from '@/components/events/EventCard';
import { DateSheet } from '@/components/events/date-sheet';
import { PlaceSheet } from '@/components/events/place-sheet';
import { DEFAULT_TIME_MINUTES, TimeSheet } from '@/components/events/time-sheet';
import { RosterRow } from '@/components/events/RosterRow';
import { VenueCard } from '@/components/events/VenueCard';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast } from '@/features/context/weather';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useEventComments, useEventPosts } from '@/features/event-outfits/queries';
import { boardLeader } from '@/features/event-outfits/types';
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
import type { EventDetail } from '@/features/events/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** Open-Meteo's free forecast horizon; past it the metadata simply omits weather. */
const FORECAST_DAYS = 16;

/**
 * "Sat, Aug 8, 7:30 PM" — the date+time half of the metadata line. Weather
 * and the venue join it at the call site (E-01 draws all three on one line);
 * this stays its own function because the date+time pair is also what an
 * invitee's coarse line is built from (minus the time — §7.1).
 */
function whenLine(event: EventDetail): string | null {
  if (!event.startsAt) return null;
  const time = isSameDay(event.startsAt, event.endsAt) ? timeLabel(event.startsAt) : null;
  return [whenLabel(event.startsAt, event.endsAt), time].filter(Boolean).join(' · ');
}

/**
 * The viewer's standing RSVP state — "Hosting", "Going" — as the Event Detail
 * State Atlas draws it: an ink fill beside the outline action, never a
 * button. E-01 draws Hosting beside Invite; E-04 draws Going beside nothing
 * (the exit lives at the foot instead).
 *
 * Inert on purpose. "Going" used to be a button whose press opened "Leave
 * this occasion?" — a trap in both directions: nobody looking to leave would
 * think to press the badge that says they are going, and anyone pressing it
 * to see what it did got a leave prompt. The exit now lives where the host's
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
      <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
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
  onPress,
}: {
  label: string;
  hint?: string;
  trailing?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-between gap-3 border-b border-hairline py-3 active:opacity-60 dark:border-hairline-dark">
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
 * The page's shape while it loads — title, metadata, RSVP row, the blush card
 * and the first row of the grid (Event Detail State Atlas E-10) — rather than
 * a spinner in the middle of an empty screen.
 */
export function DetailSkeleton() {
  return (
    <View className="px-gutter" accessibilityLabel="Opening this occasion">
      <Skeleton className="mt-5 h-9 w-2/3 rounded-md" />
      <Skeleton className="mt-5 h-4 w-11/12 rounded-sm" />
      <View className="mt-5 flex-row gap-3">
        <Skeleton className="h-11 w-28 rounded-md" />
        <Skeleton className="h-11 w-28 rounded-md" />
      </View>
      <Skeleton className="mt-7 h-20 w-full rounded-plate" />
      <Skeleton className="mt-6 h-44 w-full rounded-plate" />
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
 * Occasion detail — Event Detail State Atlas E-01…E-10.
 *
 * The fixed order: title, metadata line, colophon, the RSVP row, then
 * straight into the blush "Your look" card — nothing logistical between the
 * RSVP row and that card. Everything below it is logistics and people: the
 * group note, the venue card, "Every option", "Table talk", the guest list,
 * and last the page's one destructive line.
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

  // Display-only weather for the metadata line, read at the VENUE's own
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

  const backRow = <ScreenHeader align="leading" title="Event" />;

  if (eventQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        {backRow}
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  if (eventQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        {backRow}
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
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="body">This occasion isn’t available.</Text>
        <Button title="Back" variant="ghost" onPress={() => router.back()} className="mt-4" />
      </SafeAreaView>
    );
  }

  const joinedCount = roster.filter((m) => m.state === 'joined').length;
  const sharedCount = orderedBoards.length;
  const openComments = (comments.data ?? []).filter((c) => !c.hidden).length;

  // §7.1: coarse before joined, precise after. An invitee gets the day and
  // nothing else — no time, no venue, no weather — printed on one line;
  // members get date, time, venue and weather together on that same line,
  // the register E-01 draws ("Sat, Aug 8, 7:30 PM · Bar Ideale · Feels 70°,
  // clear evening").
  const metadata = isMember
    ? [whenLine(event), event.venueName ?? event.venueAddress, weather ? weatherLineFor(weather) : null]
        .filter(Boolean)
        .join(' · ')
    : event.startsAt
      ? whenLabel(event.startsAt, event.endsAt)
      : '';

  // The colophon: occasion, party size, dress code — in that order, the way
  // E-01 draws "Birthday dinner · table for 6 · something festive". Member-
  // only, same as the metadata's precise half.
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

  const goPost = () => router.push({ pathname: '/event/[id]/post', params: { id: event.id } });
  const goComments = (postId?: string) =>
    router.push({
      pathname: '/event/[id]/comments',
      params: postId ? { id: event.id, post: postId } : { id: event.id },
    });

  // An undated occasion never locks: the evening the tallies would freeze at
  // has not been chosen yet.
  const locked = event.startsAt ? openedAt >= event.startsAt.getTime() : false;

  /**
   * Venue, reservation link and the map affordance — logistics, printed once
   * and placed after the group note rather than in front of it. Held in a
   * const because the board has three branches and the venue belongs to two
   * of them: it must survive a failed posts fetch, since a dropped board is
   * exactly when someone is standing outside needing the address.
   */
  const venueBlock = (
    <View className="mt-6">
      <VenueCard
        venueName={event.venueName}
        venueAddress={event.venueAddress}
        reservationUrl={event.reservationUrl}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      {backRow}

      <ScrollView contentContainerClassName="px-gutter pb-16" showsVerticalScrollIndicator={false}>
        <View className="mt-5">
          <Text
            variant="title"
            trim
            style={event.canceledAt ? { color: theme.muted } : undefined}>
            {event.title}
          </Text>
        </View>

        {metadata ? (
          <Text variant="body" className="mt-4" style={{ color: theme.muted }}>
            {metadata}
          </Text>
        ) : null}
        {colophonBits.length > 0 ? (
          <Text variant="colophon" className="mt-2">
            {colophonBits.join(' · ')}
          </Text>
        ) : null}

        {/* N-10's thinnest occasion: a name is enough to create one, so the
            page has to be honest about a nearly empty event. Two quiet chips,
            not an error and not a checklist. Sits before the RSVP row, not
            after — the fixed order after the RSVP row belongs to the blush
            card alone. */}
        {!event.startsAt && !event.canceledAt ? (
          <View className="mt-4">
            <Text variant="body" style={{ color: theme.muted }}>
              No date yet. Add one and Cinch can read the weather and plan a look for it.
            </Text>
            {event.isHost ? (
              <View className="mt-4 flex-row flex-wrap gap-2">
                <Chip label="Add a date" size="tap" onPress={() => setDateSheet(true)} />
                {!event.venueName ? (
                  <Chip label="Add a place" size="tap" onPress={() => setPlaceSheet(true)} />
                ) : null}
              </View>
            ) : null}
            <Rule className="mt-5" />
          </View>
        ) : null}

        {/* The RSVP row. Hosting and Going are inert ink states, never
            buttons (Event Detail State Atlas E-01/E-04) — the host's only
            action beside Hosting is Invite; a going guest's exit lives at
            the foot, not here. */}
        {event.canceledAt ? (
          <Text variant="label" className="mt-4" style={{ color: theme.critical }}>
            This occasion was canceled.
          </Text>
        ) : (
          <View className="mt-5 flex-row gap-3">
            {event.isHost ? (
              <>
                <StatePill label="Hosting" />
                <Button
                  title="Invite"
                  variant="secondary"
                  haptic
                  onPress={() => router.push(`/event/${event.id}/invite`)}
                />
              </>
            ) : event.myState === 'joined' ? (
              <StatePill label="Going" />
            ) : event.myState === 'invited' ? (
              <>
                {/* The one accent on this screen for an invitee: she has
                    exactly one thing to do here, and this is it. */}
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
                <Button
                  title="Decline"
                  variant="secondary"
                  onPress={() =>
                    respond.mutate(
                      { eventId: event.id, response: 'declined' },
                      {
                        onSuccess: () => router.back(),
                        onError: writeFailed('That didn’t go through'),
                      },
                    )
                  }
                />
              </>
            ) : null}
          </View>
        )}
        {!event.startsAt && !event.canceledAt && event.isHost ? (
          <Text variant="note" className="mt-3">
            Friends can be invited to an occasion with no date — the details fill in later, and
            everyone sees the change.
          </Text>
        ) : null}
        {!isMember && event.myState === 'invited' ? (
          <Text variant="caption" className="mt-3">
            Joining puts it on your Plan — and shows you where and when.
          </Text>
        ) : null}

        {isMember ? (
          <>
            {/* Straight into the blush card — nothing logistical between the
                RSVP row and here (event-social-contract.md §2). */}
            {posts.isError ? (
              <>
                <View className="-mx-gutter mt-4">
                  <ErrorState
                    compact
                    title="The looks didn’t load"
                    body="Nobody’s board is lost — the connection dropped on the way."
                    onRetry={() => void posts.refetch()}
                    retrying={posts.isRefetching}
                  />
                </View>
                {venueBlock}
              </>
            ) : posts.isLoading ? (
              <View className="mt-7" accessibilityLabel="Reading the board">
                <Skeleton className="h-44 w-full rounded-plate" />
                <View className="-mx-1.5 mt-6 flex-row">
                  <View className="w-1/2 p-1.5">
                    <Skeleton className="aspect-[4/5] w-full rounded-plate" />
                  </View>
                  <View className="w-1/2 p-1.5">
                    <Skeleton className="aspect-[4/5] w-full rounded-plate" />
                  </View>
                </View>
              </View>
            ) : (
              <>
                <View className="mt-7">
                  <YourLookCard
                    leading={myLeading}
                    resolveImage={resolve}
                    locked={locked || Boolean(event.canceledAt)}
                    onSwap={goPost}
                    onShare={goPost}
                  />
                </View>

                {event.note ? (
                  <View className="mt-4 rounded-lg border border-rule bg-surface p-4 dark:border-rule-dark dark:bg-surface-dark">
                    <Text variant="body" style={{ color: theme.muted }}>
                      {event.note}
                    </Text>
                  </View>
                ) : null}

                <SectionHeader
                  title="Who’s wearing what"
                  className="mt-8"
                  trailing={
                    // The denominator is everyone who could plausibly share a
                    // look — joined and still-deciding both — matching E-08's
                    // "0 of 5 shared" against a roster of one host, three
                    // joined and one still deciding. `roster` already carries
                    // exactly that set (useEventMembers filters to joined |
                    // invited), so it needs no re-derivation here.
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

                {/* The stylist's group note — computed, never authored
                    (Event Detail State Atlas E-07). Absent when there is
                    nothing true to say. */}
                {groupNote ? (
                  // `body` (17), not `callout` (16): this is the stylist
                  // speaking, and the stylist sits at 17 everywhere else.
                  <View className="mt-4 rounded-plate bg-tray p-4">
                    <Text variant="body">{groupNote}</Text>
                  </View>
                ) : null}

                {venueBlock}

                <View className="mt-6">
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
                </View>
              </>
            )}

            <SectionHeader
              title="The guests"
              className="mt-8"
              trailing={
                members.isError ? null : <Text variant="label">{joinedCount} going</Text>
              }
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
          </>
        ) : (
          <Text variant="label" className="mt-6">
            {joinedCount > 0
              ? `${joinedCount} going so far.`
              : 'The list is still coming together.'}
          </Text>
        )}

        {/* The page's one destructive line: the foot, quiet, left-aligned,
            in `critical` — never the biggest control on the screen. The host
            cancels; everyone else leaves. */}
        {!event.canceledAt && event.isHost ? (
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
        {!event.canceledAt && !event.isHost && event.myState === 'joined' ? (
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
        body="Everyone on the list will see it as canceled."
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
