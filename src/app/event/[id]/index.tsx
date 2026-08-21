import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Linking,
  Share,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/events/ConfirmSheet';
import {
  EventDetailBody,
  type EventDetailView,
  type EventLookOption,
} from '@/components/events/event-detail-body';
import { PlateCard } from '@/components/share/plate-card';
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
import { MAX_LOOKS_PER_BOARD, type PostedLook } from '@/features/event-outfits/types';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast } from '@/features/context/weather';
import {
  EVENT_DETAIL_COPY,
  LOOK_OPTION_LIMIT,
  emptyLookBody,
  formalityTarget,
  heroTone,
  logisticsLine,
  occasionTarget,
  posterLine,
  posterLinesAx,
  rosterChips,
  suggestionCount,
} from '@/features/events/event-detail-spec';
import { CARD_H, CARD_W, sharePlate } from '@/features/share/capture-plate';
import { lookShareMessage } from '@/features/share/share-copy';
import { useInviteLink } from '@/features/invite/queries';
import { useComposeAndPostLook } from '@/features/share-look/mutations';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { useOutfits, type StyledOutfit } from '@/features/styling/use-outfits';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';
import { track } from '@/lib/posthog';
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
  /**
   * The day's context, asked for THIS OCCASION rather than for this morning.
   *
   * The same hook Today calls, with the same two levers: the host's own
   * occasion word becomes `targetOccasion` (matched against each garment's
   * `occasions` tags) and the dress code becomes `targetFormality` (the 0..1
   * the scorer already reads). Neither is invented here — `occasionTarget` and
   * `formalityTarget` are pure and pinned, and both answer null for a host who
   * said nothing, which leaves the engine's own reading in charge.
   */
  const { context, coords } = useStyleContext({
    targetOccasion: occasionTarget(event?.occasion),
    targetFormality: formalityTarget(event?.dressCode),
  });
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

  // The evening starts, the board locks. "Now" is sampled once per mount
  // rather than per render — `Date.now()` during render is impure.
  //
  // Read BEFORE the loading/error returns, because the chooser's own hooks are
  // below and every one of them is gated on these two: an occasion that has
  // started or been called off is a record, and generating fresh suggestions
  // for it would be work nobody can act on.
  const [openedAt] = useState(() => Date.now());
  const canceled = Boolean(event?.canceledAt);
  const locked = event?.startsAt ? openedAt >= event.startsAt.getTime() : false;

  // ── The chooser ───────────────────────────────────────────────────────────
  //
  // Up to three options, filled from two places and NOTHING new. The looks this
  // member has already put on the board come first — those are the ones friends
  // can see and vote on — and whatever slots are left are filled by the same
  // on-device beam search Today runs, given this occasion as its context. No
  // new table, no new generator, no second definition of what an outfit is.
  const myPosted = useMemo(
    () => (myBoard?.looks ?? []).slice(0, LOOK_OPTION_LIMIT),
    [myBoard],
  );
  const wardrobe = useWardrobe();
  const profileQuery = useStyleProfile();
  const items = useMemo(() => wardrobe.data ?? [], [wardrobe.data]);
  // Priors until the real profile lands, so generation is never blocked on it.
  // Memoised because the fallback is an object literal — a fresh identity every
  // render would re-run the engine on every keystroke anywhere on the page.
  const profile = useMemo(
    () =>
      profileQuery.data ?? {
        weights: DEFAULT_WEIGHTS,
        affinities: EMPTY_AFFINITIES,
        feedbackCount: 0,
        summary: [],
      },
    [profileQuery.data],
  );
  const wantSuggestions = suggestionCount(myPosted.length);
  const suggestions = useOutfits({
    wardrobe: items,
    context,
    profile,
    count: wantSuggestions,
    enabled:
      isMember && !locked && !canceled && wantSuggestions > 0 && canGenerate(items),
  });
  const suggested = suggestions.outfits;

  const { resolve } = useSignedUrls([
    ...looks.flatMap((l) => l.garments.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
    ...suggested.flatMap((o) =>
      o.candidate.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]),
    ),
  ]);

  // ── Publishing a suggestion, and sharing whichever option is on screen ─────
  const postLook = useComposeAndPostLook();
  const [publishing, setPublishing] = useState<string | null>(null);
  /** The sharer's own invite link, off the cached profile row. Never the occasion's. */
  const myLink = useInviteLink().link.url;
  /** The offscreen card, mounted only while a capture is in flight. */
  const shareView = useRef<View | null>(null);
  const [shareCard, setShareCard] = useState<StyledOutfit | null>(null);

  const shareFailed = useCallback(() => {
    setShareCard(null);
    Alert.alert('That didn’t share', 'The card couldn’t be made just now. Try again in a moment.');
  }, []);

  const shareSuggestion = useCallback((outfit: StyledOutfit) => {
    // The composer the rest of the app shares looks through — `PlateCard` on
    // its fixed 360×640 canvas, captured by `sharePlate`. Mounted offscreen for
    // exactly as long as the capture takes; see `components/today/plate.tsx`,
    // which does the same thing with the same two pieces.
    setShareCard(outfit);
  }, []);

  const sharePosted = useCallback(
    (look: PostedLook, occasionTitle: string | null) => {
      // A look already on the board has no `OutfitCandidate` behind it — the
      // board's rows carry garments, not the engine's feature vector — so this
      // is the board's OWN share, unchanged: the sentence plus the sharer's
      // invite link in the `url` slot, which is what makes Messages draw the
      // preview card.
      track('board_shared', { scope: 'look', mine: true, locked, has_link: myLink != null });
      void Share.share({
        message: lookShareMessage({ posterName: null, mine: true, occasionTitle }),
        url: myLink ?? undefined,
      }).catch(() => {});
    },
    [locked, myLink],
  );

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

  // `canceled` and `locked` are read above, before the chooser's hooks — an
  // undated occasion never locks, because the evening the tallies would freeze
  // at has not been chosen yet.
  const hostName = event.hostId ? nameOf(event.hostId) : null;
  const openComments = (comments.data ?? []).filter((c) => !c.hidden).length;
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

    /**
     * NO `Every option` AND NO `Table talk`. The founder's ruling, items 7 & 8.
     *
     * Both used to be rows here and both pointed at a conversation the poster
     * was already offering: `Table talk` opened the very thread the door down
     * at the foot opens, so the page had two controls with different names for
     * one destination, and `Every option` opened a second, separate screen for
     * the looks and their votes. That screen's job is now done in the same
     * sheet as the talk — "Table Talk & Outfit Voting" — so the menu has
     * nothing to add and says nothing.
     *
     * The board route itself (`/event/[id]/outfits`) is NOT deleted: the
     * composer still lands on it after a post and it is still reachable by
     * deep link. It has simply stopped being a destination this page offers.
     */
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

  /**
   * A suggestion becomes an option friends can see and vote on. Item 3.
   *
   * `useComposeAndPostLook` — the SAME mutation the three-step composer's last
   * step calls — so there is one path from "these garments" to a row in
   * `event_outfit_posts`, and the composite FK on `outfits(id, user_id)` is
   * still what proves the outfit is the caller's. `saveToLately: false` is the
   * one argument that differs from the composer's default and it is deliberate:
   * choosing what to wear on Saturday is not a claim to have worn it.
   */
  const publishSuggestion = (optionId: string, outfit: StyledOutfit) => {
    if (publishing) return;
    setPublishing(optionId);
    postLook.mutate(
      {
        eventId: event.id,
        itemIds: outfit.candidate.items.map((g) => g.id),
        title: outfit.name,
        caption: null,
        saveToLately: false,
      },
      {
        onSettled: () => setPublishing(null),
        onError: (error) =>
          Alert.alert(
            'That look didn’t go up',
            socialDenialCopy(error) ?? 'Check your connection and try again.',
          ),
      },
    );
  };

  const sendRsvp = (response: 'joined' | 'declined') => {
    setFailedReply(null);
    respond.mutate(
      { eventId: event.id, response },
      {
        onError: (error) => {
          // A plan boundary is not a failed reply — the hook has already
          // offered the paywall; this names why in the stylist's voice. An
          // ordinary failure keeps the retry chip exactly as before.
          const denial = socialDenialCopy(error);
          if (denial) {
            Alert.alert('Three events on Free', denial);
            return;
          }
          setFailedReply(response);
        },
      },
    );
  };

  // ── The view ─────────────────────────────────────────────────────────────

  const chips = rosterChips(roster, { isHost: event.isHost, me });

  const dateLine = dateTimeLine(event.startsAt, event.endsAt, { coarse: !isMember });
  const posterInput = { venueName: isMember ? event.venueName : null, dateLine, coarse: !isMember };

  const tilesFor = (garments: { platePath: string | null; cutoutPath: string | null; thumbPath: string | null }[]) =>
    garments.slice(0, 3).map((g) => ({ uri: resolve(g.platePath, g.cutoutPath, g.thumbPath) }));

  /**
   * The 1–3 options, posted first and suggestions after.
   *
   * ORDER IS LOAD-BEARING and it is not a ranking: a look already on the board
   * is a decision this member has made and other people are voting on, so it
   * comes before a machine's proposal. Within each half the order is the order
   * it arrived in — posting order for the board (never vote order), shortlist
   * order for the engine — because a rail that re-sorts itself as picks land
   * moves a card out from under somebody's thumb.
   */
  const canPost = isMember && !locked && !canceled;

  const postedOptions: EventLookOption[] = myPosted.map((look) => ({
    id: look.id,
    label: lookName(look.garments, look.caption),
    tiles: tilesFor(look.garments),
    posted: true,
    votes: look.votes,
    onAdd: null,
    onChange: canPost ? () => goPost(look.id) : null,
    onShare: () => sharePosted(look, event.title),
  }));

  const suggestedOptions: EventLookOption[] = canPost
    ? suggested.map((outfit) => {
        const optionId = outfit.candidate.items.map((g) => g.id).join('.');
        return {
          id: optionId,
          label: outfit.name,
          tiles: tilesFor(outfit.candidate.items),
          posted: false,
          // A suggestion nobody else can see cannot have been picked. Null
          // rather than 0 — "zero is quiet" is the board's rule and this is not
          // even a zero, it is an absence.
          votes: null,
          onAdd: () => publishSuggestion(optionId, outfit),
          onChange: null,
          onShare: () => shareSuggestion(outfit),
          busy: publishing === optionId,
        };
      })
    : [];

  const options = [...postedOptions, ...suggestedOptions].slice(0, LOOK_OPTION_LIMIT);

  const view: EventDetailView = {
    loading: false,
    tone: heroTone({ venueName: event.venueName, coarse: !isMember }),
    title: event.title,
    line: posterLine(posterInput),
    linesAx: posterLinesAx(posterInput),

    looks: !isMember
      ? // An invitee's board read never fired, so there is nothing to wait
        // for and nothing to show: the chooser draws its outlines, not a
        // skeleton that would spin forever.
        { kind: 'empty' }
      : posts.isLoading || wardrobe.isLoading
        ? { kind: 'loading' }
        : options.length > 0
          ? { kind: 'ready', options }
          : { kind: 'empty' },

    empty:
      options.length === 0 && (!isMember || !(posts.isLoading || wardrobe.isLoading))
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
    /**
     * `Plan a look` is offered until the board's own cap, not until the first
     * look exists.
     *
     * It used to disappear the moment anything was pinned, which made the
     * three-per-member cap unreachable from this page — the founder's item 3 is
     * that planning a look ADDS an option friends can vote on, and one option
     * is not a vote. `MAX_LOOKS_PER_BOARD` is the same number the composer
     * enforces, so the control and the screen behind it agree.
     */
    onPlanLook:
      isMember && !locked && !canceled && myPosted.length < MAX_LOOKS_PER_BOARD
        ? () => goPost()
        : null,
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

      {/* The share card, offscreen and only while a capture is in flight.

          `PlateCard` is the app's one look composer — the same 360×640 canvas
          Today and the packing memo capture — and `sharePlate` is the same
          capture-and-hand-to-the-sheet call. Nothing here is new; the card is
          simply given an occasion's option instead of a morning's.

          Positioned off the left edge rather than hidden: `captureRef` needs a
          laid-out view, and a `display: none` one has no pixels to read. */}
      {shareCard ? (
        <View
          ref={shareView}
          collapsable={false}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            left: -CARD_W * 2,
            top: 0,
            width: CARD_W,
            height: CARD_H,
          }}>
          <PlateCard
            outfit={shareCard}
            resolveImage={resolve}
            onReady={() => {
              void sharePlate(shareView)
                .then(() => setShareCard(null))
                .catch(shareFailed);
            }}
          />
        </View>
      ) : null}

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
    looks: { kind: 'loading' },
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
