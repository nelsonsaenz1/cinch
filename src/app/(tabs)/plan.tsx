import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayRow } from '@/components/plan/day-row';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast, searchPlaces, type Place } from '@/features/context/weather';
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

/**
 * Plan — the week ahead, and packing for a trip.
 *
 * Two modes that pull the same engine in opposite directions. The week planner
 * maximises variety, excluding anything substantial worn in the previous two
 * days. Packing minimises the number of garments, biasing hard toward reuse so
 * a week's outfits collapse into a suitcase that actually closes.
 */
export default function PlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [mode, setMode] = useState<'week' | 'packing'>('week');

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

  // Sign every image both modes could render, in one request.
  const { resolve } = useSignedUrls([
    ...weekDays.flatMap((d) => d.outfit?.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]) ?? []),
    ...(packing?.items.flatMap((i) => [i.garment.platePath, i.garment.cutoutPath, i.garment.thumbPath]) ?? []),
  ]);

  if (!wardrobe.isLoading && !canGenerate(items)) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <View className="px-gutter pb-2 pt-2">
          <Text variant="display">Plan</Text>
        </View>
        <EmptyState
          symbol="calendar"
          title="Plan the week ahead"
          body="Lay out outfits for the days coming up, or build a packing list from what you already own. Add about ten pieces to get started."
          actionTitle="Add clothes"
          onAction={() => router.push('/capture')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="px-gutter pb-3 pt-2">
        <Text variant="display">Plan</Text>
      </View>

      <View className="mb-4 flex-row gap-2 px-gutter">
        <Chip label="This week" selected={mode === 'week'} onPress={() => setMode('week')} />
        <Chip label="Packing" selected={mode === 'packing'} onPress={() => setMode('packing')} />
      </View>

      <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
        {mode === 'week' ? (
          weekForecast.isLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator color={theme.muted} />
            </View>
          ) : (
            <>
              <View className="mb-1 flex-row items-baseline justify-between px-gutter">
                <Text variant="title">This week</Text>
                <Text variant="label" className="text-faint dark:text-faint-dark">
                  {weekRangeLabel}
                </Text>
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
            ) : tripForecast.isLoading ? (
              <View className="items-center py-16">
                <ActivityIndicator color={theme.muted} />
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
    </SafeAreaView>
  );
}
