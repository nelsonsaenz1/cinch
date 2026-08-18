import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  TripDetailBodyView,
  type DetailGroup,
  type TripDetailBody,
  type TripDetailView,
} from '@/components/trips/trip-detail-body';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { formatTemp } from '@/features/context/weather';
import { useDeleteTrip, useTrip, useUpdateTripNote } from '@/features/plan/use-trips';
import { nightCount } from '@/features/trips/trips-list-spec';
import {
  TRIP_DETAIL_STACK_SCALE,
  emptyBody,
  groupCaption,
  groupLabel,
  isFullyPacked,
  noteChanged,
  normaliseNote,
  packEvent,
  packingProgress,
  pieceLabel,
  plateBand,
  plateGroups,
  plateItemIds,
  tripDayCount,
  weatherMark,
} from '@/features/trips/trip-detail-spec';
import { useTripChecks } from '@/features/trips/use-trip-checks';
import { haptics } from '@/lib/haptics';
import { tripDatesLine } from '@/features/plan/new-trip-spec';

/**
 * Trip Detail — the route. Redesign 06, and the reason the shelf has chevrons.
 *
 * This file holds the queries and the state and hands one plain object to
 * `TripDetailBodyView`. Nothing here draws — the split the trips shelf, the
 * New Trip flow, the Plan week and the event poster all make, and the reason is
 * the same one every time: a screen that reaches for the trip row, the closet,
 * a batch of signed URLs and a local store at the top cannot be posed, and the
 * nine accepted frames have to be openable without a session.
 *
 * ── WHAT IT READS ────────────────────────────────────────────────────────────
 *
 * One `trips` row through `useTrip`, the closet, and its signed URLs — the same
 * three every other garment surface mounts. The plate itself is not fetched: it
 * is READ BACK out of the `memo` jsonb the packing flow already wrote, which is
 * what makes reopening a trip show the plan as it was built rather than a fresh
 * run against a closet and a forecast that have since moved on.
 *
 * ── THE TWO LAWS ─────────────────────────────────────────────────────────────
 *
 * The pieces are the reader's REAL closet items, by the ids the brief stored.
 * `plateGroups` yields ids; each is looked up in the closet and draws with its
 * own photograph or with none. There is no invented piece and no copy.
 *
 * Deleting a trip deletes a TRIP. `useDeleteTrip` names one table, the
 * confirmation says so to the reader in as many words, and
 * `tests/trip-detail-layout.test.ts` reads the mutation and holds it there.
 *
 * ── WHAT IS LOCAL AND WHAT IS NOT ────────────────────────────────────────────
 *
 * The ticks are on the device (`use-trip-checks.ts`) because that is the brief
 * and because a tick is about this suitcase in this room. The note is a column
 * on `trips`, written on blur through the module that owns the table. See the
 * spec's header for how the note came to be a column mid-build.
 */
export default function TripDetailScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();

  /**
   * The destination arrives as a param as well as in the row.
   *
   * Not redundancy: the shelf card that was tapped already knows the place, so
   * the hero can paint its real title in the first frame instead of a grey
   * rectangle that becomes one. The row remains the source of truth and
   * overwrites it the moment it lands — the param is only ever the head start,
   * and a deep link that carries no param simply gets an empty hero for a beat.
   */
  const { id, destination } = useLocalSearchParams<{ id: string; destination?: string }>();
  const tripId = typeof id === 'string' ? id : '';

  const trip = useTrip(tripId);
  const closet = useCloset();
  const deleteTrip = useDeleteTrip();
  const updateNote = useUpdateTripNote();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  /** The field's own copy while it is being typed. Committed on blur. */
  const [draftNote, setDraftNote] = useState<string | null>(null);

  const row = trip.data ?? null;
  const items = useMemo(() => closet.data ?? [], [closet.data]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const groups = useMemo(() => plateGroups(row?.memo ?? null), [row?.memo]);
  const pieceIds = useMemo(() => plateItemIds(groups), [groups]);

  const checks = useTripChecks(tripId, pieceIds);
  const progress = useMemo(
    () => packingProgress(pieceIds, checks.checked),
    [pieceIds, checks.checked],
  );
  const complete = isFullyPacked(progress);

  /**
   * Every photograph the plate might draw, signed in ONE batch.
   *
   * Collected across every day before signing rather than per tile: the signer
   * takes a list, and a request per tile would be one round trip per garment on
   * a page whose whole job is to show the bag at once. Same construction as the
   * trips shelf.
   */
  const paths = useMemo(() => {
    const out: (string | null | undefined)[] = [];
    for (const pieceId of pieceIds) {
      const item = byId.get(pieceId);
      if (item) out.push(item.platePath, item.cutoutPath, item.thumbPath);
    }
    return out;
  }, [pieceIds, byId]);

  const { resolve } = useSignedUrls(paths);

  const days = tripDayCount(row?.startsOn ?? null, row?.endsOn ?? null);
  const band = useMemo(() => plateBand(groups), [groups]);
  const mark = weatherMark(band, (c) => formatTemp(c, 'F'));

  /**
   * A piece is ticked.
   *
   * The haptic is chosen by `packEvent` rather than by an `if` here, so the one
   * rule — success fires on the tick that COMPLETES the plate and on no other —
   * is pinned by a test instead of living in a component. Both intents are the
   * policy's own: `selection()` is the value-changed-under-the-finger tick, and
   * `success()` is reserved for a moment that was genuinely in doubt.
   */
  const onToggle = useCallback(
    (itemId: string) => {
      const before = progress.packed;
      const next = checks.toggle(itemId);
      const after = packingProgress(pieceIds, next).packed;
      if (packEvent(before, after, pieceIds.length) === 'complete') haptics.success();
      else haptics.selection();
    },
    [checks, pieceIds, progress.packed],
  );

  const savedNote = row?.note ?? '';
  const note = draftNote ?? savedNote;

  /** Blur commits, and only when something actually changed. */
  const onNoteBlur = useCallback(() => {
    setNoteFocused(false);
    const next = normaliseNote(draftNote ?? savedNote);
    setDraftNote(null);
    if (!tripId || !noteChanged(next, savedNote)) return;
    updateNote.mutate({ tripId, note: next });
  }, [draftNote, savedNote, tripId, updateNote]);

  const onConfirmDelete = useCallback(() => {
    if (!tripId) return;
    // The confirm tap, not the tap that opened the sheet — the policy's own
    // rule, and the only Heavy in the app.
    haptics.destructiveConfirm();
    deleteTrip.mutate(tripId, {
      // Back to the shelf on success, where the row is already gone from the
      // invalidated list. `replace` rather than `back`: the page behind is a
      // detail view of a trip that no longer exists.
      onSuccess: () => router.replace('/trips'),
    });
  }, [tripId, deleteTrip, router]);

  const body: TripDetailBody = useMemo(() => {
    const heroName = row ? row.destination.name : (destination ?? '');
    const dates = row ? tripDatesLine(row.startsOn, row.endsOn) : null;

    // Loading covers the not-found row too: a deep link to a trip that was
    // deleted on another device resolves to `null`, and the honest thing to
    // show is the offline frame's "couldn't load", not an invented empty trip.
    if (trip.isLoading) return { state: 'loading', destination: heroName };

    if (trip.isError || !row) {
      return {
        state: 'error',
        destination: heroName,
        dates,
        ticked: checks.checked.length,
        onRetry: () => void trip.refetch(),
        onAllTrips: () => router.replace('/trips'),
      };
    }

    if (!groups.length) {
      return {
        state: 'empty',
        destination: heroName,
        dates,
        mark,
        body: emptyBody(nightCount(row.startsOn, row.endsOn)),
        // Straight into Packing, the same param the shelf's own CTA sends.
        onBuild: () => router.push({ pathname: '/(tabs)/plan', params: { mode: 'packing' } }),
      };
    }

    const detailGroups: DetailGroup[] = groups.map((group) => ({
      key: group.key,
      label: groupLabel(group, days),
      caption: groupCaption(group, group.tempC === null ? null : formatTemp(group.tempC, 'F')),
      tiles: group.itemIds.map((pieceId) => {
        const item = byId.get(pieceId);
        return {
          id: pieceId,
          // The reader's own garment, or nothing. Never a stand-in name.
          name: pieceLabel(item) ?? '',
          // The preference order every other garment well in the app uses.
          uri: item ? resolve(item.platePath, item.cutoutPath, item.thumbPath) : undefined,
          checked: checks.checked.includes(pieceId),
        };
      }),
    }));

    return {
      state: 'plate',
      destination: heroName,
      dates,
      mark,
      groups: detailGroups,
      progress,
      complete,
      note,
      noteFocused,
      onToggle,
      onNoteChange: setDraftNote,
      onNoteFocus: () => setNoteFocused(true),
      onNoteBlur,
      /**
       * Re-plan lands on Plan's Packing mode rather than seeding the flow with
       * this trip's answers. The questionnaire's seam for a starting state
       * (`useTripQuestionnaire`'s `devSeed`) is gated on `__DEV__` and exists so
       * fixtures can pose a partly-answered card — it is deliberately not a
       * shipping path, and widening it would be rebuilding the flow's state
       * machine from this page. Listed as a deviation.
       */
      onReplan: () => router.push({ pathname: '/(tabs)/plan', params: { mode: 'packing' } }),
      onSeeTheWeek: () => router.push({ pathname: '/(tabs)/plan', params: { mode: 'week' } }),
    };
  }, [
    row,
    destination,
    trip,
    groups,
    days,
    byId,
    resolve,
    checks.checked,
    progress,
    complete,
    note,
    noteFocused,
    mark,
    onToggle,
    onNoteBlur,
    router,
  ]);

  const view: TripDetailView = {
    onBack: () => router.back(),
    /**
     * The frames draw an overflow control in the chrome. Everything it would
     * hold — re-plan, delete — is already a labelled button in the foot, so
     * pointing it at the delete confirmation gives it one real job rather than
     * opening a menu that repeats the page. Listed as a deviation.
     */
    onMore: body.state === 'loading' || body.state === 'error' ? null : () => setDeleteOpen(true),
    deleteOpen,
    deleting: deleteTrip.isPending,
    onRequestDelete: () => setDeleteOpen(true),
    onCancelDelete: () => setDeleteOpen(false),
    onConfirmDelete,
    body,
  };

  // Both edges: this is a pushed page with a pinned foot, so on a device with a
  // home indicator the actions would otherwise sit under it. The artifact's
  // frame had a tab bar occupying that space.
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <TripDetailBodyView view={view} large={fontScale >= TRIP_DETAIL_STACK_SCALE} />
    </SafeAreaView>
  );
}
