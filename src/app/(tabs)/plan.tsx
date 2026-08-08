import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/events/EventCard';
import { DayRow } from '@/components/plan/day-row';
import { ExamplePlans, ExampleWeek } from '@/components/plan/example-ghosts';
import { Button, ErrorState, SectionHeader, Skeleton, SkeletonLead } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast } from '@/features/context/weather';
import { useEventInvites, useMyEvents } from '@/features/events/queries';
import { usePlanOutfit, usePlannedWeek } from '@/features/plan/mutations';
import { PackingTab } from '@/features/plan/packing-tab';
import { planWeek } from '@/features/plan/packing';
import type { Trip } from '@/features/plan/trip';
import { STALL_DEADLINE_MS, useStalled } from '@/features/plan/use-stalled';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { dateKey } from '@/lib/date';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';
import { concentric, MIN_TAP_TARGET, motion, spring, useTheme } from '@/theme/tokens';

const WEEK_DAYS = 7;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Whole days between today and `d`, local calendar — indexes the forecast. */
const daysFromToday = (d: Date) => {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - startOfToday().getTime()) / 86_400_000);
};

type Mode = 'week' | 'events' | 'packing';
const MODES: Mode[] = ['week', 'events', 'packing'];

// A skeleton whose bars vary in length reads as sentences about to arrive; a
// uniform column reads as a loading graphic (skeleton.tsx's ROW_WIDTHS rule).
const WEEK_BAR_WIDTHS = [200, 236, 180, 214, 190, 224, 196] as const;

/**
 * The week's own skeleton — one row per day the screen is about to show, in
 * the day row's exact geometry (42pt day slot, 18pt vertical, rule beneath)
 * so nothing jumps when the plan lands. `ListSkeleton`'s two-line roster rows
 * are the wrong anatomy here.
 */
function WeekSkeleton() {
  return (
    <View accessibilityLabel="Laying out your week">
      <SkeletonLead label="Laying out your week…" />
      {Array.from({ length: WEEK_DAYS }).map((_, i) => (
        <View
          key={i}
          className={[
            'flex-row items-center gap-3.5 px-gutter py-[18px]',
            i === WEEK_DAYS - 1 ? '' : 'border-b border-rule dark:border-rule-dark',
          ].join(' ')}>
          <Skeleton className="h-3.5 rounded-sm" style={{ width: 42 }} />
          <Skeleton
            className="h-3.5 flex-1 rounded-sm"
            style={{ maxWidth: WEEK_BAR_WIDTHS[i % WEEK_BAR_WIDTHS.length] }}
          />
        </View>
      ))}
    </View>
  );
}

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
          className="mx-gutter mb-3 rounded-plate border border-rule p-4 dark:border-rule-dark">
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
    if (m !== mode) void Haptics.selectionAsync().catch(() => {});
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
  // Which day's plan write is in flight, so committing Tuesday no longer
  // disables and spins all seven rows (borrow.tsx's `busyId` is the same
  // shape). `planError` is cleared on every new attempt, not just success, so
  // a stale failure never lingers under a day that has since saved.
  const [planningKey, setPlanningKey] = useState<string | null>(null);
  const [planError, setPlanError] = useState(false);

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

  // --- Week ---------------------------------------------------------------
  const weekForecast = useQuery({
    queryKey: ['forecast', coords.latitude.toFixed(2), coords.longitude.toFixed(2), WEEK_DAYS],
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchForecast(coords.latitude, coords.longitude, WEEK_DAYS, signal),
  });

  const planned = usePlannedWeek(startOfToday(), WEEK_DAYS);
  const planOutfit = usePlanOutfit();

  // "5–11 Aug" for the header — real dates, computed once per render rather
  // than stored, since it is derived purely from today's date.
  const weekRangeLabel = useMemo(() => {
    const start = startOfToday();
    const end = new Date(start);
    end.setDate(start.getDate() + WEEK_DAYS - 1);
    const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
    return start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${month(start)}`
      : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
  }, []);

  // Anything already committed to a day this week is out of the running for the
  // others. Without this the planner happily suggests Tuesday's jacket again on
  // Thursday, having no idea Tuesday was ever decided — the query was being
  // fetched and then thrown away.
  const alreadyPlanned = useMemo(
    () => new Set(Object.values(planned.data ?? {}).flat()),
    [planned.data],
  );

  const weekDays = useMemo(() => {
    if (!weekForecast.data?.length || !canGenerate(items)) return [];
    return planWeek({
      wardrobe: items,
      forecasts: weekForecast.data,
      startDate: startOfToday(),
      baseContext: context,
      weights: profile.weights,
      affinities: profile.affinities,
      alreadyPlanned,
    });
  }, [weekForecast.data, items, context, profile.weights, profile.affinities, alreadyPlanned]);

  // Packing signs and fetches its own images — it renders the whole closet, not
  // a handful of planned outfits — so this covers the week only.
  const { resolve } = useSignedUrls(
    weekDays.flatMap(
      (d) => d.outfit?.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]) ?? [],
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

  /** The event day's forecast, when the day is inside the week window. */
  // An occasion with no date has no day to read a forecast for — the card
  // prints no weather clause at all rather than borrowing today's.
  const weatherFor = (startsAt: Date | null) => {
    if (!startsAt) return null;
    const i = daysFromToday(startsAt);
    return i >= 0 && i < WEEK_DAYS ? (weekForecast.data?.[i] ?? null) : null;
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="flex-row items-baseline justify-between px-gutter pb-3 pt-2">
        <Text variant="display">Plan</Text>
        {/* The tracked caps register, same as Today's day line. The atlas
            sets it in `faint`; it stays `muted` per the 2026-08-06 contrast
            pass — faint fails AA as text on canvas. */}
        <Text variant="eyebrow">{weekRangeLabel}</Text>
      </View>

      <SegmentedControl mode={mode} onChange={setMode} inviteCount={inviteCount} />

      {mode === 'events' ? (
        // className does not reach Animated.* (see the pill above) — flex-1
        // is inline here rather than a dropped class.
        <Animated.View
          key="events"
          style={{ flex: 1 }}
          entering={FadeIn.duration(motion.duration.fast)}
          exiting={FadeOut.duration(motion.duration.fast)}>
          <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
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
                <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
                  +
                </Text>
                <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
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
                <Text variant="label" className="text-muted dark:text-muted-dark">
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
                        weather={weatherFor(event.startsAt)}
                        onPress={() => router.push(`/event/${event.id}`)}
                      />
                    ))}
                  </View>
                ) : null}

                {(myEvents.data?.length ?? 0) > 0 ? (
                  <View className="px-gutter">
                    {(invites.data?.length ?? 0) > 0 ? (
                      <SectionHeader title="Coming up" className="mb-3 mt-4" />
                    ) : null}
                    {myEvents.data!.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        weather={weatherFor(event.startsAt)}
                        onPress={() => router.push(`/event/${event.id}`)}
                      />
                    ))}
                  </View>
                ) : (invites.data?.length ?? 0) === 0 ? (
                  <>
                    <View className="px-gutter pb-6 pt-6">
                      <Text variant="title" trim>
                        Nothing planned together yet
                      </Text>
                      <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
                        Post a dinner, a wedding, a trip — invite your friends, and
                        everyone picks their look before the night. Occasions are
                        invite-only, always.
                      </Text>
                    </View>
                    {/* P-07's ghost cards, trailing off below the copy. */}
                    <ExamplePlans />
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
          {weekFailed || weekStalled ? (
            <ErrorState
              kicker="Couldn’t reach it"
              title="Couldn’t lay out your week"
              body="Cinch couldn’t read everything the days ahead need — your closet, or this week’s weather. That’s a connection problem, not a change to your things: nothing in your wardrobe has moved."
              onRetry={retryWeek}
              retrying={wardrobe.isRefetching || weekForecast.isRefetching}
            />
          ) : weekLoading ? (
            <Animated.View key="week-loading" exiting={FadeOut.duration(motion.duration.fast)}>
              <WeekSkeleton />
            </Animated.View>
          ) : closetEmpty ? (
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
                    Plan the week ahead
                  </Text>
                </View>
                <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
                  Lay out outfits for the days coming up, one for each day, with
                  no piece worn more than twice. Add about ten pieces and the
                  week lays itself out.
                </Text>
                <Button
                  title="Add clothes"
                  onPress={() => router.push('/capture')}
                  haptic
                  variant="ink"
                  className="mt-6 self-stretch"
                />
              </View>
              <ExampleWeek />
            </View>
          ) : (
            // Animated.View wraps a plain ScrollView rather than animating
            // Animated.ScrollView itself: `contentContainerClassName` is a
            // NativeWind prop, and NativeWind does not reach Animated.*
            // components either (same reason the pill above is inline style).
            <Animated.View key="week-content" entering={FadeIn.duration(motion.duration.fast)}>
              <ScrollView
                contentContainerClassName="pb-10"
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={wardrobe.isRefetching || weekForecast.isRefetching}
                    onRefresh={retryWeek}
                    tintColor={theme.muted}
                  />
                }>
                {weekDays.length === 0 ? (
                  <ErrorState
                    compact
                    title="Couldn't plan this week"
                    body="The forecast came back without enough to work with, so nothing in your closet could be matched to the days ahead."
                    onRetry={retryWeek}
                    retrying={wardrobe.isRefetching || weekForecast.isRefetching}
                  />
                ) : (
                  <>
                    {/* `plate`, not `title`: the atlas sets the mode heading
                        at the compact serif size — the page's H1 is "Plan". */}
                    <View className="mb-2 px-gutter">
                      <Text variant="plate">This week</Text>
                    </View>
                    {/* The engine PREFERS spreading wear (REUSE_BOOST is a
                        soft scorer, not a cap) — with a small closet the same
                        shirt can honestly appear five times. The old line,
                        "No piece worn more than twice", printed a promise
                        the week below it visibly broke. */}
                    {/* The tracked caps kicker, in oxblood — inline style,
                        not a second text-* class on top of the variant's own
                        (no precedence between two; see button.tsx). */}
                    <Text
                      variant="eyebrow"
                      className="mb-2 px-gutter"
                      style={{ color: theme.accent }}>
                      Repeats kept to a minimum
                    </Text>
                    {weekDays.map((day, i) => {
                      const key = dateKey(day.date);
                      return (
                        <DayRow
                          key={key}
                          day={day}
                          resolveImage={resolve}
                          planned={Boolean(planned.data?.[key]?.length)}
                          planning={planningKey === key}
                          isLast={i === weekDays.length - 1}
                          onPlan={() => {
                            if (!day.outfit) return;
                            setPlanningKey(key);
                            setPlanError(false);
                            planOutfit.mutate(
                              { candidate: day.outfit, date: day.date },
                              {
                                onError: () => setPlanError(true),
                                onSettled: () => setPlanningKey(null),
                              },
                            );
                          }}
                        />
                      );
                    })}
                    {/* `polite` rather than a modal or a toast: the failure
                        belongs to the one row that triggered it, and nothing
                        else on the screen should interrupt to say so. The
                        atlas draws this as its own shape — a bordered card
                        with an oxblood mark, not the bare `Notice` line — so
                        it is hand-built here, like the review deck's banner. */}
                    {planError ? (
                      <View
                        accessibilityLiveRegion="polite"
                        className="mx-gutter mt-3 flex-row items-start gap-2.5 rounded-lg border border-rule bg-canvas p-3.5 dark:border-rule-dark dark:bg-canvas-dark">
                        <View
                          className="h-2 w-2 rounded-full bg-accent"
                          style={{ marginTop: 5 }}
                        />
                        <Text variant="label" className="flex-1" style={{ color: theme.ink }}>
                          That day didn’t save. Check your connection and try again.
                        </Text>
                      </View>
                    ) : null}
                  </>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
