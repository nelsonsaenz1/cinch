import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { PackingPlateBody, type PlateDay } from '@/components/plan/packing-plate-body';
import { PackingMemoCard } from '@/components/share/packing-memo-card';
import { Button, Card, EmptyState, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import {
  fetchForecastRange,
  fetchSeasonalNormals,
  formatTemp,
  hasForecastFor,
} from '@/features/context/weather';
import { CARD_H, CARD_W, sharePlate } from '@/features/share/capture-plate';
import { usePlan } from '@/features/billing/use-plan';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { DEFAULT_WEIGHTS } from '@/lib/styling';
import { haptics } from '@/lib/haptics';
import type { Item } from '@/schemas/item';
import type { Json } from '@/types/database';

import {
  NEW_TRIP_STACK_SCALE,
  PLATE_TILES,
  answerRows,
  plannedColophon,
  plateDayLabel,
  tripDatesLine,
  weatherMark,
} from './new-trip-spec';
import { buildPackingList, swapDay, type PackingResult } from './packing';
import { lookSchedule, repeatLabel } from './packing-math';
import {
  buildSavedMemo,
  dayCaption,
  dayTempLabel,
  firstUnfilledPart,
  groupLooksByDay,
  memoHeadline,
  normalsSummaryLine,
  shortfallSentence,
  type SavedMemo,
} from './packing-memo';
import {
  dayPartOf,
  formalityForPart,
  fromIsoDate,
  tripDays,
  vibeOf,
  type DayPartKey,
  type Trip,
} from './trip';
import { usePackingBrief } from './use-packing-brief';
import { useLastPackedTrip, useSaveTrip, useStartTrip, type SavedTrip } from './use-trips';

/**
 * One trip, from the answered questionnaire to the packing plate.
 * Redesign 05.
 *
 * ── WHAT CHANGED IN THIS WAVE ────────────────────────────────────────────────
 *
 * The three states the accepted frames draw now come from
 * `components/plan/packing-plate-body.tsx`, which this file feeds:
 *
 *   · BUILDING — the plate's geometry, arriving, with the wait expressed as the
 *     CTA's own clay fill. It replaces K-04's four ticked research lines. Those
 *     lines described a screen that narrated its own work; the frames show the
 *     shape of what is coming instead, and nothing moves when it lands.
 *   · FAILED — new, and it closes a real hang. `researching` was `!packing ||
 *     !memoStepDone`, and `packing` needs `forecasts`, which needs a query that
 *     can ERROR. A failed weather or closet read left the research lines ticking
 *     for ever with no way out. It is now the frames' amber band, the three
 *     preserved answers, and two real ways forward.
 *   · PLANNED — the completion moment. Pieces GRIDDED by day, a success haptic,
 *     and two clear paths out.
 *
 * K-06's other two failures are NOT in the accepted frames and keep their
 * existing composition: dates past the forecast horizon (`ForecastHorizonFailure`)
 * and a closet too thin to fill every look (`ShortfallFailure`). Both are
 * honest, both are reachable, and inventing frames for them was not this wave's
 * brief.
 *
 * ── WHAT THIS FILE STILL DOES NOT DO ─────────────────────────────────────────
 *
 * It does not gate anything. `PackingTab` checks `usePackingAccess` before this
 * component is rendered and that check fails closed; the membership read here
 * only ever adds a banner, because a member who cannot be VERIFIED is treated
 * as a member and the server checks independently.
 */

/**
 * A few shimmering lines, gutter-less.
 *
 * `ListSkeleton` carries its own `px-gutter` — right for a screen header, but
 * every loading spot on this screen is already inside a gutter of its own
 * (a `Card`'s padding, or the page's `ScrollView`), so stacking a second one
 * on top would visibly double-indent the placeholder. This is the bare
 * `Skeleton` primitive instead, sized like running prose.
 */
function TextSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <View>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'} ${i > 0 ? 'mt-2' : ''}`} delay={i * 90} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// K-06 · Failure 1 — dates past the forecast horizon
// ---------------------------------------------------------------------------

export function ForecastHorizonFailure({
  placeName,
  monthName,
  normalsLine,
  normalsLoading,
  onPackAnyway,
  onSaveAndRevise,
  saving,
}: {
  placeName: string;
  monthName: string;
  normalsLine: string | null;
  normalsLoading: boolean;
  onPackAnyway: () => void;
  onSaveAndRevise: () => void;
  saving: boolean;
}) {
  return (
    <View className="px-gutter pt-2">
      <Card padding="xl">
        <SectionHeader title="No forecast for those dates" />
        <View className="mt-3">
          <Text variant="title" trim>
            {monthName} is more than two weeks out.
          </Text>
        </View>
        {normalsLoading ? (
          <View className="mt-4">
            <TextSkeleton lines={2} />
          </View>
        ) : (
          <Text variant="body" className="mt-4 text-muted">
            {normalsLine ??
 `There's no real forecast yet for ${placeName} in ${monthName}, and Cinch has nothing to base normals on either.`}
            {' '}Cinch will revise the list closer to the day.
          </Text>
        )}
        <View className="mt-6 flex-row gap-3">
          <Button
            title="Pack anyway"
            onPress={onPackAnyway}
            disabled={normalsLoading || !normalsLine}
            haptic
            className="flex-1"
          />
          <Button
            title="Save and revise"
            variant="secondary"
            onPress={onSaveAndRevise}
            loading={saving}
            haptic
            className="flex-1"
          />
        </View>
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------------------
// K-06 · Failure 2 — the closet can't fill every look
// ---------------------------------------------------------------------------

export function ShortfallFailure({
  sentence,
  onShow,
}: {
  sentence: string;
  onShow: () => void;
}) {
  return (
    <View className="px-gutter pt-2">
      <Card padding="xl">
        <SectionHeader title="Closet too thin for the trip" />
        <Text variant="body" className="mt-3 text-muted">
          {sentence} That’s an honest gap, not a bug.
        </Text>
        <Button title="Show the six" onPress={onShow} haptic className="mt-6 self-start px-6" />
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------------------
// K-06 · Failure 3 — membership can't be confirmed. FAILS OPEN: this is a
// banner, never a gate, and the research/memo below it keep going regardless.
// ---------------------------------------------------------------------------

export function MembershipUnconfirmedBanner({
  onOpenLastList,
  onRetry,
  retrying,
  hasLastList,
}: {
  onOpenLastList: () => void;
  onRetry: () => void;
  retrying: boolean;
  hasLastList: boolean;
}) {
  return (
    <View className="mb-6 rounded-md border border-rule px-4 py-3">
      <Text variant="eyebrow">Membership can’t be confirmed</Text>
      <Text variant="body" className="mt-2 text-muted">
        The App Store isn’t responding, so Cinch can’t check your membership. Nothing here
        stops — a member who can’t be verified is treated as one.
      </Text>
      <View className="mt-3 flex-row gap-4">
        {hasLastList ? (
          <Pressable onPress={onOpenLastList} accessibilityRole="button" hitSlop={8}>
            <Text variant="label" className="underline">
              Open last list
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8} disabled={retrying}>
          <Text variant="label" className="underline">
            {retrying ? 'Retrying…' : 'Retry'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// K-04 and K-05 are gone from this file
// ---------------------------------------------------------------------------
//
// The four ticked research lines, the packed-piece grid with its repeat chips,
// and the per-day rows of garment NAMES were the previous atlas's answer to
// "what did it pack". Redesign 05 replaced all three with one plate — the day,
// then that day's pieces, three across, as photographs. See
// `components/plan/packing-plate-body.tsx`, and the deviation list in the
// build report for what the frames dropped and why.
//
// The prose slot went earlier and for its own reason, recorded here because it
// still explains an absence: the memo used to be a model call with four
// distinct failures — offline, consent withdrawn, allowance spent, not
// deployed — each with its own card and a "Try again". All four described a
// network this screen no longer touches.

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export function PackingTrip({ trip, onStartAgain }: { trip: Trip; onStartAgain: () => void }) {
  const qc = useQueryClient();
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= NEW_TRIP_STACK_SCALE;

  const closet = useCloset();
  const wardrobeQuery = useWardrobe();
  const profileQuery = useStyleProfile();
  const { context } = useStyleContext();

  const wardrobe = useMemo(() => wardrobeQuery.data ?? [], [wardrobeQuery.data]);
  const items = useMemo(() => closet.data ?? [], [closet.data]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const days = tripDays(trip);

  const { resolve } = useSignedUrls(items.flatMap((i) => [i.platePath, i.cutoutPath, i.thumbPath]));

  // ── The row exists from the moment the questionnaire is answered ─────────
  // K-06's "your answers are saved" is only true if this actually ran before
  // anything could fail. One attempt per mount — `trip` is stable for the
  // life of this component (`PackingTab` only ever hands it null or one
  // trip; it never swaps one answered trip for another without unmounting).
  const startTrip = useStartTrip();
  const [tripId, setTripId] = useState<string | null>(null);
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startTrip.mutate(trip, { onSuccess: (id) => setTripId(id) });
    // A failed start is swallowed by design (`use-trips.ts`): packing
    // proceeds from the answers already in memory either way.
  }, [trip, startTrip]);

  // ── K-06 · Failure 1 — dates past the 16-day horizon ──────────────────────
  const withinHorizon = hasForecastFor(trip.startsOn, trip.endsOn);
  const [packAnyway, setPackAnyway] = useState(false);
  const monthName = fromIsoDate(trip.startsOn).toLocaleDateString('en-US', { month: 'long' });

  const normalsQuery = useQuery({
    queryKey: ['seasonal-normals', trip.destination.latitude.toFixed(2), trip.destination.longitude.toFixed(2), trip.startsOn, trip.endsOn],
    enabled: !withinHorizon,
    staleTime: 60 * 60_000,
    queryFn: ({ signal }) =>
      fetchSeasonalNormals(trip.destination.latitude, trip.destination.longitude, trip.startsOn, trip.endsOn, signal),
  });

  const forecastQuery = useQuery({
    queryKey: ['forecast-range', trip.destination.latitude.toFixed(2), trip.destination.longitude.toFixed(2), trip.startsOn, trip.endsOn],
    enabled: withinHorizon,
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchForecastRange(trip.destination.latitude, trip.destination.longitude, trip.startsOn, trip.endsOn, signal),
  });

  const weatherSource: 'forecast' | 'normals' = withinHorizon ? 'forecast' : 'normals';
  const forecasts = withinHorizon ? forecastQuery.data : normalsQuery.data?.perDay;
  const forecastsReady = withinHorizon ? forecastQuery.isSuccess : normalsQuery.isSuccess;

  // ── K-06 · Failure 3 — did the subscription READ fail, as opposed to
  // coming back free? `usePlan` now distinguishes them (`unconfirmed`), which
  // it did not when this screen was written — the first version matched on
  // react-query's key from outside, a coupling to another module's internals.
  // Never gates anything: a failed read only ever adds a banner, because a
  // member who cannot be verified is treated as a member and the server
  // checks independently. ──────────────────────────────────────────────────
  const [membershipRetrying, setMembershipRetrying] = useState(false);
  const membershipUnconfirmed = usePlan().unconfirmed;

  const retryMembership = useCallback(() => {
    setMembershipRetrying(true);
    void qc.invalidateQueries({ queryKey: ['subscription'] }).finally(() => setMembershipRetrying(false));
  }, [qc]);

  const lastPacked = useLastPackedTrip();
  const [viewingSaved, setViewingSaved] = useState(false);

  // ── The deterministic capsule ──────────────────────────────────────────
  /**
   * The result after a swap.
   *
   * Carries the computed result it was derived FROM, so a fresh search
   * discards it without an effect: a new forecast or a changed closet makes a
   * swapped list a statement about a trip that no longer exists, and resetting
   * that from `useEffect` is a cascading render the lint rightly refuses.
   */
  const [swap, setSwap] = useState<{
    from: PackingResult;
    result: PackingResult;
    cursor: number;
  } | null>(null);

  const computed = useMemo<PackingResult | null>(() => {
    if (!forecasts?.length || wardrobeQuery.isLoading) return null;
    const schedule = lookSchedule(trip.startsOn, days, trip.parts);
    const pool = wardrobe;

    // A closet too thin to attempt a search at all is not a reason to wait
    // forever — it is the same honest shortfall Failure 2 already names,
    // just with nothing filled at all. Returning null here would leave K-04
    // checking "Building N looks" for ever, which is the silent hang the
    // rest of the app goes out of its way to convert into a real state.
    if (!canGenerate(pool)) {
      return {
        looks: schedule.map((l) => ({ ...l, weather: forecasts[l.dayIndex] ?? null, outfit: null })),
        items: [],
        unfilled: schedule.length,
      };
    }

    return buildPackingList({
      wardrobe: pool,
      schedule,
      forecasts,
      baseContext: context,
      weights: profileQuery.data?.weights ?? DEFAULT_WEIGHTS,
      formalityForPart: (part) => formalityForPart(trip, part),
    });
  }, [forecasts, wardrobe, wardrobeQuery.isLoading, context, profileQuery.data?.weights, trip, days]);

  const live = swap && swap.from === computed ? swap : null;
  const packing = live?.result ?? computed;

  const closetTooThin = !wardrobeQuery.isLoading && wardrobe.length === 0;

  const [acknowledgedShortfall, setAcknowledgedShortfall] = useState(false);

  // ── What the plate waits on ────────────────────────────────────────────
  const requestedLooks = lookSchedule(trip.startsOn, days, trip.parts).length;

  // Computed here rather than fetched. See `use-packing-brief.ts` — the memo
  // used to be a model call and is now arithmetic over the bag on screen.
  const brief = usePackingBrief({
    trip,
    forecasts,
    weatherSource,
    packing,
    requestedLooks,
  });
  const forecastStepDone = forecastsReady;
  const closetStepDone = !wardrobeQuery.isLoading && wardrobeQuery.isSuccess && forecastsReady;
  const looksStepDone = Boolean(packing);
  // The memo lands with the capsule now: it is the same computation, so there
  // is no fourth thing to wait for.
  const memoStepDone = brief.isSuccess;

  /**
   * The wait, as a fraction.
   *
   * The four things the plate is waiting on are the same four K-04 used to tick
   * off one line at a time. The frames removed the narration and kept the
   * arithmetic: the CTA's clay fill is how far through those four the screen is,
   * which means the bar can only move when something real finished. It is not a
   * timer and it never fakes forward motion.
   */
  const done = [forecastStepDone, closetStepDone, looksStepDone, memoStepDone].filter(Boolean).length;
  const progress = done / 4;

  /**
   * The read that cannot recover on its own.
   *
   * `packing` needs `forecasts`, `forecasts` needs a query, and a query can
   * ERROR — at which point `computed` is null for ever and the old screen
   * ticked its research lines until the app was killed. Naming the state is
   * what turns a hang into the frames' failure card, which has a retry on it.
   *
   * `wardrobeQuery` is folded in for the same reason: a closet read that failed
   * leaves `canGenerate` unanswerable, not empty, and "empty" is a different
   * screen (`closetTooThin` below) with a different true sentence on it.
   */
  const weatherFailed = withinHorizon ? forecastQuery.isError : normalsQuery.isError;
  const researchFailed = !packing && (weatherFailed || wardrobeQuery.isError);

  const researching = !researchFailed && (!packing || !memoStepDone);

  const [retrying, setRetrying] = useState(false);

  /**
   * Re-read whichever weather source this trip is on, plus the closet.
   *
   * `refetch` rather than an invalidate: these two queries are the only thing
   * the failure is about, and invalidating by key would also drop the closet
   * reads every other mounted screen is holding.
   */
  const handleRetryResearch = useCallback(() => {
    setRetrying(true);
    void Promise.allSettled([
      withinHorizon ? forecastQuery.refetch() : normalsQuery.refetch(),
      wardrobeQuery.refetch(),
    ]).finally(() => setRetrying(false));
  }, [withinHorizon, forecastQuery, normalsQuery, wardrobeQuery]);

  // ── The completion write ──────────────────────────────────────────────
  const saveTrip = useSaveTrip();

  const handleSaveToPlan = useCallback(async () => {
    if (!packing) return;
    let id = tripId;
    if (!id) {
      id = await startTrip.mutateAsync(trip).catch(() => null);
      if (id) setTripId(id);
    }
    if (!id) return;

    const memo: SavedMemo = buildSavedMemo({
      headline: memoHeadline(packing.items.length, packing.looks.filter((l) => l.outfit).length),
      prose: brief.data?.observation ?? null,
      weatherSource,
      packing,
      tripDays: days,
    });

    await saveTrip.mutateAsync({
      tripId: id,
      pieceCount: packing.items.length,
      lookCount: packing.looks.filter((l) => l.outfit).length,
      itemIds: packing.items.map((p) => p.garment.id),
      memo: memo as unknown as Json,
      weatherSource,
    });
    // No notice: the "Trip planned" badge on the plate IS the confirmation, and
    // it is drawn from the same moment this write is fired from.
  }, [packing, tripId, startTrip, trip, brief.data, weatherSource, days, saveTrip]);

  /**
   * Re-dress one day, and only that day.
   *
   * `swapDay` replays the existing result — every other look keeps its outfit
   * and still contributes its affinity — so the swap cannot ripple into
   * Sunday. The earlier version re-ran the whole trip with the day's pieces
   * removed, which changed neighbouring days for reasons the user never asked
   * for.
   */
  const handleSwapDay = useCallback(() => {
    if (!packing) return;
    const groups = groupLooksByDay(packing.looks);
    if (!groups.length) return;
    const cursor = live?.cursor ?? 0;
    const target = groups[cursor % groups.length]!;

    setSwap({
      from: computed!,
      result: swapDay({
        previous: packing,
        dayIndex: target.dayIndex,
        wardrobe,
        baseContext: context,
        weights: profileQuery.data?.weights ?? DEFAULT_WEIGHTS,
        formalityForPart: (part: DayPartKey) => formalityForPart(trip, part),
      }),
      cursor: cursor + 1,
    });
  }, [packing, computed, live, wardrobe, context, profileQuery.data?.weights, trip]);

  // ── Share — the same offscreen-capture pattern the outfit plate uses ────
  const [shareMounted, setShareMounted] = useState(false);
  const shareView = useRef<View>(null);

  const handleShare = useCallback(() => {
    if (!packing || shareMounted) return;
    setShareMounted(true);
  }, [packing, shareMounted]);

  const handleCardReady = useCallback(() => {
    // 'packing' picks the memo's own share sentence. The default is 'outfit'
    // because three of the four call sites are outfits; without this argument
    // the bag would go out described as a look.
    void sharePlate(shareView, 'packing')
      .catch(() => {})
      .finally(() => setShareMounted(false));
  }, []);

  /**
   * Has the plate actually landed?
   *
   * Computed as one expression rather than inferred from which early return
   * fired, because the completion EFFECT below needs the same answer and a hook
   * cannot live after a return.
   */
  const planned =
    !viewingSaved &&
    !closetTooThin &&
    (withinHorizon || packAnyway) &&
    !researching &&
    !researchFailed &&
    packing !== null &&
    (packing.unfilled === 0 || acknowledgedShortfall);

  /**
   * "Trip planned" — the moment, made true.
   *
   * TWO THINGS FIRE HERE AND BOTH ARE ONCE-ONLY.
   *
   * The success haptic, because this is precisely what `haptics.success()` is
   * reserved for: an operation the user was WAITING on, which could have gone
   * the other way (see the failure state above), landing. Not `commit()` — the
   * user did not just tap anything.
   *
   * And the save. The frames assert "Trip planned" as a fact, and it was only a
   * fact once somebody found and pressed a "Save to Plan" button — until then
   * the row carried no `saved_at`, the trips shelf showed no "Packed" badge, and
   * "Open last list" had nothing to open. A completion moment that claims
   * something the database does not know is a lie the next screen exposes, so
   * the write happens with the claim. It costs the user nothing: `useStartTrip`
   * already wrote the row unprompted the moment the questionnaire was answered,
   * and this adds the counts and the memo to it.
   *
   * Fire-and-forget, like every other write on this path — a failed save costs
   * the ability to reopen this list later, which is not worth turning a landed
   * packing plan into an error screen over.
   */
  const plannedRef = useRef(false);
  useEffect(() => {
    if (!planned || plannedRef.current) return;
    plannedRef.current = true;
    haptics.success();
    void handleSaveToPlan();
  }, [planned, handleSaveToPlan]);

  // ── "Open last list" (K-06 · Failure 3) ─────────────────────────────────
  if (viewingSaved) {
    return (
      <SavedMemoView
        trip={lastPacked.data ?? null}
        loading={lastPacked.isLoading}
        byId={byId}
        onBack={() => setViewingSaved(false)}
      />
    );
  }

  if (closetTooThin) {
    return (
      <View className="px-gutter pt-2">
        <EmptyState
          symbol="tshirt"
          title="Nothing to pack yet"
          body="Your closet is empty, so there is nothing for Cinch to pack. Add a few pieces from the Closet tab and come back to this trip."
        />
      </View>
    );
  }

  if (!withinHorizon && !packAnyway) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-16">
        {membershipUnconfirmed ? (
          <View className="px-gutter pt-2">
            <MembershipUnconfirmedBanner
              onOpenLastList={() => setViewingSaved(true)}
              onRetry={retryMembership}
              retrying={membershipRetrying}
              hasLastList={Boolean(lastPacked.data)}
            />
          </View>
        ) : null}
        <ForecastHorizonFailure
          placeName={trip.destination.name}
          monthName={monthName}
          normalsLine={
            normalsQuery.data
              ? normalsSummaryLine(trip.destination.name, monthName, normalsQuery.data.lowC, normalsQuery.data.highC)
              : null
          }
          normalsLoading={normalsQuery.isLoading}
          onPackAnyway={() => setPackAnyway(true)}
          onSaveAndRevise={onStartAgain}
          saving={false}
        />
      </ScrollView>
    );
  }

  /**
   * The plate that did not come back.
   *
   * Ordered BEFORE `researching`, because `researching` is defined as "not
   * failed and not ready" — putting the failure second would make it
   * unreachable. The answers shown are the ones the user gave, read straight
   * off the trip rather than off a copy.
   */
  if (researchFailed) {
    return (
      <PackingPlateBody
        large={large}
        view={{
          state: 'failed',
          answers: answerRows({
            destination: trip.destination,
            startsOn: trip.startsOn,
            endsOn: trip.endsOn,
            vibeLabels: trip.vibes.map((v) => vibeOf(v).label),
          }),
          onRetry: handleRetryResearch,
          retrying,
          // Exactly today's abandon behaviour: the row `useStartTrip` wrote is
          // left where it is and the flow returns to the questionnaire.
          onSaveAndFinishLater: onStartAgain,
        }}
      />
    );
  }

  if (researching) {
    return (
      <PackingPlateBody
        large={large}
        view={{
          state: 'building',
          destination: trip.destination.name,
          colophon: tripDatesLine(trip.startsOn, trip.endsOn),
          progress,
        }}
      />
    );
  }

  const packingResult = packing!;

  if (packingResult.unfilled > 0 && !acknowledgedShortfall) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-16">
        {membershipUnconfirmed ? (
          <View className="px-gutter pt-2">
            <MembershipUnconfirmedBanner
              onOpenLastList={() => setViewingSaved(true)}
              onRetry={retryMembership}
              retrying={membershipRetrying}
              hasLastList={Boolean(lastPacked.data)}
            />
          </View>
        ) : null}
        <ShortfallFailure
          sentence={shortfallSentence(requestedLooks, packingResult.unfilled, firstUnfilledPart(packingResult.looks))}
          onShow={() => setAcknowledgedShortfall(true)}
        />
      </ScrollView>
    );
  }

  return (
    <PackingMemo
      trip={trip}
      days={days}
      packing={packingResult}
      mark={weatherMark(
        forecasts?.length ? bandOf(forecasts) : null,
        (c) => formatTemp(c, 'F'),
        false,
      )}
      byId={byId}
      resolve={resolve}
      large={large}
      membershipUnconfirmed={membershipUnconfirmed}
      hasLastList={Boolean(lastPacked.data)}
      membershipRetrying={membershipRetrying}
      onOpenLastList={() => setViewingSaved(true)}
      onRetryMembership={retryMembership}
      onSwapDay={handleSwapDay}
      onShare={handleShare}
      shareMounted={shareMounted}
      shareViewRef={shareView}
      onCardReady={handleCardReady}
      tripId={tripId}
    />
  );
}

/**
 * The trip's high and low, across every day the forecast covers.
 *
 * The plate's colophon prints ONE pair for the whole trip, which is what the
 * frames draw — so it is the widest range the trip actually contains rather
 * than the first day's, which would describe an afternoon and label it a week.
 * Null in, null out: no forecast means no mark, never a guessed number.
 */
function bandOf(forecasts: readonly { highC: number; lowC: number }[]): { lowC: number; highC: number } | null {
  if (!forecasts.length) return null;
  return {
    highC: Math.max(...forecasts.map((f) => f.highC)),
    lowC: Math.min(...forecasts.map((f) => f.lowC)),
  };
}

// ---------------------------------------------------------------------------
// The plate, the presentational half — exported so `dev-packing-memo.tsx` and
// `dev-w3-g4-pk-03.tsx` can drive it with fixtures instead of live hooks, the
// same way `dev-share.tsx` feeds fixtures straight to `PlateCard`.
// ---------------------------------------------------------------------------

/**
 * Kept as a type for the fixture routes that still declare one.
 *
 * The prose is no longer drawn on this screen — the plate shows the pieces
 * instead — but `buildSavedMemo` still writes it into the trip row and the
 * share card still sets the headline, so the shape has not gone anywhere.
 *
 * @deprecated The plate does not read a brief. Nothing needs to pass one.
 */
export type PackingMemoBriefState = {
  isPending: boolean;
  data: { observation: string } | null;
};

/**
 * "Trip planned", drawn.
 *
 * This is the frames' completion plate, and its whole content is the trip's
 * days with that day's pieces under each. What it does NOT draw, and where
 * those things went:
 *
 *   · The prose paragraph — gone from the screen, still written to the row.
 *   · The bag grid with its repeat chips — the pieces are on the days now, and
 *     a second grid of the same garments was the app abstracting one suitcase
 *     twice. `bagHeaderLine` and `bagProseLine` are untouched in
 *     `packing-memo.ts`, which is why the memo tests still pass unmodified.
 *   · "Save to Plan" — the save happens with the "Trip planned" claim, so a
 *     button asking the user to make a statement the screen already made would
 *     be a control with nothing left to do. See the effect in `PackingTrip`.
 *
 * "Swap a day" and "Share" survive as the quiet links the foot has always had
 * room for: the frames give the foot two filled controls and the accent budget
 * is spent by those two.
 */
export function PackingMemo({
  trip,
  days,
  packing,
  mark,
  byId,
  resolve,
  large = false,
  membershipUnconfirmed,
  hasLastList,
  membershipRetrying,
  onOpenLastList,
  onRetryMembership,
  onSwapDay,
  onShare,
  shareMounted,
  shareViewRef,
  onCardReady,
  tripId,
}: {
  trip: Trip;
  days: number;
  packing: PackingResult;
  /** `24°/15°`, or null when no forecast reached the trip. Never a guess. */
  mark: string | null;
  byId: Map<string, Item>;
  resolve: (...paths: (string | null | undefined)[]) => string | undefined;
  large?: boolean;
  membershipUnconfirmed: boolean;
  hasLastList: boolean;
  membershipRetrying: boolean;
  onOpenLastList: () => void;
  onRetryMembership: () => void;
  onSwapDay: () => void;
  onShare: () => void;
  shareMounted: boolean;
  shareViewRef: RefObject<View | null>;
  onCardReady: () => void;
  /**
   * The row this plate was saved onto, or null when the write never landed.
   *
   * Passed in rather than read here: the id is owned by `PackingTrip`'s own
   * save effect, and a second source for it is how the plate and the save
   * eventually disagree about which trip is on screen.
   */
  tripId: string | null;
}) {
  const router = useRouter();
  const groups = groupLooksByDay(packing.looks);
  const filledLooks = packing.looks.filter((l) => l.outfit).length;

  /**
   * One day's pieces, de-duplicated across its looks.
   *
   * A day dressed for two parts wears the same trousers twice as often as not,
   * and three wells showing one garment twice is a grid that misreports the
   * day. First appearance wins, which keeps the engine's own ordering.
   */
  const plateDays: PlateDay[] = groups.map((group) => {
    const seen = new Set<string>();
    const tiles: { uri?: string }[] = [];
    for (const look of group.looks) {
      for (const garment of look.outfit?.items ?? []) {
        if (tiles.length >= PLATE_TILES || seen.has(garment.id)) continue;
        seen.add(garment.id);
        const item = byId.get(garment.id);
        tiles.push({
          uri: item
            ? resolve(item.platePath, item.cutoutPath, item.thumbPath)
            : resolve(garment.platePath, garment.cutoutPath, garment.thumbPath),
        });
      }
    }

    const weather = group.looks.find((l) => l.weather)?.weather ?? null;
    const caption = [dayTempLabel(weather), dayCaption(group.dayIndex, days, weather)]
      .filter(Boolean)
      .join(' · ');

    return {
      key: String(group.dayIndex),
      label: plateDayLabel(group.date, group.dayIndex, days),
      caption: caption || null,
      tiles,
    };
  });

  return (
    <View className="flex-1">
      {/* The fail-open membership banner keeps its place above the plate. It is
          never a gate — a member who cannot be VERIFIED is treated as one, and
          the server checks independently — so it adds a line and changes
          nothing else about this screen. */}
      {membershipUnconfirmed ? (
        <View className="px-gutter pt-2">
          <MembershipUnconfirmedBanner
            onOpenLastList={onOpenLastList}
            onRetry={onRetryMembership}
            retrying={membershipRetrying}
            hasLastList={hasLastList}
          />
        </View>
      ) : null}

      <PackingPlateBody
        large={large}
        view={{
          state: 'planned',
          destination: trip.destination.name,
          colophon: plannedColophon(trip.startsOn, trip.endsOn, mark),
          days: plateDays,
          /**
           * "See this trip" lands on THIS trip — redesign 06.
           *
           * It used to land on the shelf, because `trips/[id]` did not resolve
           * and a dead primary is worse than an indirect one; that was listed as
           * redesign 05's deviation #4. The page exists now, so the primary goes
           * where its label always claimed.
           *
           * The fallback survives on purpose. `tripId` is null when the row was
           * never written — `useStartTrip` swallows its own failure so a packing
           * run is never blocked by a write — and a plate the user is looking at
           * is real whether or not Postgres heard about it. In that case there is
           * no page to open, and the shelf is the honest destination.
           */
          onSeeThisTrip: () =>
            tripId
              ? router.push({
                  pathname: '/trips/[id]',
                  params: { id: tripId, destination: trip.destination.name },
                })
              : router.push('/trips'),
          onAllTrips: () => router.push('/trips'),
          onSwapDay,
          onShare,
        }}
      />

      {shareMounted ? (
        <View
          ref={shareViewRef}
          collapsable={false}
          style={{ position: 'absolute', left: -9999, top: 0, width: CARD_W, height: CARD_H }}>
          <PackingMemoCard
            trip={trip}
            headline={memoHeadline(packing.items.length, filledLooks)}
            items={packing.items}
            onReady={onCardReady}
          />
        </View>
      ) : null}
    </View>
  );
}


// ---------------------------------------------------------------------------
// K-06 · Failure 3's "Open last list" — a read-only recovery view. Text
// only, deliberately simpler than the live memo: this exists so a member who
// can't be verified still has SOMETHING real to look at, not a second full
// editorial surface to keep in sync with the live one.
// ---------------------------------------------------------------------------

function SavedMemoView({
  trip,
  loading,
  byId,
  onBack,
}: {
  trip: SavedTrip | null;
  loading: boolean;
  byId: Map<string, Item>;
  onBack: () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-gutter pb-16 pt-2">
      <Pressable onPress={onBack} accessibilityRole="button" className="mb-4 self-start active:opacity-60">
        <Text variant="label" className="underline">
          Back
        </Text>
      </Pressable>

      {loading ? (
        <TextSkeleton lines={4} />
      ) : !trip || !trip.memo ? (
        <EmptyState
          symbol="archivebox"
          title="No saved list yet"
          body="Nothing has been saved to Plan yet, so there is no last list to reopen."
        />
      ) : (
        (() => {
          const memo = trip.memo as unknown as SavedMemo;
          return (
            <>
              <Text variant="eyebrow">{trip.destination.name}</Text>
              <View className="mt-2">
                <Text variant="title" trim>
                  {memo.headline}
                </Text>
              </View>
              {memo.prose ? (
                <Text variant="body" className="mt-4 text-muted">
                  {memo.prose}
                </Text>
              ) : null}

              <View className="mt-8">
                <SectionHeader title="The bag" />
                <View className="mt-2">
                  {memo.bag.map((piece) => {
                    const item = byId.get(piece.itemId);
                    const label = item ? `${item.colors[0]?.name ?? ''} ${item.subcategory ?? item.category}`.trim() : 'A packed piece';
                    return (
                      <View key={piece.itemId} className="flex-row items-center justify-between py-2">
                        <Text variant="body">{label}</Text>
                        <Text variant="label">{repeatLabel(piece.looks, piece.worn)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {memo.days.map((day) => (
                <View key={day.dayIndex} className="mt-8">
                  <SectionHeader
                    title={fromIsoDate(day.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' })}
                    trailing={
                      <Text variant="label">
                        {[day.tempC != null ? `${Math.round(day.tempC)}°` : null, day.travelDay ? 'travel day' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    }
                  />
                  <View className="mt-2">
                    {day.rows.map((row) => (
                      <View key={row.part} className="flex-row gap-3 py-1.5">
                        <View style={{ width: 56 }}>
                          <Text variant="label">{dayPartOf(row.part).title.toUpperCase()}</Text>
                        </View>
                        <Text variant="body" className="flex-1">
                          {row.itemIds
                            .map((id) => {
                              const item = byId.get(id);
                              return item ? item.subcategory ?? item.category : null;
                            })
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </>
          );
        })()
      )}
    </ScrollView>
  );
}
