import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/events/EventCard';
import { PlanMonthSheet } from '@/components/plan/plan-month-sheet';
import {
  PlanWeekBody,
  type PlanWeekDayView,
  type PlanWeekPlate,
  type PlanWeekView,
} from '@/components/plan/plan-week-body';
import { ExampleEvents, ExampleWeek } from '@/components/plan/plan-examples';
import { Button, ErrorState, SectionHeader, Skeleton, SkeletonLead } from '@/components/ui';
import { useToast } from '@/components/ui/toast-host';
import { Text } from '@/components/ui/text';
import { Placement } from '@/features/billing/placements';
import { PLANS } from '@/features/billing/plans';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { FORECAST_HORIZON_DAYS, fetchForecast } from '@/features/context/weather';
import { useEventInvites, useMyEvents } from '@/features/events/queries';
import { numberWord } from '@/features/onboarding/reveal-copy';
import { usePlanOutfit, usePlannedWeek } from '@/features/plan/mutations';
import { PackingTab } from '@/features/plan/packing-tab';
import { planWeek } from '@/features/plan/packing';
import {
  PLAN_WEEK_STACK_SCALE,
  WEEK_COPY,
  WEEK_LENGTH,
  addDays,
  dayAnchor,
  occasionLine,
  primaryAction,
  startOfWeek,
} from '@/features/plan/plan-week-spec';
import type { Trip } from '@/features/plan/trip';
import { STALL_DEADLINE_MS, useStalled } from '@/features/plan/use-stalled';
import { weekSubtitle } from '@/features/plan/week-lines';
import { useWearOutfit } from '@/features/styling/mutations';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { dateKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import {
  DEFAULT_WEIGHTS,
  EMPTY_AFFINITIES,
  type Garment,
  type OutfitCandidate,
} from '@/lib/styling';
import { concentric, MIN_TAP_TARGET, motion, spring, useTheme } from '@/theme/tokens';

const WEEK_DAYS = WEEK_LENGTH;

/**
 * The strip's window: the week before, the week shown, the week after.
 *
 * Twenty-one days in ONE set of queries rather than three. `usePlannedWeek`
 * already takes a start date and a length, so widening the range is a
 * parameter change and nothing on the server moves; the reward is that a swipe
 * lands on chips that already carry their thumbnails and their dots.
 */
const WINDOW_DAYS = WEEK_LENGTH * 3;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

type Mode = 'week' | 'events' | 'packing';
const MODES: Mode[] = ['week', 'events', 'packing'];

// The week's own row-by-row skeleton is GONE with the seven-card list it stood
// in for. Redesign 01 puts the wait inside the plate — `PlanWeekBody` draws it
// — because the strip above the plate is live and swipeable from the first
// frame, and a skeleton over the whole week would hide a control that works.

/**
 * Card-shaped skeletons for the events feed — the shape of `EventCard`
 * (bordered plate, a serif title's bar, a metadata bar), three deep, with the
 * header actions staying live above them.
 */
function EventListSkeleton() {
  return (
    <View accessibilityLabel="Reading your plans">
      <SkeletonLead label="Reading your plans…" />
      {(['62%', '48%', '70%'] as const).map((titleWidth, i) => (
        <View
          key={i}
          className="mx-gutter mb-3 rounded-plate border border-rule p-4">
          <Skeleton className="h-[18px] rounded-sm" style={{ width: titleWidth }} />
          <Skeleton
            className="mt-2.5 h-3 rounded-sm"
            style={{ width: (['80%', '70%', '64%'] as const)[i] }}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * One segment of the pill toggle: sand track, cream label on ink for the
 * active one. The ink itself is drawn once, by the sliding pill in
 * `SegmentedControl` — this only ever renders its label and the dot. The dot
 * is the app's entire notion of a badge — a single quiet mark when
 * invitations wait, never a number in a red circle.
 */
function Segment({
  label,
  active,
  onPress,
  showDot,
  onLayout,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  showDot?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={showDot ? `${label}, new invitations` : label}
      style={{ minHeight: MIN_TAP_TARGET - 8 }}
      // The box is drawn 8 short so the pill sits inside its track; the
      // hitSlop pays the difference back, keeping the 44pt floor.
      hitSlop={{ top: 4, bottom: 4 }}
      className="flex-1 flex-row items-center justify-center active:opacity-70">
      <Text variant="label" style={{ color: active ? theme.canvas : theme.muted }}>
        {label}
      </Text>
      {/* Oxblood on the sand track; warm clay once the ink pill is under it —
          the accent reads as a hole punched in ink, and the atlas swaps it
          for `accentWarm` the moment the segment is active. */}
      {showDot ? (
        <View
          className={`ml-1.5 h-1.5 w-1.5 rounded-full ${active ? 'bg-accent-warm' : 'bg-accent'}`}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * The Week/Events/Packing toggle. One absolutely-positioned ink pill slides
 * under the labels rather than each segment painting its own fill — the
 * geometry iOS users read as `UISegmentedControl` every day. The pill's
 * radius is `concentric(12, 4)`, not a second `rounded-md`: the track is 12,
 * inset 4 on every side, so the pill reads as one continuous corner system
 * with its container instead of "also rounded" (tokens.ts's concentric rule).
 *
 * Each segment reports its own box on mount via `onLayout` rather than the
 * pill computing thirds from the track width — this stays correct even if a
 * fourth mode or unequal segments ever show up. `spring.snappy` already
 * carries `reduceMotion: ReduceMotion.System` (tokens.ts), so the slide
 * settles instantly with Reduce Motion on; no separate gate needed here.
 */
function SegmentedControl({
  mode,
  onChange,
  inviteCount,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  inviteCount: number;
}) {
  const theme = useTheme();
  const [boxes, setBoxes] = useState<Partial<Record<Mode, { x: number; width: number }>>>({});
  const measured = useRef<Mode | null>(null);

  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);

  useEffect(() => {
    const box = boxes[mode];
    if (!box) return;
    if (measured.current === null) {
      // First layout: place the pill instantly — there is nothing to slide
      // from yet, and animating in from a corner would read as a bug.
      pillX.value = box.x;
      pillWidth.value = box.width;
    } else {
      pillX.value = withSpring(box.x, spring.snappy);
      pillWidth.value = withSpring(box.width, spring.snappy);
    }
    measured.current = mode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, boxes[mode]?.x, boxes[mode]?.width]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
  }));

  const select = (m: Mode) => {
    // Through the policy, not past it — `lib/haptics` owns which taptic call
    // expresses "a selection changed" (UX-07).
    if (m !== mode) haptics.selection();
    onChange(m);
  };

  return (
    <View className="mx-gutter mb-4 flex-row rounded-md bg-sand p-1">
      {/* NativeWind className does not reach Animated.* components (the
          babel/css-interop transform only registers plain RN primitives) —
          every property that would have been `absolute bottom-0 top-0
 bg-ink` has to be inline style instead, same as the wrapper pattern
          in upload-queue-list.tsx. */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, bottom: 0, backgroundColor: theme.ink },
          { borderRadius: concentric(12, 4) },
          pillStyle,
        ]}
      />
      {MODES.map((m) => (
        <Segment
          key={m}
          label={m === 'week' ? 'Week' : m === 'events' ? 'Events' : 'Packing'}
          active={mode === m}
          onPress={() => select(m)}
          showDot={m === 'events' && inviteCount > 0}
          onLayout={(e) => {
            const { x, width } = e.nativeEvent.layout;
            setBoxes((prev) => ({ ...prev, [m]: { x, width } }));
          }}
        />
      ))}
    </View>
  );
}

/**
 * Plan — the week ahead, the occasions on it, and packing for a trip.
 *
 * Three modes behind one segmented control. Week and Packing pull the styling
 * engine in opposite directions (variety vs. the smallest bag that closes);
 * Events is the social calendar — occasions live INSIDE Plan, not behind a
 * fourth tab, per the founder's mock.
 *
 * PACKING IS A WHOLE SLICE OF ITS OWN and lives in `features/plan/packing-tab`:
 * it is membership-gated, it opens on a questionnaire rather than on this
 * screen's shared closet gate, and it renders the closet itself underneath its
 * results — none of which composes with the scroll view the other two modes
 * share. This file now hands it the mode flag and gets out of the way.
 */
export default function PlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('week');
  /** The answered packing questionnaire — see the Packing branch below. */
  const [trip, setTrip] = useState<Trip | null>(null);
  /**
   * PL-03's per-day `planningKey` / `failedKey` pair is GONE with the seven-row
   * accordion it belonged to.
   *
   * That state existed so a NoticeBand could name the one day that refused
   * while six others sat saved above it. Redesign 01 shows one day at a time,
   * so "which day failed" is never in question — it is the day on screen — and
   * the frames draw no band under the actions to put the sentence in. The
   * failure goes to the toast instead, which is UX-08's answer for a write that
   * has no inline surface, and it still says what did not happen rather than
   * only that something did.
   */
  const toast = useToast();
  /**
   * Redesign 01: which week the strip is showing, and which day is selected.
   *
   * Two pieces of state, both plain Dates at the spec's local-noon anchor. The
   * week is what the swipe moves; the day is what the plate is about. They are
   * separate because selecting Friday must not scroll the strip, and swiping to
   * next week must not silently re-point the plate at a day the reader never
   * touched — moving the week carries the SELECTION with it by weekday, which
   * is the behaviour the frames imply and the one that keeps the plate stable.
   */
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState(() => dayAnchor(new Date()));
  const [monthOpen, setMonthOpen] = useState(false);
  /**
   * PL-02's "Try another": the garments a day has been asked to stop offering.
   *
   * Fed into the planner's own `alreadyPlanned` exclusion, which is a WEEK-wide
   * set — `planWeek` searches the days in order and each one avoids what the
   * ones before it took, so there is no way to re-dress Friday alone without
   * re-running the week. That is a real consequence and it is the honest one:
   * the alternative would be a second search path that could disagree with the
   * first.
   */
  const [refused, setRefused] = useState<string[]>([]);

  const wardrobe = useWardrobe();
  const profileQuery = useStyleProfile();
  const { context, coords } = useStyleContext();

  // Memoised: a bare `?? []` is a new array identity every render, which
  // re-plans the whole week on any unrelated state change.
  const items = useMemo(() => wardrobe.data ?? [], [wardrobe.data]);
  const profile = profileQuery.data ?? {
    weights: DEFAULT_WEIGHTS,
    affinities: EMPTY_AFFINITIES,
    feedbackCount: 0,
    summary: [],
  };

  // --- Occasions ----------------------------------------------------------
  const myEvents = useMyEvents();
  const invites = useEventInvites();
  const inviteCount = invites.data?.length ?? 0;

  // The hosting ceiling, said BEFORE the database says it.
  //
  // Free hosts two at once (`event_limit_for_plan()`), and until now the only
  // place that fact appeared was as a refused insert on event/new.tsx — the
  // user met the boundary as a failed form. The screen that lists the very
  // occasions being counted can say it quietly instead.
  //
  // `knownPlan` rather than `plan.plan`, for the reason index.tsx spells out:
  // `usePlan` answers `free` both when the tier is unread and when it is
  // unreadable, which is the right default for a GATE (refuse nothing on an
  // outage) and the wrong one for a SENTENCE — a Standard host with two
  // occasions would otherwise be told a ceiling that is not theirs.
  const gate = useGate();
  const planState = usePlan();
  const knownPlan = planState.loading || planState.unconfirmed ? null : planState.plan;
  const hostedCount = (myEvents.data ?? []).filter((e) => e.isHost).length;
  const atHostingCeiling = knownPlan === 'free' && hostedCount >= PLANS.free.eventHosting;

  // --- Week ---------------------------------------------------------------

  /**
   * Today, read ONCE per mount and held as a number.
   *
   * A `Date` recomputed every render is a new identity every render, so every
   * memo keyed on it recomputes too — and the React Compiler refuses to
   * preserve a memo whose dependency is a mutable object. The millisecond is
   * the stable half; the Date is derived from it.
   */
  const todayMs = useMemo(() => dayAnchor(new Date()).getTime(), []);
  const today = useMemo(() => new Date(todayMs), [todayMs]);
  const windowStart = addDays(weekStart, -WEEK_LENGTH);
  const windowStartMs = windowStart.getTime();

  /**
   * The forecast, fetched ONCE for the whole horizon rather than per week.
   *
   * Open-Meteo forecasts sixteen days ahead and nothing behind. Re-asking it
   * for each week the reader swipes to would be a request per swipe that
   * returns the same sixteen days every time, so the query is keyed on the
   * COORDINATES alone and the strip indexes into it by distance from today.
   * Days outside the horizon — every past week, and anything past the
   * sixteenth day — carry no weather at all rather than an estimate.
   */
  const weekForecast = useQuery({
    queryKey: [
      'forecast',
      coords.latitude.toFixed(2),
      coords.longitude.toFixed(2),
      FORECAST_HORIZON_DAYS,
    ],
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchForecast(coords.latitude, coords.longitude, FORECAST_HORIZON_DAYS, signal),
  });

  /** The forecast for a day, or null wherever the horizon does not reach. */
  const weatherFor = (date: Date) => {
    const offset = Math.round((dayAnchor(date).getTime() - todayMs) / 86_400_000);
    return offset >= 0 ? (weekForecast.data?.[offset] ?? null) : null;
  };

  // Twenty-one days, one query. See WINDOW_DAYS.
  const planned = usePlannedWeek(windowStart, WINDOW_DAYS);
  const planOutfit = usePlanOutfit();
  const wearOutfit = useWearOutfit();

  // "7–13 August · 68–84°" — real dates and the forecast's real spread. The
  // city the atlas prints is absent on purpose; see `weekSubtitle`. The Week
  // mode no longer draws it (the month label took that corner of the masthead),
  // but Events and Packing still do.
  const weekRangeLabel = weekSubtitle(startOfToday(), WEEK_DAYS, weekForecast.data ?? []);

  // Anything already committed to a day in the window is out of the running for
  // the others. Without this the planner happily suggests Tuesday's jacket again
  // on Thursday, having no idea Tuesday was ever decided.
  const alreadyPlanned = useMemo(
    () => new Set([...Object.values(planned.data ?? {}).flat(), ...refused]),
    [planned.data, refused],
  );

  /** Every garment by id, so a committed plan's item ids can find their photos. */
  const garmentsById = useMemo(() => {
    const map = new Map<string, Garment>();
    for (const g of items) map.set(g.id, g);
    return map;
  }, [items]);

  /**
   * The Cinch occasion on a given day.
   *
   * CINCH'S OWN occasions, already read on this screen for the Events mode.
   * NOT the device calendar: `loadTodaysEvents` reads EventKit for TODAY only,
   * so a device-calendar title for Friday is not a fact this app holds, and
   * drawing one would be an invented row.
   *
   * `useMyEvents` answers with UPCOMING occasions only — its own query filters
   * to today and later — so a week swiped into the past carries no dots. That
   * is a limit of the existing query, not a claim that nothing happened; adding
   * a backward range would change a server contract this work is not allowed to
   * touch.
   */
  const eventOn = (date: Date) => {
    const key = dateKey(date);
    return (myEvents.data ?? []).find((e) => e.startsAt && dateKey(e.startsAt) === key) ?? null;
  };

  /**
   * The engine's proposals for the shown week.
   *
   * `planWeek` walks its `forecasts` array from `startDate` forward, so it can
   * only be handed a CONTIGUOUS run that begins where the forecast does. A week
   * that starts before today therefore begins its run at today, and the days
   * behind it get no proposal — which is correct: the engine cannot dress a day
   * that has already been lived, and the plate falls back to whatever was
   * actually committed to it.
   */
  const weekStartMs = weekStart.getTime();

  const proposals = useMemo(() => {
    const from = weekStartMs < todayMs ? new Date(todayMs) : new Date(weekStartMs);
    const lead = Math.round((from.getTime() - weekStartMs) / 86_400_000);
    if (lead >= WEEK_LENGTH || !canGenerate(items)) return new Map<string, OutfitCandidate>();

    const offset = Math.round((from.getTime() - todayMs) / 86_400_000);
    const forecasts = (weekForecast.data ?? []).slice(offset, offset + (WEEK_LENGTH - lead));
    if (!forecasts.length) return new Map<string, OutfitCandidate>();

    const days = planWeek({
      wardrobe: items,
      forecasts,
      startDate: from,
      baseContext: context,
      weights: profile.weights,
      affinities: profile.affinities,
      alreadyPlanned,
    });

    const map = new Map<string, OutfitCandidate>();
    for (const d of days) if (d.outfit) map.set(dateKey(d.date), d.outfit);
    return map;
  }, [
    weekForecast.data,
    items,
    context,
    profile.weights,
    profile.affinities,
    alreadyPlanned,
    weekStartMs,
    todayMs,
  ]);

  /** What is actually on a day: the committed plan first, then the proposal. */
  const garmentsOn = (date: Date): Garment[] => {
    const key = dateKey(date);
    const committed = (planned.data?.[key] ?? [])
      .map((id) => garmentsById.get(id))
      .filter((g): g is Garment => Boolean(g));
    if (committed.length) return committed;
    return proposals.get(key)?.items ?? [];
  };

  // Packing signs and fetches its own images — it renders the whole closet, not
  // a handful of planned outfits — so this covers the strip's window only.
  const { resolve } = useSignedUrls(
    useMemo(
      () =>
        Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i)).flatMap((d) =>
          garmentsOn(d).flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]),
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [planned.data, proposals, garmentsById, windowStartMs],
    ),
  );

  // The closet gate applies to the WEEK only now. Events stays open regardless
  // — a brand-new user invited to Thursday's dinner has an empty closet and a
  // full social calendar, and that invitation is the growth loop. Packing is
  // exempt for a different reason: its empty-closet answer used to be a button
  // that opened the camera, which is precisely the entry point being removed.
  //
  // Read only AFTER the failure and loading branches below, so an unread closet
  // can never be reported as an empty one.
  const closetEmpty = !canGenerate(items);

  /**
   * Week's three honest answers, in the order they have to be asked.
   *
   * THE ORDER IS THE FIX. `closetEmpty` used to be the first question, and it
   * folded two states that are not empty into "Add about ten pieces": a closet
   * read that FAILED (`items` falls back to `[]`, so a network error told the
   * user their wardrobe was empty — the exact false claim `ErrorState` exists
   * to stop) and one still in flight, which fell past the forecast's skeleton
   * into "Couldn't plan this week" because `canGenerate([])` is false while
   * loading. Failure first, then loading, then absence.
   *
   * `profileQuery` is deliberately not here: it has a `DEFAULT_WEIGHTS`
   * fallback, so its failure degrades the ranking rather than the screen, and
   * blocking the week on it would be the same over-claiming in reverse.
   */
  const weekFailed = wardrobe.isError || weekForecast.isError;
  const weekLoading = wardrobe.isLoading || weekForecast.isLoading;
  const weekStalled = useStalled(weekLoading, STALL_DEADLINE_MS);

  const retryWeek = () => {
    void wardrobe.refetch();
    void weekForecast.refetch();
  };

  // --- The week, assembled for the body -----------------------------------

  const { fontScale } = useWindowDimensions();

  /**
   * Moving the week carries the selection with it, by weekday.
   *
   * Swiping from Saturday's plate to next week lands on next SATURDAY, not on
   * next Monday and not on a plate that silently kept pointing at a day now off
   * screen. The tick is spent inside the strip, on the gesture itself.
   */
  const changeWeek = (delta: -1 | 1) => {
    setWeekStart((w) => addDays(w, delta * WEEK_LENGTH));
    setSelected((s) => addDays(s, delta * WEEK_LENGTH));
  };

  const jumpTo = (date: Date) => {
    setWeekStart(startOfWeek(date));
    setSelected(dayAnchor(date));
    setMonthOpen(false);
  };

  const selectedGarments = garmentsOn(selected);
  const selectedCommitted = Boolean(planned.data?.[dateKey(selected)]?.length);

  const plate: PlanWeekPlate = weekFailed || weekStalled
    ? { kind: 'error' }
    : weekLoading
      ? { kind: 'loading' }
      : selectedGarments.length === 0
        ? { kind: 'empty' }
        : {
            kind: 'ready',
            tiles: selectedGarments
              .slice(0, 3)
              .map((g) => ({ uri: resolve(g.platePath, g.cutoutPath, g.thumbPath) })),
            // The first piece names the plate. `explain`-style prose belongs to
            // the expanded day, which this redesign replaces; a single tracked
            // caps line is what the frame carries.
            label: selectedGarments[0]
              ? (selectedGarments[0].subcategory ?? selectedGarments[0].category)
              : null,
          };

  const windowDays: PlanWeekDayView[] = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = addDays(windowStart, i);
    const key = dateKey(date);
    const committed = planned.data?.[key] ?? [];
    const first = committed.map((id) => garmentsById.get(id)).find(Boolean);
    return {
      date,
      weather: weatherFor(date),
      planned: committed.length > 0,
      thumbUri: first ? resolve(first.thumbPath, first.platePath, first.cutoutPath) : undefined,
      hasEvent: Boolean(eventOn(date)),
    };
  });

  const selectedEvent = eventOn(selected);
  const action = primaryAction(selected, today);

  const weekView: PlanWeekView = {
    days: windowDays,
    weekOffset: WEEK_LENGTH,
    selected,
    today,
    plate,
    occasion: selectedEvent
      ? {
          title: selectedEvent.title,
          line: occasionLine(selectedEvent.startsAt, selectedEvent.memberCount),
        }
      : null,
    primaryLabel: action.label,
    onSelectDay: setSelected,
    onWeek: changeWeek,
    onOpenMonth: () => setMonthOpen(true),
    onLogWear: () => {
      const candidate = proposals.get(dateKey(selected));
      if (action.kind === 'keep') {
        // A day ahead can only be KEPT. Nothing is committed twice: a day that
        // already carries a plan has no proposal to commit.
        if (!candidate || selectedCommitted) return;
        planOutfit.mutate(
          { candidate, date: selected },
          {
            onSuccess: () => haptics.commit(),
            onError: () => {
              haptics.failure();
              toast.show(WEEK_COPY.planFailed);
            },
          },
        );
        return;
      }
      // Today or behind it: the wear is a fact, and `useWearOutfit` is the
      // existing transaction that records one.
      const worn = candidate ?? (selectedGarments.length ? { items: selectedGarments } : null);
      if (!worn) return;
      wearOutfit.mutate(
        {
          candidate: worn as OutfitCandidate,
          context,
          name: '',
          reasoning: '',
        },
        {
          onSuccess: () => haptics.success(),
          onError: () => {
            haptics.failure();
            toast.show(WEEK_COPY.wearFailed);
          },
        },
      );
    },
    // The engine's own "try another": the pieces on offer are refused, and the
    // week re-plans around them. A WEEK-wide exclusion, because `planWeek`
    // searches its days in order and each avoids what the ones before it took.
    onSwap: () => setRefused((r) => [...new Set([...r, ...selectedGarments.map((g) => g.id)])]),
    onPlanDay: retryWeek,
    onRetry: retryWeek,
    onOpenCloset: () => router.push('/(tabs)/closet'),
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The masthead belongs to Events and Packing now.

          Redesign 01 gives WEEK its own — the serif "Plan" against the month
          label that opens the grid sheet — and `PlanWeekBody` draws it, because
          the label has to follow what the strip is showing and the strip lives
          in the body. Rendering both would put two "Plan" titles on one screen.
          Events and Packing keep the LP-06 pairing untouched: the title against
          its eyebrow date range, and no support sentence under either. */}
      {mode === 'week' ? null : (
      <View className="px-gutter pb-3 pt-2">
        <View className="flex-row items-baseline justify-between">
          <Text variant="display">Plan</Text>
          {/* The tracked caps register, same as Today's day line. The atlas
              sets it in `faint`; it stays `muted` per the 2026-08-06 contrast
              pass — faint fails AA as text on canvas.

              `shrink` for the same reason `FieldGroup` carries it
              (occasion-field.tsx): React Native defaults `flexShrink` to 0, so
              a Text in a row reports its full intrinsic width and the ROW
              grows past the gutter instead of the text yielding. On a 320pt
              width, or with Dynamic Type pushing both sides up, the side that
              must give way is the date range rather than the title. */}
          <Text variant="eyebrow" className="shrink" numberOfLines={1}>
            {weekRangeLabel}
          </Text>
        </View>

        {/* LP-06's support line is GONE, and the masthead is better without
            it. "Your upcoming events." rendered in all three modes, so it was
            wrong on Week and wrong on Packing; on Events the segmented control
            one row below already says "Events". What is left is the print-page
            pairing the rest of the app uses — the title against its eyebrow
            date range — and the line box it occupied becomes air above the
            control. */}
      </View>
      )}

      <SegmentedControl mode={mode} onChange={setMode} inviteCount={inviteCount} />

      {mode === 'events' ? (
        // className does not reach Animated.* (see the pill above) — flex-1
        // is inline here rather than a dropped class.
        <Animated.View
          key="events"
          style={{ flex: 1 }}
          entering={FadeIn.duration(motion.duration.fast)}
          exiting={FadeOut.duration(motion.duration.fast)}>
          <ScrollView contentContainerClassName="pb-24" showsVerticalScrollIndicator={false}>
            {/* One primary action per surface (the app's own rule everywhere
                else): "New event" is the full-width ink control; "Invite
 friends" is a quiet link beneath it, same grammar as Lately's
 "Your circle" row, rather than the two sharing one container. */}
            <View className="mx-gutter mb-5">
              <Pressable
                onPress={() => router.push('/event/new')}
                accessibilityRole="button"
                accessibilityLabel="New event"
                style={{ minHeight: 52 }}
                className="flex-row items-center gap-3 rounded-md bg-ink px-5 active:opacity-70">
                {/* The plus is its own glyph, a step larger than the label
                    and set off by a real gap — not two spaces inside the
                    string, which track with the font instead of the layout. */}
                <Text variant="body" style={{ color: theme.canvas }}>
                  +
                </Text>
                <Text variant="body" style={{ color: theme.canvas }}>
                  New event
                </Text>
              </Pressable>
              <Pressable
                // The friends surface belongs to the social-graph slice; the
                // path string is the whole coupling, same as the event routes.
                onPress={() => router.push('/friends')}
                accessibilityRole="button"
                accessibilityLabel="Invite friends"
                className="flex-row items-center gap-1.5 py-2 active:opacity-60">
                <Text variant="label" className="text-muted">
                  Invite friends
                </Text>
                <SymbolView
                  name="chevron.right"
                  size={11}
                  tintColor={theme.faint}
                  resizeMode="scaleAspectFit"
                />
              </Pressable>
            </View>

            {myEvents.isError || invites.isError ? (
              <ErrorState
                compact
                kicker="Couldn’t reach it"
                title="Couldn't load your plans"
                body="Something went wrong reaching your events. Check your connection and try again."
                onRetry={() => {
                  void myEvents.refetch();
                  void invites.refetch();
                }}
                retrying={myEvents.isRefetching || invites.isRefetching}
              />
            ) : myEvents.isLoading || invites.isLoading ? (
              <EventListSkeleton />
            ) : (
              <>
                {(invites.data?.length ?? 0) > 0 ? (
                  <View className="px-gutter">
                    <SectionHeader title="Invitations" className="mb-3" />
                    {invites.data!.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onPress={() => router.push(`/event/${event.id}`)}
                      />
                    ))}
                  </View>
                ) : null}

                {(myEvents.data?.length ?? 0) > 0 ? (
                  <View className="px-gutter">
                    {(invites.data?.length ?? 0) > 0 ? (
                      <SectionHeader title="Coming up" className="mb-3 mt-6" />
                    ) : null}
                    {myEvents.data!.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onPress={() => router.push(`/event/${event.id}`)}
                      />
                    ))}
                    {/* The ceiling, as a foot rather than a banner — the
                        quiet-upgrade grammar `today/repeat-mark.tsx` already
                        uses. The count and the limit both come from plans.ts,
                        so nothing here can promise a number the database does
                        not enforce, and the sentence explaining what
                        membership ADDS is deliberately absent: context-lines
                        carries it and the paywall renders it.

                        The accent budget is intact. This screen's filled
                        action stays "New event" in ink; "See plans" is a text
                        link, the same weight as "Invite friends" above it.
                        Joining is untouched and free on every tier — only
                        hosting is rationed. */}
                    {atHostingCeiling ? (
                      <View className="mt-4 flex-row items-baseline justify-between gap-3">
                        <Text variant="colophon" className="shrink">
                          {`HOSTING ${hostedCount} OF ${PLANS.free.eventHosting}`}
                        </Text>
                        <Pressable
                          onPress={() => void gate.present(Placement.EventHostingOverLimit)}
                          accessibilityRole="button"
                          accessibilityLabel="See plans"
                          hitSlop={8}
                          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                          className="active:opacity-60">
                          <Text variant="label" style={{ color: theme.accent }}>
                            See plans
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : (invites.data?.length ?? 0) === 0 ? (
                  <>
                    <View className="px-gutter pb-5 pt-7">
                      <Text variant="title" trim>
                        Give everyone something to look forward to.
                      </Text>
                      {/* The three occasion types survive as a typographic
                          list; the sentence around them does not. "Invite the
                          people going, share looks before the day" is what
                          `ExampleEvents` directly below DEMONSTRATES — two
                          fictional occasions with dates, venues and
                          monogrammed attendees — and "inside the circle you
                          chose" is a privacy claim the occasion's own page
                          already makes. `pb-5` rather than `pb-7` so the
                          example sits closer to the headline it illustrates. */}
                      <Text variant="colophon" className="mt-4">
                        DINNERS · WEDDINGS · WEEKENDS AWAY
                      </Text>
                    </View>
                    {/* PL-C2 — two fictional events under the copy, in place
                        of the ghost cards that used to trail off here. */}
                    <ExampleEvents />
                  </>
                ) : null}
              </>
            )}
          </ScrollView>
        </Animated.View>
      ) : mode === 'packing' ? (
        // The answered trip is held HERE, not inside PackingTab: that component
        // unmounts on every switch to Week, and five questions should survive
        // someone glancing at their week.
        <Animated.View
          key="packing"
          style={{ flex: 1 }}
          entering={FadeIn.duration(motion.duration.fast)}
          exiting={FadeOut.duration(motion.duration.fast)}>
          <PackingTab active trip={trip} onTrip={setTrip} />
        </Animated.View>
      ) : (
        <Animated.View
          key="week"
          style={{ flex: 1 }}
          entering={FadeIn.duration(motion.duration.fast)}
          exiting={FadeOut.duration(motion.duration.fast)}>
          {/* The failure and the wait are NOT branches of the week any more.

              Redesign 01 is explicit that the strip stays live and swipeable
              while the plate reports — "only the plate holds a skeleton", "only
              the plate reports. No counts promised" — so both states are passed
              INTO the body as `plate.kind` and drawn inside the plate's own
              box. `ErrorState`'s full-page takeover would have covered a
              calendar that works, and "Couldn't lay out your week" would have
              claimed the whole week failed when what failed was one day's
              proposal. "The plate didn't load" is the frame's own sentence and
              the truer one.

              The EMPTY CLOSET is still a page-level answer, and stays one: it
              is not "nothing planned for Tuesday", it is "there is nothing to
              plan with", and the invitation plus its example week is the P-03
              composition that answers it. */}
          {closetEmpty && !weekFailed && !weekLoading ? (
            // P-03 composes the invitation ABOVE an example of the surface it
            // is inviting the user into; the ghost week fills whatever is left.
            <View className="flex-1">
              {/* EmptyState's grammar, hand-built: its `flex-1 justify-center`
                  collapses to zero height above the example section (flex
                  basis 0 in an auto-height slot), and P-03 sets the plate at
                  the top with the ink action at full width regardless. */}
              <View className="px-gutter pb-6 pt-2" accessibilityRole="summary">
                <SymbolView
                  name="calendar"
                  size={22}
                  tintColor={theme.muted}
                  resizeMode="scaleAspectFit"
                />
                <View style={{ marginTop: 16 }}>
                  <Text variant="title" trim>
                    See the week before it starts.
                  </Text>
                </View>
                {/* Three claims welded into one measure — the days ahead, the
                    weather, the closet, and repeats kept down — became one
                    typographic register mark. `ExampleWeek` directly below
                    SHOWS all four: seven dated rows, real weather strings,
                    garment photographs. The paragraph was narrating a picture
                    the reader is already looking at.

                    The day count reads from `WEEK_DAYS`, the same constant the
                    strip below is built from, so this line cannot drift from
                    what it labels. `colophon` sets its own uppercase. */}
                <Text variant="colophon" className="mt-5">
                  {`${numberWord(WEEK_DAYS)} days · The forecast · Fewest repeats`}
                </Text>
                {/* The one actionable fact, kept whole.

                    "about ten" is `PLANS.free.items`, not a word typed into a
                    sentence — the rule at `tour-copy.ts:17-28`. It is
                    deliberately NOT `MIN_CLOSET_FOR_OUTFITS` (8), which gates
                    the branch this copy sits in: eight is the engine's floor
                    for producing *a* look, it is internal, and no screen has
                    ever printed it. The number the user meets everywhere else
                    — the tour, The Ten, Today's empty state — is the free
                    tier's, so it is the one this asks for, hedged with "about"
                    because the real gate is a shape (a top and a bottom, or a
                    dress) rather than a count. */}
                <Text variant="body" className="mt-4 text-muted">
                  {`Add about ${numberWord(PLANS.free.items)} pieces to begin.`}
                </Text>
                <Button
                  title="Add clothes"
                  onPress={() => router.push('/add-clothes')}
                  haptic
                  variant="ink"
                  className="mt-7 self-stretch"
                />
              </View>
              {/* PL-C1. The day numbers follow the week the strip is on, so
                  the example can never contradict it. */}
              <ExampleWeek weekStart={startOfToday()} />
            </View>
          ) : (
            /* The week itself. `PlanWeekBody` owns the masthead, the swipeable
               strip, the plate and the actions; this file owns the queries and
               the writes behind them, which is the split people-search and
               new-event both make.

               No ScrollView and no RefreshControl around it: the body is a
               fixed composition — masthead, strip, heading, plate, occasion,
               actions — that fits the frame at standard size and grows into its
               own scrolling regions at the accessibility sizes. Pull-to-refresh
               is replaced by the plate's own "Try again", which is the recovery
               the frames draw. */
            <Animated.View
              key="week-content"
              style={{ flex: 1 }}
              entering={FadeIn.duration(motion.duration.fast)}>
              <PlanWeekBody view={weekView} large={fontScale >= PLAN_WEEK_STACK_SCALE} />
            </Animated.View>
          )}

          {/* The long jump. Opens from the month label in the body's masthead
              and reads the same window the strip does, so the two cannot
              disagree about which days are planned or carry an occasion. */}
          <PlanMonthSheet
            view={{
              visible: monthOpen,
              anchor: weekStart,
              selected,
              today,
              plannedKeys: new Set(
                windowDays.filter((d) => d.planned).map((d) => dateKey(d.date)),
              ),
              eventKeys: new Set(
                windowDays.filter((d) => d.hasEvent).map((d) => dateKey(d.date)),
              ),
              onDismiss: () => setMonthOpen(false),
              onJump: jumpTo,
            }}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
