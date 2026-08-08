import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AttendeeLookGrid,
  YourLookCard,
  groupStyleNote,
} from '@/components/event-outfits/OutfitPostCard';
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
// Batch-1 seam: the shared states kit. `Skeleton` is the loading primitive,
// `ErrorState` the title/body/retry sibling of `EmptyState`.
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
 * "Sat 9 Aug · 4:00pm" — the atlas's metadata register (N-09).
 *
 * Composed from `EventCard`'s own two helpers rather than formatted again
 * here: the card and the page it opens are the same occasion, and the app used
 * to print "Fri, Aug 8, 7:30 PM" on one and "Fri 8 Aug · 7:30pm" on the other.
 * A multi-day occasion has no single time to print, which `timeLabel` already
 * knows; an undated one prints "No date yet" and nothing after it.
 */
function whenLine(event: EventDetail): string | null {
  // An undated occasion says so in the N-10 block below, in a full sentence
  // that offers to fix it — so the metadata line stays quiet rather than
  // printing "No date yet" immediately above the same words.
  if (!event.startsAt) return null;
  const time = isSameDay(event.startsAt, event.endsAt) ? timeLabel(event.startsAt) : null;
  return [whenLabel(event.startsAt, event.endsAt), time].filter(Boolean).join(' · ');
}

/**
 * The viewer's standing RSVP state — "Going", "Hosting" — as the founder mock
 * draws it: an ink fill beside the outline action.
 *
 * Not the shared `Button`, and deliberately: `Button` has three variants, none
 * of them ink (primary is the accent, and the accent is spent once per screen
 * on an ACTION — a standing state is not one). Its props omit `style`, so ink
 * cannot be reached from outside either. What this does share is the house
 * radius: `rounded-md`, not the `rounded-full` this control used to carry
 * against `tailwind.config.js`'s "capsules are glass chrome only".
 *
 * Inert, and that is the whole point of it. "Going" used to be a button whose
 * press opened "Leave this occasion?" — the most emphatic, most button-shaped
 * thing on the page silently carried the one destructive action on it, which
 * is a trap in both directions: nobody looking to leave would think to press
 * the badge that says they are going, and anyone pressing it to see what it
 * did got a leave prompt. Leaving now lives where the host's own exit lives,
 * as a quiet `critical` link at the foot of the page.
 */
function StatePill({ label }: { label: string }) {
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
function NavRow({
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
        {hint ? (
          <Text variant="caption" className="text-muted dark:text-muted-dark">
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ? <Text variant="colophon">{trailing}</Text> : null}
      <SymbolView name="chevron.right" size={12} tintColor={theme.faint} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

/**
 * The page's shape while it loads — title, metadata, RSVP row, venue, the
 * blush card and the first row of the grid — rather than a spinner in the
 * middle of an empty screen. The occasion arrives into its own outline.
 */
function DetailSkeleton() {
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

/**
 * Occasion detail — the group dinner page, composed as one page.
 *
 * ── the composition point, resolved ────────────────────────────────────────
 * This screen used to hand the look boards off by route: two nav rows under a
 * "Who's wearing what" eyebrow, with a note saying to swap them for the
 * event-outfits slice's own components "at integration if one page is wanted".
 * One page is wanted — it is what the founder drew (founder-mocks §1b) and
 * what the field guide's frame 05b composes — so the rows are gone and the
 * YOUR LOOK card and the WHO'S WEARING WHAT grid render here, from that
 * slice's components.
 *
 * The route-string decoupling was a BUILD-TIME seam between two agents, not a
 * product decision; with both slices in the tree it costs a tap and hides the
 * screen's whole premise. What stays behind a route is what genuinely wants
 * its own surface: every option with its picks (`./outfits`), the composer
 * (`./post`) and the threads (`./comments`).
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
  // N-10's two chips write straight through this — the mutation has existed
  // since the events slice shipped and has never had a call site, because
  // until now there was no way for an occasion to be missing anything.
  const update = useUpdateEvent();

  const [dateSheet, setDateSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [placeSheet, setPlaceSheet] = useState(false);

  // Live votes/comments for the board now composed onto this page (build
  // plan §2) — the channel exists the moment the event page is open.
  useEventChannel(id ?? null);

  const event = eventQuery.data ?? null;
  const isMember = Boolean(event && (event.isHost || event.myState === 'joined'));

  // The board itself. Gated on membership rather than on `id`: a still-
  // deciding invitee sees the coarse page (§7.1), and firing a read RLS is
  // certain to refuse would only manufacture an error branch for her.
  const boardEventId = isMember ? (id ?? null) : null;
  const posts = useEventPosts(boardEventId);
  const comments = useEventComments(boardEventId);

  // Display-only weather for the metadata line, read at the VENUE's own
  // coordinates when the place was resolved through the gazetteer — the
  // forecast an occasion in Denver deserves, rather than the phone's.
  const venueWeather = useOccasionWeather(event?.startsAt ?? null, event?.venueMeta ?? null);

  // The fallback, for every occasion created before `venue_meta` was ever
  // written: the user's own coordinates, which is what this page has always
  // shown. Disabled the moment the venue has coordinates of its own, so the
  // two never race — and an occasion with a resolved place somewhere else
  // never quietly falls back to the weather where the reader is standing.
  const { coords } = useStyleContext();
  const dayIndex = event ? daysFromToday(event.startsAt) : -1;
  const forecast = useQuery({
    queryKey: [
      'forecast',
      coords.latitude.toFixed(2),
      coords.longitude.toFixed(2),
      FORECAST_DAYS,
    ],
    enabled:
      isMember && !event?.venueMeta && dayIndex >= 0 && dayIndex < FORECAST_DAYS,
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

  const groupNote = useMemo(() => groupStyleNote(orderedBoards, me), [orderedBoards, me]);

  // The evening starts, the board locks: tallies freeze into crowns and the
  // share controls go. "Now" is sampled once per mount rather than per render
  // — a page left open across the moment corrects itself on its next focus,
  // and a clock read during render is the impurity the linter rightly refuses.
  const [openedAt] = useState(() => Date.now());

  // A refused write is a sentence, never a silence. `socialDenialCopy` names
  // the two refusals the server issues on purpose; everything else is an
  // ordinary failure and says so.
  const writeFailed = (title: string) => (error: unknown) =>
    Alert.alert(title, socialDenialCopy(error) ?? 'Check your connection and try again.');

  // Drawn in every branch, loading and failed included: a screen you cannot
  // leave is the one state worse than a screen with nothing on it. The header
  // itself is now the shared `ScreenHeader` — same disc, same `hitSlop`, one
  // copy of the accessibility contract instead of nine.
  const backRow = <ScreenHeader align="leading" title="Event" />;

  if (eventQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        {backRow}
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  // A failed fetch is not a canceled occasion. These were one branch; the
  // first says "this didn't load, here is another go", the second is the
  // honest empty result the server actually returned.
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

  // §7.1, enforced at the surface: coarse before joined, precise after. RLS
  // hands an invitee the full row (she needs the date to decide), but venue,
  // time and logistics stay off her screen until she is on the list.
  //
  // Weather is no longer a third clause here: N-09 sets it on its own quieter
  // line beneath, so the metadata reads as one fact about the occasion and the
  // forecast reads as the app's own remark about it.
  const metadata = isMember
    ? [whenLine(event), event.venueName ?? event.venueAddress].filter(Boolean).join(' · ')
    : (whenLine(event) ?? '');

  // The dress code moved up to the eyebrow (N-09), so what is left down here
  // is the two columns the form no longer collects — printed for the occasions
  // that already carry them, and simply absent on everything created since.
  const colophonBits = isMember
    ? [event.occasion, event.partySize ? `table for ${event.partySize}` : null].filter(Boolean)
    : [];

  const confirmLeave = () =>
    Alert.alert('Leave this occasion?', 'Your looks and comments go with you.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          leave.mutate(
            { eventId: event.id },
            { onSuccess: () => router.back(), onError: writeFailed('You’re still on the list') },
          ),
      },
    ]);

  const confirmCancel = () =>
    Alert.alert('Cancel this occasion?', 'Everyone on the list will see it as canceled.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel it',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(
            { eventId: event.id },
            { onSuccess: () => router.back(), onError: writeFailed('It’s still on') },
          ),
      },
    ]);

  const confirmRemove = (userId: string, name: string) =>
    Alert.alert(`Remove ${name}?`, 'They lose access to the occasion. Nobody else is told.', [
      { text: 'Keep them', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeMember.mutate(
            { eventId: event.id, userId },
            { onError: writeFailed(`${name} is still on the list`) },
          ),
      },
    ]);

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
   * and placed after the decision rather than in front of it (see the board
   * comment below). Held in a const because the board has three branches and
   * the venue belongs to two of them: it must survive a failed posts fetch,
   * since a dropped board is exactly when someone is standing outside needing
   * the address. Only the skeleton branch omits it, and that resolves.
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
        {/* N-09's masthead: the dress code as the eyebrow, the name as the
            page's hero. `display` (40) rather than the atlas's 36 — the scale
            has no 36, and the atlas itself draws 32 on the thin occasion, so
            what is being asked for is the step up from `title`, not a new one.
            Margins live on the wrapper and the sibling: `trim` carries
            negative margins and a stacked `mt-*` cancels against them. */}
        <View className="mt-5">
          {isMember && event.dressCode ? (
            <View className="mb-2">
              {/* The screen's one oxblood. An invitee never reaches this branch
                  — §7.1 keeps the dress code off her page until she joins — so
                  it can never collide with the accent on her Join button. */}
              <Text variant="eyebrow" style={{ color: theme.accent }}>
                {event.dressCode}
              </Text>
            </View>
          ) : null}
          <Text variant="display" trim>
            {event.title}
          </Text>
        </View>

        <Text variant="body" className="mt-4" style={{ color: theme.muted }}>
          {metadata}
        </Text>
        {weather ? (
          <Text variant="note" className="mt-1.5">
            {weatherLineFor(weather)}
          </Text>
        ) : null}
        {colophonBits.length > 0 ? (
          <Text variant="colophon" className="mt-2">
            {colophonBits.join(' · ')}
          </Text>
        ) : null}

        {/* The note becomes a plate (N-09) — the first time this column has
            ever been rendered. Shown to everyone on the roster, invitees
            included: it is the host's message to the group, and N-11 says so
            plainly ("shown to everyone invited"). */}
        {event.note && (isMember || event.myState === 'invited') ? (
          <View className="mt-4 rounded-lg border border-rule bg-surface p-4 dark:border-rule-dark dark:bg-surface-dark">
            <Text variant="body" style={{ color: theme.muted }}>
              {event.note}
            </Text>
          </View>
        ) : null}

        {/* N-10, the thinnest occasion: a name is enough to create one, so the
            page has to be honest about a nearly empty event. The missing
            pieces become two quiet chips — not an error, and not a checklist
            with a progress bar. Everyone on the roster reads the sentence;
            only the host can act on it. */}
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

        {event.canceledAt ? (
          <Text variant="label" className="mt-4 text-critical dark:text-critical">
            This occasion was canceled.
          </Text>
        ) : (
          <View className="mt-5 flex-row gap-3">
            {event.isHost ? (
              // N-09 gives the host one action, full width and in ink: with an
              // occasion just created, inviting people is the whole page. The
              // "Hosting" pill it replaces was a label, not a thing to do.
              <Button
                title="Invite friends"
                variant="ink"
                haptic
                className="flex-1"
                onPress={() => router.push(`/event/${event.id}/invite`)}
              />
            ) : event.myState === 'joined' ? (
              <StatePill label="Going" />
            ) : event.myState === 'invited' ? (
              <>
                {/* The one accent on this screen: an invitee has exactly one
                    thing to do here, and it is this. */}
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
        {/* N-10's reassurance, under the button it is about: an occasion with
            no date is still worth inviting people to, and saying so is what
            keeps the two chips above from reading as a checklist to finish
            first. Host-only, because only the host can invite. */}
        {!event.startsAt && !event.canceledAt && event.isHost ? (
          <Text variant="note" className="mt-3">
            Friends can be invited to an occasion with no date — the details fill in later, and
            everyone sees the change.
          </Text>
        ) : null}
        {!isMember && event.myState === 'invited' ? (
          <Text variant="caption" className="mt-3 text-muted dark:text-muted-dark">
            Joining puts it on your Plan — and shows you where and when.
          </Text>
        ) : null}

        {isMember ? (
          <>
            {/* ── The board, composed onto this page ───────────────────────
                RSVP row straight into YOUR LOOK, per the approved frame
                (02-event). The venue card used to sit here, ~90pt of logistics
                between the decision and the thing being decided, which on a
                6.1" pushed the blush card — the whole point of the social
                layer — under the fold. It is not deleted (it carries the
                reservation-URL affordance) and the venue facts are already in
                the metadata line above; it simply follows the group note. */}
            {posts.isError ? (
              // `-mx-gutter` because `ErrorState compact` sets its own gutter
              // and this scroll container already has one — the same
              // gutterless trick `packing-trip.tsx` uses.
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

                <SectionHeader
                  title="Who’s wearing what"
                  className="mt-8"
                  trailing={
                    <Text variant="colophon">
                      {sharedCount} of {Math.max(joinedCount, sharedCount)} shared
                    </Text>
                  }
                />

                {orderedBoards.length === 0 ? (
                  <Card border="hairline" padding="xl" className="mt-3">
                    <Text variant="body" className="text-muted dark:text-muted-dark">
                      Be the first to the mirror — share a look and the table
                      follows.
                    </Text>
                  </Card>
                ) : (
                  <View className="mt-3">
                    <AttendeeLookGrid
                      boards={orderedBoards}
                      nameOf={nameOf}
                      resolveImage={resolve}
                      onOpen={(look) => goComments(look.id)}
                    />
                  </View>
                )}

                {/* The stylist's group note — the tray-filled line the field
                    guide puts under this grid. Computed from what is actually
                    on the board, and absent when there is nothing true. */}
                {groupNote ? (
                  // `body` (17), not `callout` (16): this is the stylist
                  // speaking, and every other sentence the stylist says on a
                  // page sits at 17. The half-step down read as a caption for
                  // the grid above rather than a line of its own.
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
                members.isError ? null : (
                  <Text variant="label" className="text-muted dark:text-muted-dark">
                    {joinedCount} going
                  </Text>
                )
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
          <Text variant="label" className="mt-6 text-muted dark:text-muted-dark">
            {joinedCount > 0
              ? `${joinedCount} going so far.`
              : 'The list is still coming together.'}
          </Text>
        )}

        {/* The page's one destructive line, in the place a destructive line
            belongs: the foot, quiet, in `critical`. The host cancels; everyone
            else leaves. Neither is ever the biggest control on the screen. */}
        {!event.canceledAt && event.isHost ? (
          <Pressable
            onPress={confirmCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel this occasion"
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="mt-10 self-start active:opacity-60">
            <Text variant="label" className="text-critical dark:text-critical">
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
            <Text variant="label" className="text-critical dark:text-critical">
              Leave this occasion
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* The same three sheets the form uses, so filling a gap after the fact
          is the same interaction as answering it in the first place. Each
          writes once, on Done: the row is live and other people are already
          looking at it. */}
      <DateSheet
        visible={dateSheet}
        value={event.startsAt}
        onChange={(picked) => {
          // A day with no time is not storable as an instant, so the picker's
          // own default rides along — the same 7:00pm the form seats.
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
