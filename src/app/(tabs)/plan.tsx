import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/events/EventCard';
import { DayRow } from '@/components/plan/day-row';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
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
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

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

/**
 * One segment of the pill toggle: sand track, ink pill for the active one,
 * cream label on ink. The dot is the app's entire notion of a badge — a
 * single quiet mark when invitations wait, never a number in a red circle.
 */
function Segment({
  label,
  active,
  onPress,
  showDot,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  showDot?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={showDot ? `${label}, new invitations` : label}
      style={{ minHeight: MIN_TAP_TARGET - 8 }}
      className={`flex-1 flex-row items-center justify-center rounded-md ${
        active ? 'bg-ink' : ''
      } active:opacity-70`}>
      <Text variant="label" style={{ color: active ? theme.canvas : theme.muted }}>
        {label}
      </Text>
      {showDot ? <View className="ml-1.5 h-1.5 w-1.5 rounded-full bg-accent" /> : null}
    </Pressable>
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
  const weatherFor = (startsAt: Date) => {
    const i = daysFromToday(startsAt);
    return i >= 0 && i < WEEK_DAYS ? (weekForecast.data?.[i] ?? null) : null;
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="flex-row items-baseline justify-between px-gutter pb-3 pt-2">
        <Text variant="display">Plan</Text>
        <Text variant="label" className="text-faint dark:text-faint-dark">
          {weekRangeLabel}
        </Text>
      </View>

      <View className="mx-gutter mb-4 flex-row rounded-md bg-sand p-1">
        <Segment label="Week" active={mode === 'week'} onPress={() => setMode('week')} />
        <Segment
          label="Events"
          active={mode === 'events'}
          onPress={() => setMode('events')}
          showDot={inviteCount > 0}
        />
        <Segment label="Packing" active={mode === 'packing'} onPress={() => setMode('packing')} />
      </View>

      {mode === 'events' ? (
        <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
          {/* One control, two affordances. `md`, not a capsule: this is a
              labelled control, and rounded-full is reserved for glass chrome
              and 1:1 marks (tailwind.config.js). */}
          <View className="mx-gutter mb-5 flex-row items-center overflow-hidden rounded-md bg-ink">
            <Pressable
              onPress={() => router.push('/event/new')}
              accessibilityRole="button"
              accessibilityLabel="New event"
              style={{ minHeight: 52 }}
              className="flex-1 flex-row items-center px-5 active:opacity-70">
              <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
                +  New event
              </Text>
            </Pressable>
            <View className="h-5 w-hair bg-canvas opacity-25" />
            <Pressable
              // The friends surface belongs to the social-graph slice; the
              // path string is the whole coupling, same as the event routes.
              onPress={() => router.push('/friends')}
              accessibilityRole="button"
              accessibilityLabel="Invite friends"
              style={{ minHeight: 52 }}
              className="flex-row items-center px-5 active:opacity-70">
              <Text variant="label" style={{ color: `${theme.canvas}B3` }}>
                Invite friends
              </Text>
            </Pressable>
          </View>

          {myEvents.isError || invites.isError ? (
            <ErrorState
              compact
              title="Couldn't load your plans"
              body="Something went wrong reaching your events. Check your connection and try again."
              onRetry={() => {
                void myEvents.refetch();
                void invites.refetch();
              }}
              retrying={myEvents.isRefetching || invites.isRefetching}
            />
          ) : myEvents.isLoading || invites.isLoading ? (
            <ListSkeleton count={3} label="Reading your plans…" />
          ) : (
            <>
              {(invites.data?.length ?? 0) > 0 ? (
                <View className="px-gutter">
                  <Text variant="eyebrow" className="mb-3">
                    Invitations
                  </Text>
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
                    <Text variant="eyebrow" className="mb-3 mt-4">
                      Coming up
                    </Text>
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
                <View className="px-gutter pt-6">
                  <Text variant="title" trim>
                    Nothing planned together yet
                  </Text>
                  <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
                    Post a dinner, a wedding, a trip — invite your friends, and
                    everyone picks their look before the night. Occasions are
                    invite-only, always.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : mode === 'packing' ? (
        // The answered trip is held HERE, not inside PackingTab: that component
        // unmounts on every switch to Week, and five questions should survive
        // someone glancing at their week.
        <PackingTab active trip={trip} onTrip={setTrip} />
      ) : weekFailed || weekStalled ? (
        <ErrorState
          title="Couldn’t lay out your week"
          body="Cinch couldn’t read everything the days ahead need — your closet, or this week’s weather. That’s a connection problem, not a change to your things: nothing in your wardrobe has moved."
          onRetry={retryWeek}
          retrying={wardrobe.isRefetching || weekForecast.isRefetching}
        />
      ) : weekLoading ? (
        <ListSkeleton count={WEEK_DAYS} avatar={false} label="Laying out your week…" />
      ) : closetEmpty ? (
        <EmptyState
          symbol="calendar"
          title="Plan the week ahead"
          body="Lay out outfits for the days coming up, one for each day, with no piece worn more than twice. Add about ten pieces to get started."
          actionTitle="Add clothes"
          onAction={() => router.push('/capture')}
        />
      ) : (
        <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
          {weekDays.length === 0 ? (
            <View className="px-gutter pt-6">
              <Text variant="title" trim>
                Couldn&rsquo;t plan this week
              </Text>
              <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
                The forecast came back without enough to work with, so nothing
                in your closet could be matched to the days ahead. Try again in
                a moment.
              </Text>
            </View>
          ) : (
            <>
              <View className="mb-1 px-gutter">
                <Text variant="title">This week</Text>
              </View>
              {/* The engine PREFERS spreading wear (REUSE_BOOST is a soft
                  scorer, not a cap) — with a small closet the same shirt can
                  honestly appear five times. The old line, "No piece worn
                  more than twice", printed a promise the week below it
                  visibly broke. */}
              <Text variant="label" className="mb-5 px-gutter text-accent dark:text-accent-dark">
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
                    planning={planOutfit.isPending}
                    isLast={i === weekDays.length - 1}
                    onPlan={() =>
                      day.outfit &&
                      planOutfit.mutate({ candidate: day.outfit, date: day.date })
                    }
                  />
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
