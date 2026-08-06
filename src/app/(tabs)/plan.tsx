import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/events/EventCard';
import { DayRow } from '@/components/plan/day-row';
import { Chip } from '@/components/ui/chip';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast, searchPlaces, type Place } from '@/features/context/weather';
import { useEventInvites, useMyEvents } from '@/features/events/queries';
import { usePlanOutfit, usePlannedWeek } from '@/features/plan/mutations';
import { buildPackingList, planWeek } from '@/features/plan/packing';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { dateKey } from '@/lib/date';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

const WEEK_DAYS = 7;
const TRIP_LENGTHS = [3, 5, 7, 10];

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
 */
export default function PlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('week');

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

  // --- Packing ------------------------------------------------------------
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Place | null>(null);
  const [tripDays, setTripDays] = useState(5);

  const places = useQuery({
    queryKey: ['places', query],
    enabled: mode === 'packing' && query.trim().length >= 2 && !destination,
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => searchPlaces(query, signal),
  });

  const tripForecast = useQuery({
    queryKey: ['forecast', destination?.latitude, destination?.longitude, tripDays],
    enabled: Boolean(destination),
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchForecast(destination!.latitude, destination!.longitude, tripDays, signal),
  });

  const packing = useMemo(() => {
    if (!tripForecast.data?.length || !canGenerate(items)) return null;
    return buildPackingList({
      wardrobe: items,
      forecasts: tripForecast.data,
      startDate: startOfToday(),
      baseContext: context,
      weights: profile.weights,
      formality: null,
    });
  }, [tripForecast.data, items, context, profile.weights]);

  // Sign every image both closet modes could render, in one request.
  const { resolve } = useSignedUrls([
    ...weekDays.flatMap((d) => d.outfit?.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]) ?? []),
    ...(packing?.items.flatMap((i) => [i.garment.platePath, i.garment.cutoutPath, i.garment.thumbPath]) ?? []),
  ]);

  // The closet gate applies to the two styling modes only. Events stays open
  // regardless — a brand-new user invited to Thursday's dinner has an empty
  // closet and a full social calendar, and that invitation is the growth loop.
  const closetEmpty = !wardrobe.isLoading && !canGenerate(items);

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
      ) : closetEmpty ? (
        <EmptyState
          symbol="calendar"
          title="Plan the week ahead"
          body="Lay out outfits for the days coming up, or build a packing list from what you already own. Add about ten pieces to get started."
          actionTitle="Add clothes"
          onAction={() => router.push('/capture')}
        />
      ) : (
        <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
          {mode === 'week' ? (
            weekForecast.isError ? (
              <ErrorState
                compact
                title="Couldn't load the forecast"
                body="This week's weather didn't come through, so Cinch can't lay out the days ahead. Check your connection and try again."
                onRetry={() => void weekForecast.refetch()}
                retrying={weekForecast.isRefetching}
              />
            ) : weekForecast.isLoading ? (
              <ListSkeleton count={WEEK_DAYS} avatar={false} />
            ) : weekDays.length === 0 ? (
              <View className="px-gutter pt-6">
                <Text variant="title" trim>
                  Couldn&rsquo;t plan this week
                </Text>
                <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
                  The forecast came back without enough to work with, so
                  nothing in your closet could be matched to the days ahead.
                  Try again in a moment.
                </Text>
              </View>
            ) : (
              <>
                <View className="mb-1 px-gutter">
                  <Text variant="title">This week</Text>
                </View>
                <Text variant="label" className="mb-5 px-gutter text-accent dark:text-accent-dark">
                  No piece worn more than twice
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
            )
          ) : (
            <>
              <View className="px-gutter">
                <TextInput
                  value={destination ? `${destination.name}, ${destination.country}` : query}
                  onChangeText={(t) => {
                    setDestination(null);
                    setQuery(t);
                  }}
                  placeholder="Where are you going?"
                  placeholderTextColor={theme.muted}
                  accessibilityLabel="Destination"
                  className="rounded-card border border-hairline px-3.5 py-2.5 text-ink dark:border-hairline-dark dark:text-ink-dark"
                />

                {!destination && (places.data?.length ?? 0) > 0 ? (
                  <View className="mt-2 overflow-hidden rounded-card border border-hairline dark:border-hairline-dark">
                    {places.data!.map((place) => (
                      <Pressable
                        key={`${place.name}-${place.latitude}`}
                        onPress={() => {
                          setDestination(place);
                          setQuery('');
                        }}
                        accessibilityRole="button"
                        style={{ minHeight: MIN_TAP_TARGET }}
                        className="justify-center border-b border-hairline px-4 active:opacity-60 dark:border-hairline-dark">
                        <Text variant="body">
                          {place.name}
                          <Text variant="label">  {place.country}</Text>
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <View className="mt-4 flex-row gap-2">
                  {TRIP_LENGTHS.map((n) => (
                    <Chip
                      key={n}
                      label={`${n} days`}
                      selected={tripDays === n}
                      onPress={() => setTripDays(n)}
                    />
                  ))}
                </View>
              </View>

              {!destination ? (
                <View className="px-gutter pt-8">
                  <Text variant="body" className="text-muted dark:text-muted-dark">
                    Pick a destination and Cinch builds the smallest set of clothes
                    that still gives you a different outfit each day — using the
                    real forecast where you are going.
                  </Text>
                </View>
              ) : tripForecast.isError ? (
                <ErrorState
                  compact
                  title="Couldn't load the forecast"
                  body="The weather for your trip didn't come through, so Cinch can't build a packing list yet. Check your connection and try again."
                  onRetry={() => void tripForecast.refetch()}
                  retrying={tripForecast.isRefetching}
                />
              ) : tripForecast.isLoading ? (
                <View className="pt-6">
                  <ListSkeleton count={tripDays} avatar={false} />
                </View>
              ) : packing ? (
                <View className="pt-6">
                  <View className="mx-gutter mb-6 rounded-card border border-hairline p-5 dark:border-hairline-dark">
                    <Text variant="caption">Pack</Text>
                    <Text variant="stat" className="mt-2 text-figure">
                      {packing.items.length} pieces
                    </Text>
                    <Text variant="label" className="mt-1">
                      {tripDays} days in {destination.name} · covers every day
                    </Text>

                    <View className="mt-4 gap-1.5">
                      {packing.items.map(({ garment, days }) => (
                        <View key={garment.id} className="flex-row items-baseline gap-2">
                          <Text variant="body" className="flex-1" numberOfLines={1}>
                            {garment.colors[0]?.name ?? ''} {garment.subcategory ?? garment.category}
                          </Text>
                          <Text variant="label">
                            {days === tripDays ? 'every day' : `${days} ${days === 1 ? 'day' : 'days'}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <Text variant="label" className="mb-4 px-gutter">
                    How it works out, day by day
                  </Text>
                  {packing.days.map((day, i) => (
                    <DayRow
                      key={dateKey(day.date)}
                      day={day}
                      resolveImage={resolve}
                      isLast={i === packing.days.length - 1}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
