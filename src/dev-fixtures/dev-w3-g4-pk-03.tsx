import { useMemo } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { buildPackingList, type PackingResult } from '@/features/plan/packing';
import { lookSchedule } from '@/features/plan/packing-math';
import { PackingMemo } from '@/features/plan/packing-trip';
import { formalityForPart, type Trip } from '@/features/plan/trip';
import { G } from '@/features/plan/w3-g4-fixtures';
import { DEFAULT_WEIGHTS, type StyleContext, type WeatherContext } from '@/lib/styling';
import type { Item } from '@/schemas/item';

/**
 * PK-03 — the memo: prose, bag, days.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 81 — EVERY PACKED PIECE IS ITS OWN PHOTOGRAPH, at 92pt in the bag and
 *   reused at 32pt in the itinerary rows, so the bag and the days are visibly
 *   the same garments rather than two abstract systems. The colour-square
 *   fallback is gone entirely; a piece with no picture draws the silhouette,
 *   which at least has the right shape.
 * · audit 82 — prose, bag, days IN THAT ORDER, with the vertical gaps between
 *   the three blocks at 20 rather than 28, and the counts living ON the pieces
 *   as a paper chip at the foot of each rather than in a summary strip. That
 *   removes a whole row of numbers.
 * · The unit on each chip is DERIVED from the parts of the day the piece is
 *   packed for — nights when every look it is in is an evening, days when none
 *   is, looks when it is both. The departure shoe reads "Worn", exactly as the
 *   directive allows, because it never enters the bag.
 * · The pieces that need no count are NAMED IN PROSE under the grid instead of
 *   padding it with a chip that says "1".
 * · COST-PER-WEAR IS ABSENT. Not one packed piece in this fixture carries a
 *   price, so the fragment is dropped — never estimated, never a dash. That is
 *   `bagHeaderLine`'s standing rule, not a decision taken on this frame.
 *
 * DETERMINISM: the bag is built by the REAL `buildPackingList` over a frozen
 * wardrobe, a frozen schedule and a frozen four-day forecast, with `now` pinned
 * to a literal instant in the context. The prose is a fixture string standing
 * in for the model's one paragraph — the only thing on the memo that comes from
 * a model, and the only thing that could not be frozen any other way.
 */

const TRIP: Trip = {
  destination: {
    name: 'Lisbon',
    country: 'Portugal',
    admin1: 'Lisbon',
    latitude: 38.72,
    longitude: -9.14,
  },
  companions: 'partner',
  friendIds: [],
  friendNames: [],
  startsOn: '2026-09-09',
  endsOn: '2026-09-12',
  vibes: ['warm-city', 'long-dinners'],
  parts: ['daytime', 'evening'],
};

const FORECASTS: WeatherContext[] = [24, 27, 19, 22].map((feelsLikeC, i) => ({
  feelsLikeC,
  highC: feelsLikeC + 4,
  lowC: feelsLikeC - 6,
  precipitationChance: i === 2 ? 0.6 : 0.1,
  windKph: 10,
  swing: true,
}));

const CONTEXT: StyleContext = {
  weather: null,
  events: [],
  note: null,
  targetFormality: null,
  targetOccasion: null,
  season: null,
  colorSeason: null,
  // A literal, not `Date.now()` — the packing search reads `now` for freshness.
  now: Date.parse('2026-09-09T12:00:00'),
};

const WARDROBE = [
  G.blouse,
  G.crewneck,
  G.mohair,
  G.trousers,
  G.skirt,
  G.jeans,
  G.boots,
  G.loafers,
  G.overshirt,
  G.crossbody,
];

export default function DevW3G4PK03() {
  // Hooks run before the `__DEV__` early return: `__DEV__` is a build-time
  // constant so the shape never actually changes, but the lint rule cannot
  // know that.
  const byId = useMemo(() => new Map<string, Item>(), []);
  const packing = useMemo<PackingResult>(
    () =>
      buildPackingList({
        wardrobe: WARDROBE,
        schedule: lookSchedule(TRIP.startsOn, 4, TRIP.parts),
        forecasts: FORECASTS,
        baseContext: CONTEXT,
        weights: DEFAULT_WEIGHTS,
        formalityForPart: (part) => formalityForPart(TRIP, part),
      }),
    [],
  );

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const noop = () => {};

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-1">
        <PackingMemo
          trip={TRIP}
          days={4}
          packing={packing}
          mark="24°/13°"
          byId={byId}
          // Every fixture garment carries its asset URI in all three path
          // fields, so the resolver is the identity of the first non-empty one
          // — no signing request and no network.
          resolve={(...paths) =>
            paths.find((p): p is string => typeof p === 'string' && p.length > 0)
          }
          membershipUnconfirmed={false}
          hasLastList={false}
          membershipRetrying={false}
          onOpenLastList={noop}
          onRetryMembership={noop}
          onSwapDay={noop}
          onShare={noop}
          shareMounted={false}
          shareViewRef={{ current: null }}
          onCardReady={noop}
        />
      </View>
    </SafeAreaView>
  );
}
