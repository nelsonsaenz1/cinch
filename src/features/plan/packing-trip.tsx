import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { PlateThumb } from '@/components/closet/plate-thumb';
import { Button, EmptyState, ErrorState, ListSkeleton, Rule, SectionHeader, Text } from '@/components/ui';
import { useCloset } from '@/features/closet/queries';
import { stableImageSource, useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast } from '@/features/context/weather';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { DEFAULT_WEIGHTS } from '@/lib/styling';
import type { Item } from '@/schemas/item';
import { GUTTER, useTheme } from '@/theme/tokens';

import { buildPackingList } from './packing';
import { dayPartOf, formalityFor, tripColophon, type Trip } from './trip';
import { usePackingBrief, type PackingBriefError } from './use-packing-brief';

/**
 * A packed trip: the destination read, the day-parts dressed, the closet open.
 *
 * THREE LAYERS, IN THIS ORDER, and the order is the argument.
 *
 *   1. The brief — the only part that costs a model call. The trip's facts in
 *      a caps kicker, then what the place is like: one serif line, a spec line
 *      and one observation, set straight on the page rather than in a card.
 *   2. The capsule and its day-parts — "THE CAPSULE · 11 PIECES" over
 *      mornings, days, nights, each a serif header, a sentence and real
 *      garments out of this closet.
 *   3. The closet itself, whole and browsable, underneath all of it — three
 *      columns of square thumbs, with "Start again" beside its header.
 *
 * Layer 3 renders whatever happens above it. A brief that fails, a function
 * that is not deployed yet, a model that is offline — none of them may take the
 * closet away, because the closet is the thing the user owns and the brief is
 * only an opinion about it. That is why this is one virtualised list with
 * everything else in its header, rather than a scroll view with a grid
 * awkwardly inside: the closet is the page, and the reading sits on top of it.
 */

/**
 * The brief's four failures, each one sitting exactly where the brief would
 * have been: a caps kicker naming the cause, one serif line, one honest body.
 * Only the network case carries a retry — the other three are answered
 * somewhere else, and a button that cannot fix anything is worse than a
 * sentence that says so.
 */
const BRIEF_FAILURES: Record<
  PackingBriefError['kind'],
  { kicker: string; title: string; body: string }
> = {
  consent: {
    kicker: 'Consent',
    title: 'Cinch needs your go-ahead first.',
    body: 'Reading a destination is an AI feature, and AI processing is switched off for your account. Turn it on in Profile and the brief will come through. Your closet below is unaffected.',
  },
  quota: {
    kicker: 'Quota',
    title: 'You’ve used this month’s styling allowance.',
    body: 'Reading a destination draws on the same allowance as the stylist, and yours is spent for now. It comes back when the month rolls over — the capsule and your closet below don’t use it at all.',
  },
  unavailable: {
    kicker: 'Unavailable',
    title: 'The destination brief isn’t live yet.',
    body: 'This part of packing has not been switched on for your build. Everything below still works — the capsule and your closet are read from your own wardrobe, not from a server.',
  },
  offline: {
    kicker: 'Network',
    title: 'The brief didn’t come back.',
    body: 'Cinch couldn’t read this destination just now — a connection problem, not a change to your things. The capsule and your closet below are unaffected.',
  },
};

function BriefFailure({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  const kind = (error as PackingBriefError | null)?.kind ?? 'offline';
  const copy = BRIEF_FAILURES[kind] ?? BRIEF_FAILURES.offline;

  return (
    // `alert`, matching ErrorState: a failure that appears after a wait should
    // be announced, not merely findable by swiping to it.
    <View accessibilityRole="alert">
      <Text variant="eyebrow">{copy.kicker}</Text>
      <View className="mt-2">
        <Text variant="plate" trim>
          {copy.title}
        </Text>
      </View>
      <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
        {copy.body}
      </Text>
      {kind === 'offline' ? (
        <Button
          title="Try again"
          variant="secondary"
          onPress={onRetry}
          loading={retrying}
          haptic
          className="mt-4 self-start px-6"
        />
      ) : null}
    </View>
  );
}

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
      <PlateThumb item={item} uri={uri} size={44} radius={8} showFallbackLabel={false} />
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
  const theme = useTheme();

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

  /**
   * The capsule's own pieces, as closet Items, for the days the brief cannot
   * speak. The day-part sections are the capsule's dressed presentation, but
   * they are written by the brief — and the brief failing must not empty the
   * capsule layer (the failure copy above points at it by name). So while the
   * brief is out, the capsule lists its pieces plainly, with the day counts
   * the engine computed.
   */
  const capsuleRows = useMemo(
    () =>
      (capsule?.items ?? [])
        .map(({ garment, days }) => ({ item: byId.get(garment.id), days }))
        .filter((r): r is { item: Item; days: number } => Boolean(r.item)),
    [capsule, byId],
  );

  // One signing request for everything on the page — the grid's thumbs and the
  // suggestion rows' plates. `useSignedUrls` dedupes and sorts, so the grid's
  // paths appearing twice costs nothing.
  const { resolve } = useSignedUrls(
    items.flatMap((i) => [i.platePath, i.cutoutPath, i.thumbPath]),
  );

  /**
   * The shared state components carry their own `px-gutter`, and this header
   * already sits inside the list's content padding — so they land at 40 and
   * every other line on the page at 20. The negative margin cancels the
   * container's padding for exactly those, leaving them where their own
   * gutter puts them: aligned with everything else.
   *
   * The list's own padding is `GUTTER - 4` (see the container style: the grid
   * cells wear a p-1 of their own), so the header and the empty state each
   * carry a `px-1` shim that puts their text back on the 20pt gutter line —
   * and this margin plus that shim is what re-zeroes the shared states.
   */
  const gutterless = '-mx-gutter';

  // Whether anything stands between the brief and the closet. Guards the
  // second rule: two rules with nothing between them read as a printing error.
  const hasMiddle = Boolean(capsule) || suggested.length > 0;

  const header = (
    <View className="px-1 pb-2">
      {/* The masthead, in the guide's Plan grammar: the trip's facts as a caps
          kicker — LISBON · 5 DAYS · CITY BREAK — because the serif line below
          belongs to the brief's read of the place, not the place name. */}
      <Text variant="eyebrow">{tripColophon(trip)}</Text>

      {/* ── The read on the place ─────────────────────────────────────────── */}
      <View className="mt-2">
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
          <BriefFailure
            error={brief.error}
            onRetry={() => void brief.refetch()}
            retrying={brief.isRefetching}
          />
        ) : brief.data ? (
          <>
            <Text variant="title" trim>
              {brief.data.headline}
            </Text>
            {brief.data.spec.length ? (
              // Sentence case, not the tracked colophon: the atlas sets this
              // meta line — "Feels 68–79° · Light rain Tue" — as quiet prose
              // under the headline, a caption rather than a data stamp.
              <Text variant="label" className="mt-3">
                {brief.data.spec.join(' · ')}
              </Text>
            ) : null}
            <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
              {brief.data.observation}
            </Text>
            {brief.data.gaps ? (
              <>
                <SectionHeader title="What you don’t have" className="mt-4 mb-2" />
                <Text variant="body" className="text-muted dark:text-muted-dark">
                  {brief.data.gaps}
                </Text>
              </>
            ) : null}
          </>
        ) : null}
      </View>

      {hasMiddle ? (
        <View className="mt-6">
          <Rule />
        </View>
      ) : null}

      {/* ── The capsule, computed on device ───────────────────────────────── */}
      {capsule ? (
        <View className="mt-4">
          <SectionHeader
            title={`The capsule · ${capsule.items.length} ${capsule.items.length === 1 ? 'piece' : 'pieces'}`}
          />
          <Text variant="label" className="mt-1.5">
            The smallest set that still gives a different outfit each day,
            computed from your closet and the forecast — no model, no network.
          </Text>
        </View>
      ) : null}

      {/* ── The day-parts — the capsule dressed, in the brief's voice ─────── */}
      {suggested.map((part) => (
        <View key={part.part} className="mt-6">
          <Text variant="plate" trim>
            {dayPartOf(part.part).title}
          </Text>
          <Text variant="label" className="mt-2">
            {part.note}
          </Text>
          {part.items.length ? (
            <View className="mt-2">
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

      {/* While the brief is out — pending, or one of its four failures — the
          capsule layer still shows its pieces, so the promise the failure copy
          makes ("the capsule below is unaffected") is kept in pixels. */}
      {capsule && suggested.length === 0 ? (
        <View className="mt-3">
          {capsuleRows.map(({ item, days }) => (
            <View key={item.id} className="flex-row items-center gap-2">
              <View className="flex-1">
                <SuggestionRow item={item} uri={resolve(item.platePath, item.cutoutPath)} />
              </View>
              <Text variant="label">
                {days === trip.days ? 'every day' : `${days} ${days === 1 ? 'day' : 'days'}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── And then the closet, whichever way the above went ─────────────── */}
      <View className="mt-8">
        <Rule />
      </View>
      <View className="mt-4 mb-3">
        <SectionHeader
          title="Your closet"
          trailing={
            /* The way back through the questions lives beside the layer it
               resets — an oxblood link, not a second button. Inline colour,
               never a second `text-*` class: NativeWind gives no precedence
               between two of them on one element (chip.tsx L40-44). */
            <Pressable
              onPress={onStartAgain}
              accessibilityRole="button"
              accessibilityLabel="Answer the packing questions again"
              hitSlop={12}
              className="active:opacity-60">
              <Text variant="label" style={{ color: theme.accent }}>
                Start again
              </Text>
            </Pressable>
          }
        />
      </View>
    </View>
  );

  return (
    /*
     * The closet layer is its own three-column grid of square thumbs, per the
     * atlas, rather than the Closet tab's two-column `ItemCard` grid: down
     * here the closet is a reference shelf under the reading, not the page of
     * record — names, prices and wear counts are one tap away on the piece.
     */
    <FlashList
      data={items}
      numColumns={3}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const uri = resolve(item.thumbPath, item.cutoutPath);
        return (
          <Pressable
            onPress={() => router.push(`/item/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={[item.colors[0]?.name, item.subcategory ?? item.category]
              .filter(Boolean)
              .join(' ')}
            className="p-1 active:opacity-60"
            style={{ flex: 1 }}>
            <View
              className="w-full overflow-hidden rounded border border-hairline bg-tray dark:border-hairline-dark dark:bg-tray-dark"
              style={{ aspectRatio: 1 }}>
              {uri ? (
                <Image
                  source={stableImageSource(uri)}
                  recyclingKey={item.id}
                  contentFit="cover"
                  transition={180}
                  cachePolicy="memory-disk"
                  style={{ flex: 1 }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                // No render yet — the honest swatch, same rule as PlateThumb:
                // the garment's tagged colour when it has one, the bare tray
                // when it does not, never a broken-image glyph.
                <View
                  style={{ flex: 1, backgroundColor: item.colors[0]?.hex ?? undefined }}
                />
              )}
            </View>
          </Pressable>
        );
      }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View className={`${gutterless} px-1`}>
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
      // Plain style, deliberately: FlashList is not wrapped by NativeWind, so
      // a contentContainerClassName here is silently dropped. `GUTTER` is the
      // measure `px-gutter` gives every other page; the extra 4 backs out the
      // cells' own p-1 so the grid's edges sit on the gutter line. 96 = pb-24.
      contentContainerStyle={{ paddingHorizontal: GUTTER - 4, paddingBottom: 96 }}
      ItemSeparatorComponent={() => <View className="h-1" />}
      showsVerticalScrollIndicator={false}
    />
  );
}
