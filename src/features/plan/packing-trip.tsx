import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { PlateThumb } from '@/components/closet/plate-thumb';
import { PackingMemoCard } from '@/components/share/packing-memo-card';
import { Button, Card, EmptyState, Notice, Rule, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import {
  fetchForecastRange,
  fetchSeasonalNormals,
  hasForecastFor,
} from '@/features/context/weather';
import { CARD_H, CARD_W, sharePlate } from '@/features/share/capture-plate';
import { usePlan } from '@/features/billing/use-plan';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { oklchToHex } from '@/lib/color';
import { DEFAULT_WEIGHTS } from '@/lib/styling';
import type { Item } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';
import type { Json } from '@/types/database';

import { buildPackingList, swapDay, type PackedLook, type PackedPiece, type PackingResult } from './packing';
import { lookSchedule, repeatLabel } from './packing-math';
import {
  bagHeaderLine,
  buildSavedMemo,
  buildingLooksDetail,
  buildingLooksTitle,
  closetSummaryLine,
  closetWeatherFit,
  dayCaption,
  dayTempLabel,
  firstUnfilledPart,
  forecastSummaryLine,
  garmentLabel,
  groupLooksByDay,
  lookGarmentNames,
  memoHeadline,
  normalsSummaryLine,
  shortfallSentence,
  type SavedMemo,
} from './packing-memo';
import {
  dayPartOf,
  formalityForPart,
  fromIsoDate,
  tripColophon,
  tripDays,
  type DayPartKey,
  type Trip,
} from './trip';
import { usePackingBrief, type PackingBriefError } from './use-packing-brief';
import { useLastPackedTrip, useSaveTrip, useStartTrip, type SavedTrip } from './use-trips';

/**
 * K-04 (researching), K-05 (the memo) and K-06 (the four failures) — one
 * trip, read start to finish.
 *
 * REPLACES THE PREVIOUS THREE-LAYER SCREEN (brief · capsule · browsable
 * closet grid) wholesale. That design predates this wave's atlas; the new
 * one has no closet grid at all — the memo is prose, then the bag, then the
 * days, "not a checklist app", and everything on it is either the model's one
 * paragraph or the deterministic capsule `buildPackingList` already computed
 * on device. Browsing the whole closet mid-trip is the Closet tab's job.
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
          <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
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
        <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
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
    <View className="mb-6 rounded-md border border-rule px-4 py-3 dark:border-rule-dark">
      <Text variant="eyebrow">Membership can’t be confirmed</Text>
      <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
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
// K-06 · Failure 4 (and the brief's other real failures) — the prose slot
// ---------------------------------------------------------------------------

const MEMO_FAILURES: Record<PackingBriefError['kind'], { title: string; body: string }> = {
  offline: {
    title: 'This one took too long.',
    body: 'Your answers are saved — nothing to type again.',
  },
  consent: {
    title: 'Cinch needs your go-ahead first.',
    body: 'AI processing is switched off for your account. Turn it on in Profile and the memo will write itself. The bag and the days below are unaffected.',
  },
  quota: {
    title: 'This month’s styling allowance is spent.',
    body: 'Writing the memo draws on the same allowance as the stylist. The bag and the days below don’t use it at all.',
  },
  unavailable: {
    title: 'The memo isn’t live yet.',
    body: 'This part of packing hasn’t been switched on for your build. The bag and the days below are read from your closet, not from a server.',
  },
};

export function MemoProseFailure({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  const kind = (error as PackingBriefError | null)?.kind ?? 'offline';
  const copy = MEMO_FAILURES[kind] ?? MEMO_FAILURES.offline;

  return (
    <View accessibilityRole="alert">
      <Text variant="title" trim>
        {copy.title}
      </Text>
      <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
        {copy.body}
      </Text>
      <Button
        title="Try again"
        variant="secondary"
        onPress={onRetry}
        loading={retrying}
        haptic
        className="mt-4 self-start px-6"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// K-04 — researching the destination
// ---------------------------------------------------------------------------

export type ResearchStep = { key: string; title: string; detail: string | null; done: boolean };

function ResearchLine({ step, isLast }: { step: ResearchStep; isLast: boolean }) {
  const theme = useTheme();
  return (
    <View className={isLast ? '' : 'mb-5'}>
      <View className="flex-row items-center gap-3">
        <View
          className="items-center justify-center rounded-full border"
          style={{
            width: 22,
            height: 22,
            borderColor: step.done ? theme.ink : theme.rule,
            backgroundColor: step.done ? theme.ink : 'transparent',
          }}>
          {step.done ? <Text style={{ color: theme.canvas, fontSize: 12 }}>✓</Text> : null}
        </View>
        <Text variant="body" style={{ color: step.done ? theme.ink : theme.muted }}>
          {step.title}
        </Text>
      </View>
      {step.done && step.detail ? (
        <Text variant="label" className="ml-[34px] mt-1.5">
          {step.detail}
        </Text>
      ) : null}
    </View>
  );
}

export function ResearchSteps({
  steps,
  colophon,
  days,
}: {
  steps: ResearchStep[];
  colophon: string;
  days: number;
}) {
  return (
    <View className="px-gutter pt-2">
      <Text variant="eyebrow">{colophon}</Text>
      <View className="mt-3 mb-8">
        <Text variant="title" trim>
          {`Packing ${days} ${days === 1 ? 'day' : 'days'}.`}
        </Text>
      </View>
      {steps.map((step, i) => (
        <ResearchLine key={step.key} step={step} isLast={i === steps.length - 1} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// K-05 — the bag and the days
// ---------------------------------------------------------------------------

export function BagRow({ item, uri, piece }: { item: Item | undefined; uri?: string; piece: PackedPiece }) {
  const label = garmentLabel(piece.garment);
  const swatch = piece.garment.colors[0];
  return (
    <View className="flex-row items-center gap-3 py-2">
      {item ? (
        <PlateThumb item={item} uri={uri} size={44} radius={8} showFallbackLabel={false} />
      ) : (
        <View
          className="rounded"
          style={{ width: 44, height: 44, backgroundColor: swatch ? oklchToHex(swatch.oklch) : '#EAE4D6' }}
        />
      )}
      <View className="flex-1">
        <Text variant="body">{label}</Text>
      </View>
      <Text variant="label">{repeatLabel(piece.looks, piece.worn)}</Text>
    </View>
  );
}

export function DayLookRow({ part, look }: { part: DayPartKey; look: PackedLook }) {
  const names = lookGarmentNames(look);
  return (
    <View className="flex-row gap-3 py-1.5">
      <View style={{ width: 56 }}>
        <Text variant="label">{dayPartOf(part).title.toUpperCase()}</Text>
      </View>
      <View className="flex-1">
        <Text variant="body">{names || 'Nothing found for this look.'}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export function PackingTrip({ trip, onStartAgain }: { trip: Trip; onStartAgain: () => void }) {
  const qc = useQueryClient();

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

  const brief = usePackingBrief({
    trip,
    wardrobe,
    styleSummary: profileQuery.data?.summary ?? [],
    forecasts,
    packed: packing?.items,
  });

  // ── K-04's four lines ──────────────────────────────────────────────────
  const requestedLooks = lookSchedule(trip.startsOn, days, trip.parts).length;
  const fit = useMemo(() => closetWeatherFit(wardrobe, forecasts ?? []), [wardrobe, forecasts]);

  const forecastStepDone = forecastsReady;
  const closetStepDone = !wardrobeQuery.isLoading && wardrobeQuery.isSuccess && forecastsReady;
  const looksStepDone = Boolean(packing);
  const memoStepDone = brief.isSuccess || brief.isError;

  const steps: ResearchStep[] = [
    {
      key: 'forecast',
      title: withinHorizon ? 'Forecast pulled' : 'Typical weather pulled',
      detail: forecastStepDone
        ? withinHorizon
          ? forecasts?.length
            ? forecastSummaryLine(forecasts)
            : null
          : normalsQuery.data
            ? normalsSummaryLine(trip.destination.name, monthName, normalsQuery.data.lowC, normalsQuery.data.highC)
            : null
        : null,
      done: forecastStepDone,
    },
    {
      key: 'closet',
      title: 'Closet read',
      detail: closetStepDone ? closetSummaryLine(fit) : null,
      done: closetStepDone,
    },
    {
      key: 'looks',
      title: buildingLooksTitle(requestedLooks),
      detail: looksStepDone && packing ? buildingLooksDetail(packing.items) : null,
      done: looksStepDone,
    },
    {
      key: 'memo',
      title: 'Writing the memo',
      detail: brief.data ? brief.data.gaps ?? brief.data.observation : null,
      done: memoStepDone,
    },
  ];

  const researching = !packing || !memoStepDone;

  // ── K-05's actions ────────────────────────────────────────────────────
  const saveTrip = useSaveTrip();
  const [savedNotice, setSavedNotice] = useState(false);

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
    setSavedNotice(true);
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

  if (researching) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-16">
        {membershipUnconfirmed ? (
          <View className="px-gutter">
            <MembershipUnconfirmedBanner
              onOpenLastList={() => setViewingSaved(true)}
              onRetry={retryMembership}
              retrying={membershipRetrying}
              hasLastList={Boolean(lastPacked.data)}
            />
          </View>
        ) : null}
        <ResearchSteps steps={steps} colophon={tripColophon(trip)} days={days} />
      </ScrollView>
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
      brief={brief}
      byId={byId}
      resolve={resolve}
      membershipUnconfirmed={membershipUnconfirmed}
      hasLastList={Boolean(lastPacked.data)}
      membershipRetrying={membershipRetrying}
      onOpenLastList={() => setViewingSaved(true)}
      onRetryMembership={retryMembership}
      savedNotice={savedNotice}
      onSaveToPlan={() => void handleSaveToPlan()}
      savingToPlan={saveTrip.isPending || startTrip.isPending}
      onSwapDay={handleSwapDay}
      onShare={handleShare}
      shareMounted={shareMounted}
      shareViewRef={shareView}
      onCardReady={handleCardReady}
    />
  );
}

// ---------------------------------------------------------------------------
// K-05, the presentational half — exported so `dev-packing-memo.tsx` can
// drive it with fixtures instead of live hooks, the same way `dev-share.tsx`
// feeds fixtures straight to `PlateCard`.
// ---------------------------------------------------------------------------

export type PackingMemoBriefState = {
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  data: { observation: string } | undefined;
  error: unknown;
  refetch: () => void;
};

export function PackingMemo({
  trip,
  days,
  packing,
  brief,
  byId,
  resolve,
  membershipUnconfirmed,
  hasLastList,
  membershipRetrying,
  onOpenLastList,
  onRetryMembership,
  savedNotice,
  onSaveToPlan,
  savingToPlan,
  onSwapDay,
  onShare,
  shareMounted,
  shareViewRef,
  onCardReady,
}: {
  trip: Trip;
  days: number;
  packing: PackingResult;
  brief: PackingMemoBriefState;
  byId: Map<string, Item>;
  resolve: (...paths: (string | null | undefined)[]) => string | undefined;
  membershipUnconfirmed: boolean;
  hasLastList: boolean;
  membershipRetrying: boolean;
  onOpenLastList: () => void;
  onRetryMembership: () => void;
  savedNotice: boolean;
  onSaveToPlan: () => void;
  savingToPlan: boolean;
  onSwapDay: () => void;
  onShare: () => void;
  shareMounted: boolean;
  shareViewRef: RefObject<View | null>;
  onCardReady: () => void;
}) {
  const groups = groupLooksByDay(packing.looks);
  const filledLooks = packing.looks.filter((l) => l.outfit).length;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-gutter pb-16 pt-2">
      {membershipUnconfirmed ? (
        <MembershipUnconfirmedBanner
          onOpenLastList={onOpenLastList}
          onRetry={onRetryMembership}
          retrying={membershipRetrying}
          hasLastList={hasLastList}
        />
      ) : null}

      <Text variant="eyebrow">{tripColophon(trip)}</Text>

      <View className="mt-2">
        <Text variant="title" trim>
          {memoHeadline(packing.items.length, filledLooks)}
        </Text>
      </View>

      {/* Prose first. */}
      <View className="mt-4">
        {brief.isPending ? (
          <TextSkeleton lines={2} />
        ) : brief.isError ? (
          <MemoProseFailure error={brief.error} onRetry={brief.refetch} retrying={brief.isRefetching} />
        ) : brief.data ? (
          <Text variant="body" className="text-muted dark:text-muted-dark">
            {brief.data.observation}
          </Text>
        ) : null}
      </View>

      {/* Then the bag. */}
      <View className="mt-8">
        <SectionHeader title="The bag" />
        <Text variant="label" className="mt-1">
          {bagHeaderLine(packing.items)}
        </Text>
        <View className="mt-2">
          {packing.items.map((piece) => (
            <BagRow
              key={piece.garment.id}
              piece={piece}
              item={byId.get(piece.garment.id)}
              uri={resolve(piece.garment.platePath, piece.garment.cutoutPath)}
            />
          ))}
        </View>
      </View>

      {/* Then the days. */}
      {groups.map((group) => {
        const weather = group.looks.find((l) => l.weather)?.weather ?? null;
        const dateLabel = fromIsoDate(group.date).toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
        });
        const caption = dayCaption(group.dayIndex, days, weather);
        const temp = dayTempLabel(weather);
        const trailing = [temp, caption].filter(Boolean).join(' · ');

        return (
          <View key={group.dayIndex} className="mt-8">
            <SectionHeader
              title={dateLabel}
              trailing={trailing ? <Text variant="label">{trailing}</Text> : undefined}
            />
            <View className="mt-2">
              {group.looks.map((look) => (
                <DayLookRow key={`${group.dayIndex}-${look.part}`} part={look.part} look={look} />
              ))}
            </View>
          </View>
        );
      })}

      <View className="mt-8">
        <Rule />
      </View>

      {savedNotice ? (
        <View className="mt-4">
          <Notice message="Saved to Plan." />
        </View>
      ) : null}

      <View className="mt-4 flex-row gap-3">
        <Button title="Swap a day" variant="secondary" onPress={onSwapDay} haptic className="flex-1" />
        <Button title="Save to Plan" onPress={onSaveToPlan} loading={savingToPlan} haptic className="flex-1" />
      </View>

      <Pressable onPress={onShare} accessibilityRole="button" className="mt-6 self-center active:opacity-60">
        <Text variant="label" className="underline">
          Share
        </Text>
      </Pressable>

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
    </ScrollView>
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
                <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
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
