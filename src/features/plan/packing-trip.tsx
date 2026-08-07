import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { PlateThumb } from '@/components/closet/plate-thumb';
import { Card, EmptyState, ErrorState, ListSkeleton, Rule, SectionHeader, Text } from '@/components/ui';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast } from '@/features/context/weather';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { DEFAULT_WEIGHTS } from '@/lib/styling';
import type { Item } from '@/schemas/item';

import { buildPackingList } from './packing';
import { dayPartOf, formalityFor, tripColophon, type Trip } from './trip';
import { usePackingBrief, type PackingBriefError } from './use-packing-brief';

/**
 * A packed trip: the destination read, the day-parts dressed, the closet open.
 *
 * THREE LAYERS, IN THIS ORDER, and the order is the argument.
 *
 *   1. The brief — the only part that costs a model call. What the place is
 *      like, in one serif line, a spec line and one observation.
 *   2. The day-parts — mornings, days, nights, each with a sentence and real
 *      garments out of this closet.
 *   3. The closet itself, whole and browsable, underneath all of it.
 *
 * Layer 3 renders whatever happens above it. A brief that fails, a function
 * that is not deployed yet, a model that is offline — none of them may take the
 * closet away, because the closet is the thing the user owns and the brief is
 * only an opinion about it. That is why this is a `ClosetGrid` with everything
 * else in its header, rather than a scroll view with a grid awkwardly inside:
 * the closet is the page, and the reading sits on top of it.
 */

const briefCopy = (error: unknown): { title: string; body: string } => {
  const kind = (error as PackingBriefError | null)?.kind;
  if (kind === 'consent') {
    return {
      title: 'Cinch needs your go-ahead first.',
      body: 'Reading a destination is an AI feature, and AI processing is switched off for your account. Turn it on in Profile and the brief will come through. Your closet below is unaffected.',
    };
  }
  if (kind === 'quota') {
    return {
      title: 'You’ve used this month’s styling allowance.',
      body: 'Reading a destination draws on the same allowance as the stylist, and yours is spent for now. It comes back when the month rolls over — the capsule and your closet below don’t use it at all.',
    };
  }
  if (kind === 'unavailable') {
    return {
      title: 'The destination brief isn’t live yet.',
      body: 'This part of packing has not been switched on for your build. Everything below still works — the capsule and your closet are read from your own wardrobe, not from a server.',
    };
  }
  return {
    title: 'The brief didn’t come back.',
    body: 'Cinch couldn’t read this destination just now — a connection problem, not a change to your things. The capsule and your closet below are unaffected.',
  };
};

/**
 * One suggested garment: the plate thumb the closet already renders, its
 * colour and kind, and a tap through to the piece itself. Not a new card —
 * `PlateThumb` is the same component the profile rail uses, so a suggestion
 * looks like the garment it is rather than like a search result.
 */
function SuggestionRow({ item, uri }: { item: Item; uri?: string }) {
  const router = useRouter();
  const colour = item.colors[0]?.name ?? '';

  return (
    <Pressable
      onPress={() => router.push(`/item/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${colour} ${item.subcategory ?? item.category}`}
      className="flex-row items-center gap-3 py-2 active:opacity-60">
      <PlateThumb item={item} uri={uri} size={44} showFallbackLabel={false} />
      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {`${colour} ${item.subcategory ?? item.category}`.trim()}
        </Text>
      </View>
    </Pressable>
  );
}

export function PackingTrip({ trip, onStartAgain }: { trip: Trip; onStartAgain: () => void }) {
  const router = useRouter();

  const closet = useCloset();
  const wardrobeQuery = useWardrobe();
  const profileQuery = useStyleProfile();
  const { context } = useStyleContext();

  const wardrobe = useMemo(() => wardrobeQuery.data ?? [], [wardrobeQuery.data]);
  const items = useMemo(() => closet.data ?? [], [closet.data]);

  // The destination forecast. Failure is survivable by design: the brief then
  // speaks from what the model knows about the month, and the capsule below
  // simply does not render — neither is an error worth a screen.
  const forecast = useQuery({
    queryKey: [
      'forecast',
      trip.destination.latitude.toFixed(2),
      trip.destination.longitude.toFixed(2),
      trip.days,
    ],
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchForecast(trip.destination.latitude, trip.destination.longitude, trip.days, signal),
  });

  const brief = usePackingBrief({
    trip,
    wardrobe,
    styleSummary: profileQuery.data?.summary ?? [],
    forecasts: forecast.data,
  });

  /**
   * The deterministic half — the smallest set of clothes that still gives a
   * different outfit each day, computed on device from the real forecast. It
   * predates the brief and does not depend on it: no network, no model, no
   * subscription check beyond the one on the tab.
   */
  const capsule = useMemo(() => {
    if (!forecast.data?.length || !canGenerate(wardrobe)) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return buildPackingList({
      wardrobe,
      forecasts: forecast.data,
      startDate: start,
      baseContext: context,
      weights: profileQuery.data?.weights ?? DEFAULT_WEIGHTS,
      // The tapped vibe, not each day's own guess: a wedding trip is a 5 on the
      // Tuesday it rains too, and the number travelled with the chip precisely
      // so it would not have to be re-inferred here.
      formality: formalityFor(trip),
    });
  }, [forecast.data, wardrobe, context, profileQuery.data?.weights, trip]);

  // Nothing to pack from. Kept as its own branch rather than folded into the
  // loading state, because they are opposite claims: one says "wait", the other
  // says "there is nothing here", and the app's whole states discipline is that
  // a screen must never make the second claim while the first is still true.
  const closetTooThin = !wardrobeQuery.isLoading && wardrobe.length === 0;

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const suggested = useMemo(
    () =>
      (brief.data?.parts ?? []).map((part) => ({
        part: part.part,
        note: part.note,
        items: part.itemIds.map((id) => byId.get(id)).filter((i): i is Item => Boolean(i)),
      })),
    [brief.data, byId],
  );

  // One signing request for everything on the page — the grid's thumbs and the
  // suggestion rows' plates. `useSignedUrls` dedupes and sorts, so the grid's
  // paths appearing twice costs nothing.
  const { resolve } = useSignedUrls(
    items.flatMap((i) => [i.platePath, i.cutoutPath, i.thumbPath]),
  );

  /**
   * The shared state components carry their own `px-gutter`, and this header
   * already sits inside `ClosetGrid`'s 20pt content padding — so they land at
   * 40 and every other line on the page at 20. The negative margin cancels the
   * container's padding for exactly those three, leaving them where their own
   * gutter puts them: aligned with everything else.
   */
  const gutterless = '-mx-gutter';

  const header = (
    <View className="pb-2">
      {/* The masthead, in the guide's Plan grammar: caps status label, serif
          name, one spec line of `·` fragments. */}
      <Text variant="eyebrow">Packing</Text>
      <View className="mt-2">
        <Text variant="title" trim>
          {trip.destination.name}
        </Text>
      </View>
      <Text variant="colophon" className="mt-3">
        {tripColophon(trip)}
      </Text>
      <Pressable
        onPress={onStartAgain}
        accessibilityRole="button"
        accessibilityLabel="Answer the packing questions again"
        hitSlop={12}
        className="mt-3 self-start active:opacity-60">
        <Text variant="label" className="underline">
          Start again
        </Text>
      </Pressable>

      {/* ── The read on the place ─────────────────────────────────────────── */}
      <View className="mt-6">
        {closetTooThin ? (
          // The brief query is disabled with nothing to pack from, and a
          // disabled query is `isPending` forever — a skeleton that never
          // resolves. Say the true thing instead.
          <Text variant="body" className="text-muted dark:text-muted-dark">
            Cinch reads a destination against the clothes you own, and there is
            nothing in your closet yet. Add a few pieces and the brief will have
            something to work with.
          </Text>
        ) : brief.isPending ? (
          <View className={gutterless}>
            <ListSkeleton count={3} avatar={false} label={`Reading ${trip.destination.name}…`} />
          </View>
        ) : brief.isError ? (
          <View className={gutterless}>
            <ErrorState
              compact
              {...briefCopy(brief.error)}
              onRetry={() => void brief.refetch()}
              retrying={brief.isRefetching}
            />
          </View>
        ) : brief.data ? (
          <Card padding="xl">
            <Text variant="plate" trim>
              {brief.data.headline}
            </Text>
            {brief.data.spec.length ? (
              <Text variant="colophon" className="mt-3">
                {brief.data.spec.join(' · ')}
              </Text>
            ) : null}
            <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
              {brief.data.observation}
            </Text>
            {brief.data.gaps ? (
              <>
                <View className="my-4">
                  <Rule />
                </View>
                <SectionHeader title="What you don’t have" className="mb-2" />
                <Text variant="body" className="text-muted dark:text-muted-dark">
                  {brief.data.gaps}
                </Text>
              </>
            ) : null}
          </Card>
        ) : null}
      </View>

      {/* ── The day-parts ─────────────────────────────────────────────────── */}
      {suggested.map((part) => (
        <View key={part.part} className="mt-8">
          <SectionHeader title={dayPartOf(part.part).title} />
          <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
            {part.note}
          </Text>
          {part.items.length ? (
            <View className="mt-3">
              {part.items.map((item) => (
                <SuggestionRow key={item.id} item={item} uri={resolve(item.platePath, item.cutoutPath)} />
              ))}
            </View>
          ) : (
            <Text variant="label" className="mt-3">
              Nothing in your closet fits this part of the day yet.
            </Text>
          )}
        </View>
      ))}

      {/* ── The capsule, computed on device ───────────────────────────────── */}
      {capsule ? (
        <Card padding="xl" fill="none" className="mt-8">
          <SectionHeader title="The capsule" />
          <Text variant="statFigure" className="mt-2">
            {capsule.items.length} pieces
          </Text>
          <Text variant="colophon" className="mt-2">
            {trip.days} days · covers every day · nothing worn twice running
          </Text>
          <View className="mt-4 gap-1.5">
            {capsule.items.map(({ garment, days }) => (
              <View key={garment.id} className="flex-row items-baseline gap-2">
                <Text variant="body" className="flex-1" numberOfLines={1}>
                  {`${garment.colors[0]?.name ?? ''} ${garment.subcategory ?? garment.category}`.trim()}
                </Text>
                <Text variant="label">
                  {days === trip.days ? 'every day' : `${days} ${days === 1 ? 'day' : 'days'}`}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {/* ── And then the closet, whichever way the above went ─────────────── */}
      <View className="mt-10 mb-3">
        <SectionHeader title="Your closet" />
        <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
          Everything you own, to add anything the brief missed.
        </Text>
      </View>
    </View>
  );

  return (
    <ClosetGrid
      items={items}
      resolveImage={resolve}
      onItemPress={(item) => router.push(`/item/${item.id}`)}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View className={gutterless}>
          {closet.isError ? (
            <ErrorState
              compact
              onRetry={() => void closet.refetch()}
              retrying={closet.isRefetching}
            />
          ) : closet.isLoading ? (
            <ListSkeleton count={4} avatar={false} />
          ) : (
            // Deliberately NOT a route to the camera. Packing opening the
            // camera is the exact complaint this rebuild answers; the Closet
            // tab is one tap away and owns adding clothes.
            <EmptyState
              compact
              symbol="tshirt"
              title="Nothing to pack yet"
              body="Your closet is empty, so there is nothing for Cinch to choose from. Add a few pieces from the Closet tab and the brief above will have something to point at."
            />
          )}
        </View>
      }
    />
  );
}
