import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Linking, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/events/ConfirmSheet';
import { EventDetailBody, type EventDetailView } from '@/components/events/event-detail-body';
import { daysFromToday, weatherLineFor } from '@/components/events/EventCard';
import { DateSheet } from '@/components/events/date-sheet';
import { PlaceSheet } from '@/components/events/place-sheet';
import { DEFAULT_TIME_MINUTES, TimeSheet } from '@/components/events/time-sheet';
import { ReportFlowSheets } from '@/components/report/ReportFlowSheets';
import { ErrorState } from '@/components/ui/error-state';
import { NoticeBand } from '@/components/ui/notice-band';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
import {
  CANCELLATION_FACTS,
  HOST_CANCELLATION_FACTS,
  cancelledHeading,
} from '@/features/event-outfits/occasion-copy';
import { useEventComments, useEventPosts } from '@/features/event-outfits/queries';
import { boardLeader } from '@/features/event-outfits/types';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast } from '@/features/context/weather';
import {
  EVENT_DETAIL_COPY,
  emptyLookBody,
  heroTone,
  logisticsLine,
  posterLine,
  posterLinesAx,
  rosterChips,
} from '@/features/events/event-detail-spec';
import { dateTimeLine } from '@/features/events/event-lines';
import { lookName } from '@/features/events/look-copy';
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
import { reservationLabel, venueWriteFor } from '@/features/events/venue-search';
import { useReportFlow } from '@/features/social-graph/use-report-flow';

/**
 * Event Detail — the poster. The route. Redesign 03.
 *
 * ── WHAT THIS FILE IS NOW ─────────────────────────────────────────────────
 *
 * The wiring, and only the wiring: it reads the occasion, its members and its
 * board, decides what the reader is allowed to see, and hands one plain object
 * to `EventDetailBody`. Nothing here draws. That split is the one the last
 * three rebuilt pages made (people-search, new-event, plan-week) and it exists
 * so that every accepted frame can be POSED — `dev-ed-01…06` render the same
 * component out of `event-detail-fixtures.ts` with no session and no network.
 *
 * ── WHAT MOVED, AND WHERE IT WENT ─────────────────────────────────────────
 *
 * The poster prints far fewer rows than LP-04's page did. None of the
 * capabilities went with them:
 *
 * · WHEN and WHERE — the two labelled fact rows — are the small line under the
 *   name (`posterLine`) and, for the address, the one quiet line behind the
 *   clay bead (`logisticsLine`). The host's repair actions for a missing date
 *   or place are in the overflow menu and open the SAME three sheets.
 * · `Every option`, `Table talk`, the reservation link, `Invite more people`
 *   and the page's one destructive line are the overflow menu. The artifact
 *   puts the menu in the band and says so ("report lives in the header menu").
 * · The cancellation band is untouched and still carries `CANCELLATION_FACTS`
 *   verbatim, above the fold, where correction 26 put it.
 *
 * ── WHAT IS UNCHANGED ─────────────────────────────────────────────────────
 *
 * Every membership and privacy gate, and every data contract. §7.1 still
 * withholds time, venue and weather from someone who has only been invited —
 * carried by `dateTimeLine`'s and `posterLine`'s `coarse` flag. The roster
 * chips are drawn from the same `useEventMembers` rows the page always drew,
 * narrowed by the same `joined || isHost` rule, now inside `rosterChips` where
 * it can be tested. The board is still gated on MEMBERSHIP rather than on the
 * route. No query grew a column and no mutation changed its arguments.
 */

/** Open-Meteo's free forecast horizon; past it the poster simply omits weather. */
const FORECAST_DAYS = 16;

/** The one destructive confirmation up at a time. */
type ConfirmState =
  | { kind: 'cancel' }
  | { kind: 'leave' }
  | { kind: 'remove'; userId: string; name: string }
  | null;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  // The reader's own Dynamic Type setting. Read, never guessed — the app's one
  // stacking threshold, the same number the closet and the Plan week use.
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= AX_STACK_SCALE;
  const me = session.userId;

  const eventQuery = useEvent(id ?? null);
  const members = useEventMembers(id ?? '');

  const respond = useRespondToInvite();
  const leave = useLeaveEvent();
  const cancel = useCancelEvent();
  const removeMember = useRemoveMember();
  const update = useUpdateEvent();
  const reportFlow = useReportFlow();

  const [dateSheet, setDateSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [placeSheet, setPlaceSheet] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  /**
   * The reply the server refused, kept so the foot can offer exactly that one
   * again. Cleared on any new attempt — the frame's band is about the LAST
   * answer, not about a history of them.
   */
  const [failedReply, setFailedReply] = useState<'joined' | 'declined' | null>(null);

  // Live votes/comments for the count on the door down.
  useEventChannel(id ?? null);

  const event = eventQuery.data ?? null;
  const isMember = Boolean(event && (event.isHost || event.myState === 'joined'));

  // The board. Gated on MEMBERSHIP, not on `id`: event-social-contract.md §3 —
  // "the gate is membership, not the route." An invitee's page fires no board
  // read at all, rather than one the server is certain to refuse.
  const boardEventId = isMember ? (id ?? null) : null;
  const posts = useEventPosts(boardEventId);
  const comments = useEventComments(boardEventId);

  // Display-only weather, read at the VENUE's own coordinates when the place
  // was resolved through the gazetteer and at the reader's otherwise. It is a
  // real fact and the poster keeps it — folded into the one quiet line rather
  // than spending a row of its own, which is what "becomes structure or dies"
  // means for a fact that is true.
  const venueWeather = useOccasionWeather(event?.startsAt ?? null, event?.venueMeta ?? null);
  const { coords } = useStyleContext();
  const dayIndex = event ? daysFromToday(event.startsAt) : -1;
  const forecast = useQuery({
    queryKey: ['forecast', coords.latitude.toFixed(2), coords.longitude.toFixed(2), FORECAST_DAYS],
    enabled: isMember && !event?.venueMeta && dayIndex >= 0 && dayIndex < FORECAST_DAYS,
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) => fetchForecast(coords.latitude, coords.longitude, FORECAST_DAYS, signal),
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

  const myBoard = boards.find((b) => b.userId === me) ?? null;
  const myLeading = myBoard ? (boardLeader(myBoard.looks) ?? myBoard.looks[0] ?? null) : null;

  const { resolve } = useSignedUrls(
    looks.flatMap((l) => l.garments.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
  );

  // The evening starts, the board locks. "Now" is sampled once per mount
  // rather than per render — `Date.now()` during render is impure.
  const [openedAt] = useState(() => Date.now());

  const writeFailed = (title: string) => (error: unknown) =>
    Alert.alert(title, socialDenialCopy(error) ?? 'Check your connection and try again.');

  if (eventQuery.isLoading) {
    // The band paints from nothing yet, so the whole poster is the skeleton
    // frame — which is what frame 03 draws.
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <EventDetailBody large={large} view={loadingView(() => router.back())} />
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

  const canceled = Boolean(event.canceledAt);
  const hostName = event.hostId ? nameOf(event.hostId) : null;
  const openComments = (comments.data ?? []).filter((c) => !c.hidden).length;
  // An undated occasion never locks: the evening the tallies would freeze at
  // has not been chosen yet.
  const locked = event.startsAt ? openedAt >= event.startsAt.getTime() : false;
  const hostCanRepair = event.isHost && !canceled;

  const goPost = (editPostId?: string) =>
    router.push({
      pathname: '/event/[id]/post',
      params: editPostId ? { id: event.id, edit: editPostId } : { id: event.id },
    });
  const goComments = () => router.push({ pathname: '/event/[id]/comments', params: { id: event.id } });

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
   * The host's remove, which used to be a ghost button on every roster ROW.
   *
   * The chips are labels, not controls — the frames draw them with nothing
   * tappable in them — so the affordance moved to the menu rather than being
   * dropped. It is a two-step now instead of one, and deliberately: removing
   * somebody from an occasion was previously one stray thumb away on a row the
   * host scrolls past every time they open the page.
   */
  const openRemove = () => {
    const removable = roster.filter((m) => m.role !== 'host' && m.userId !== me);
    if (removable.length === 0) return;
    const names = removable.map((m) => m.displayName ?? m.username ?? 'this guest');
    const options = [...names, 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1, title: 'Remove someone' },
      (index) => {
        const picked = removable[index];
        if (picked) setConfirm({ kind: 'remove', userId: picked.userId, name: names[index]! });
      },
    );
  };

  /**
   * The overflow menu — every route and every control the poster stopped
   * printing as a row.
   *
   * `ActionSheetIOS` rather than a new component: it is what `closet-menu.tsx`,
   * `OutfitPostCard` and `CommentRow` already use for exactly this job, it is
   * native at every Dynamic Type size without a layout of ours to clip, and it
   * costs nothing in the bundle. The destructive row is marked as such so iOS
   * paints it red and reads it as destructive.
   */
  const openMenu = () => {
    const rows: { label: string; run: () => void; destructive?: boolean }[] = [];

    if (isMember) {
      rows.push({ label: 'Every option', run: () => router.push(`/event/${event.id}/outfits`) });
      rows.push({ label: 'Table talk', run: goComments });
    }
    if (isMember && event.reservationUrl) {
      rows.push({
        label: reservationLabel(event.reservationUrl),
        run: () => {
          void Linking.openURL(event.reservationUrl!).catch(() => {
            // A dead or malformed link is the platform's business, not a
            // crash — the row simply does nothing, like Safari would.
          });
        },
      });
    }
    // The host's two repairs, offered exactly where the fact is missing —
    // the same writes the two chips on the old fact rows offered.
    if (hostCanRepair && !event.startsAt) rows.push({ label: 'Add a date', run: () => setDateSheet(true) });
    if (hostCanRepair && event.startsAt) rows.push({ label: 'Change the time', run: () => setTimeSheet(true) });
    if (hostCanRepair && !event.venueName) rows.push({ label: 'Add a place', run: () => setPlaceSheet(true) });
    if (event.isHost && !canceled) {
      rows.push({ label: 'Invite more people', run: () => router.push(`/event/${event.id}/invite`) });
      if (roster.some((m) => m.role !== 'host' && m.userId !== me)) {
        rows.push({ label: 'Remove someone', run: openRemove });
      }
    }
    // The report affordance the artifact places in this menu. `'event'` is
    // already a `ReportSubject` and `useReportContent` already accepts it —
    // no server change, no new table, and the same RP-01…RP-04 sheets every
    // other reportable surface in the app opens.
    if (!event.isHost) {
      rows.push({
        label: 'Report this event',
        run: () =>
          reportFlow.open({
            subject: 'event',
            subjectId: event.id,
            subjectUserId: event.hostId,
            label: event.title,
            handle: hostName ?? '',
          }),
      });
    }
    if (!canceled && event.isHost) {
      rows.push({ label: 'Cancel this occasion', run: () => setConfirm({ kind: 'cancel' }), destructive: true });
    }
    if (!canceled && !event.isHost && event.myState === 'joined') {
      rows.push({ label: 'Leave this occasion', run: () => setConfirm({ kind: 'leave' }), destructive: true });
    }

    if (rows.length === 0) return;

    const options = [...rows.map((r) => r.label), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: rows.findIndex((r) => r.destructive) === -1
          ? undefined
          : rows.findIndex((r) => r.destructive),
        title: event.title,
      },
      (index) => rows[index]?.run(),
    );
  };

  const sendRsvp = (response: 'joined' | 'declined') => {
    setFailedReply(null);
    respond.mutate(
      { eventId: event.id, response },
      { onError: () => setFailedReply(response) },
    );
  };

  // ── The view ─────────────────────────────────────────────────────────────

  const chips = rosterChips(roster, { isHost: event.isHost, me });

  const dateLine = dateTimeLine(event.startsAt, event.endsAt, { coarse: !isMember });
  const posterInput = { venueName: isMember ? event.venueName : null, dateLine, coarse: !isMember };

  const tiles = myLeading
    ? myLeading.garments
        .slice(0, 3)
        .map((g) => ({ uri: resolve(g.platePath, g.cutoutPath, g.thumbPath) }))
    : [];

  const view: EventDetailView = {
    loading: false,
    tone: heroTone({ venueName: event.venueName, coarse: !isMember }),
    title: event.title,
    line: posterLine(posterInput),
    linesAx: posterLinesAx(posterInput),

    plate: !isMember
      ? // An invitee's board read never fired, so there is nothing to wait
        // for and nothing to show: the plate draws its outlines, not a
        // skeleton that would spin forever.
        { kind: 'empty' }
      : posts.isLoading
        ? { kind: 'loading' }
        : myLeading
          ? { kind: 'ready', tiles, label: lookName(myLeading.garments, myLeading.caption) }
          : { kind: 'empty' },

    // A locked or cancelled board is a record, not a control — and an invitee
    // has nothing to change until they join.
    onChangeLook: isMember && myLeading && !locked && !canceled ? () => goPost(myLeading.id) : null,

    empty:
      !myLeading && (!isMember || !posts.isLoading)
        ? {
            title: EVENT_DETAIL_COPY.emptyLookTitle,
            body: emptyLookBody({
              isMember,
              hostName,
              venueKnown: isMember && Boolean(event.venueName),
            }),
          }
        : null,

    chips: chips.chips,
    overflow: chips.overflow,
    // Only the host is on the list, so say so rather than drawing one lonely
    // chip and letting the reader wonder whether the rest failed to load.
    noReplies: !members.isLoading && !members.isError && chips.chips.length <= 1,

    logistics: isMember
      ? logisticsLine({
          venueAddress: event.venueAddress,
          occasion: event.occasion,
          partySize: event.partySize,
          dressCode: event.dressCode,
          note: event.note,
          weather: weather ? weatherLineFor(weather) : null,
        })
      : null,

    // Not a question for the host, and not one for anybody once the occasion
    // has been cancelled.
    rsvp:
      canceled || event.isHost
        ? null
        : {
            standing: event.myState === 'joined' ? 'going' : event.myState === 'declined' ? 'declined' : null,
            busy: respond.isPending,
          },
    failed: failedReply !== null,
    onPlanLook: isMember && !myLeading && !locked && !canceled ? () => goPost() : null,
    // An invitee has no thread to read: the board read never fired for them.
    commentCount: isMember ? openComments : null,

    notice: canceled ? (
      <NoticeBand
        cause="CANCELLED"
        title={cancelledHeading(hostName, event.title)}
        body={CANCELLATION_FACTS.join(' ')}
      />
    ) : null,

    onBack: () => router.back(),
    onMenu: openMenu,
    onRsvp: sendRsvp,
    onRetry: () => {
      if (failedReply) sendRsvp(failedReply);
    },
    onComments: goComments,
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <EventDetailBody view={view} large={large} />

      {/* The two confirmations (E-09). Each says what is lost in one sentence;
          each keep-option is named for the thing being kept. */}
      <ConfirmSheet
        visible={confirm?.kind === 'cancel'}
        title="Cancel this occasion?"
        // Correction 26 — the host's confirmation carries the same facts as the
        // attendee's notice, plus the one-way door. It does not promise anyone
        // is notified, does not promise anything about crowns, and does not
        // expose who had answered.
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
          // Through the same adapter the form writes through: filling this in
          // after the fact must produce the row it would have produced at
          // creation — resolver, category and identifier included.
          update.mutate(
            { eventId: event.id, patch: venueWriteFor(selection) },
            { onError: writeFailed('That place didn’t save') },
          );
        }}
        onClose={() => setPlaceSheet(false)}
      />

      {/* RP-01…RP-04, the app's one report funnel. Mounted once per screen. */}
      <ReportFlowSheets flow={reportFlow} />
    </SafeAreaView>
  );
}

/**
 * The poster while the occasion is still on its way — frame 03.
 *
 * A function rather than an object literal so the back affordance is live: the
 * one control that must work before anything has loaded is the way out.
 */
function loadingView(onBack: () => void): EventDetailView {
  return {
    loading: true,
    tone: 'accent',
    title: 'Event',
    line: '',
    linesAx: [],
    plate: { kind: 'loading' },
    onChangeLook: null,
    empty: null,
    chips: [],
    overflow: null,
    noReplies: false,
    logistics: null,
    rsvp: null,
    failed: false,
    onPlanLook: null,
    commentCount: null,
    notice: null,
    onBack,
    onMenu: () => {},
    onRsvp: () => {},
    onRetry: () => {},
    onComments: () => {},
  };
}
