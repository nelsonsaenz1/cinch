import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { buildPackingList, type PackingResult } from '@/features/plan/packing';
import { firstUnfilledPart, shortfallSentence } from '@/features/plan/packing-memo';
import { lookSchedule } from '@/features/plan/packing-math';
import { addDays, formalityForPart, toIsoDate, type Trip } from '@/features/plan/trip';
import {
  ForecastHorizonFailure,
  PackingMemo,
  ResearchSteps,
  ShortfallFailure,
  type PackingMemoBriefState,
  type ResearchStep,
} from '@/features/plan/packing-trip';
import { resolveColorName } from '@/lib/color';
import { DEFAULT_WEIGHTS, type Garment, type StyleContext, type WeatherContext } from '@/lib/styling';
import { PackingBriefError } from '@/features/plan/use-packing-brief';
import type { Item } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

/**
 * DEV ONLY — K-04, K-05 and all four K-06 failures, switchable, with no
 * network and no auth. "Any state without a dev route is a state nobody has
 * looked at" — six waves of this project have shipped an invisible button
 * that a real screen never exercised, so every branch below is the actual
 * exported component `packing-trip.tsx` renders, fed fixtures rather than
 * live hooks — the same trick `dev-share.tsx` plays on `PlateCard`.
 *
 * No dynamic `require()` of any asset here, and no image at all: every
 * fixture below resolves through `resolveImage={() => undefined}`, so this
 * route sidesteps both traps the last wave's notes warn about (the crash on
 * a templated `require`, and every fixture rendering the same cached
 * picture) by never asking for a photograph in the first place.
 */

const g = (
  id: string,
  slot: Garment['slot'],
  colorName: string,
  category: string,
  subcategory: string,
  formality: number,
  warmth: number,
): Garment =>
  ({
    id,
    slot,
    category,
    subcategory,
    colors: [{ name: colorName, oklch: resolveColorName(colorName)!, family: 'neutral', neutrality: 0.5, metallic: false, weight: 1 }],
    visualWeight: 1,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality,
    warmth,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 4,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: null,
    cutoutPath: null,
    platePath: null,
  }) as unknown as Garment;

const GOOD_WARDROBE: Garment[] = [
  g('p1', 'base_top', 'white', 'top', 'linen blouse', 3, 2),
  g('p2', 'base_top', 'black', 'top', 'striped tee', 2, 2),
  g('p3', 'mid_layer', 'cream', 'top', 'mohair sweater', 3, 4),
  g('p4', 'bottom', 'charcoal', 'bottom', 'tailored trousers', 3, 3),
  g('p5', 'bottom', 'sand', 'bottom', 'cord skirt', 3, 3),
  g('p6', 'dress', 'black', 'dress', 'slip dress', 4, 2),
  g('p7', 'footwear', 'brown', 'shoes', 'loafers', 3, 3),
  g('p8', 'footwear', 'black', 'shoes', 'sandals', 2, 1),
  g('p9', 'outerwear', 'navy', 'outerwear', 'trench coat', 3, 3),
  g('p10', 'accessory', 'burgundy', 'accessory', 'scarf', 3, 2),
];

/** Below `MIN_CLOSET_FOR_OUTFITS` — the honest "closet too thin" case. */
const THIN_WARDROBE: Garment[] = GOOD_WARDROBE.slice(0, 3);

const PLACE = { name: 'Lisbon', country: 'Portugal', admin1: '', latitude: 38.72, longitude: -9.14 };

const NEAR_FUTURE_START = addDays(toIsoDate(new Date()), 5);
const NEAR_FUTURE_END = addDays(NEAR_FUTURE_START, 3);

const FAR_FUTURE_START = addDays(toIsoDate(new Date()), 60);
const FAR_FUTURE_END = addDays(FAR_FUTURE_START, 3);

const FIXTURE_TRIP: Trip = {
  destination: PLACE,
  companions: 'partner',
  friendIds: [],
  friendNames: [],
  startsOn: NEAR_FUTURE_START,
  endsOn: NEAR_FUTURE_END,
  vibes: ['warm-city', 'long-dinners'],
  parts: ['daytime', 'evening'],
};

const FIXTURE_TRIP_FAR: Trip = { ...FIXTURE_TRIP, startsOn: FAR_FUTURE_START, endsOn: FAR_FUTURE_END };

const FIXTURE_FORECASTS: WeatherContext[] = [24, 27, 19, 22].map((feelsLikeC, i) => ({
  feelsLikeC,
  highC: feelsLikeC + 4,
  lowC: feelsLikeC - 6,
  precipitationChance: i === 2 ? 0.6 : 0.1,
  windKph: 10,
  swing: true,
}));

const FIXTURE_CONTEXT: StyleContext = {
  weather: null,
  events: [],
  note: null,
  targetFormality: null,
  targetOccasion: null,
  season: null,
  colorSeason: null,
  now: Date.parse(`${NEAR_FUTURE_START}T12:00:00`),
};

function buildFixturePacking(wardrobe: Garment[], trip: Trip): PackingResult {
  return buildPackingList({
    wardrobe,
    schedule: lookSchedule(trip.startsOn, 4, trip.parts),
    forecasts: FIXTURE_FORECASTS,
    baseContext: FIXTURE_CONTEXT,
    weights: DEFAULT_WEIGHTS,
    formalityForPart: (part) => formalityForPart(trip, part),
  });
}

const GOOD_PACKING = buildFixturePacking(GOOD_WARDROBE, FIXTURE_TRIP);
const THIN_PACKING = buildFixturePacking(THIN_WARDROBE, FIXTURE_TRIP);

const BRIEF_OK: PackingMemoBriefState = {
  isPending: false,
  isError: false,
  isRefetching: false,
  data: {
    observation:
      "It's warm until it isn't — the evenings drop and Sunday brings rain. The linen blouse does three of your four dinners, and the loafers stay on your feet on the plane.",
  },
  error: null,
  refetch: () => {},
};

const BRIEF_FAILED: PackingMemoBriefState = {
  isPending: false,
  isError: true,
  isRefetching: false,
  data: undefined,
  error: new PackingBriefError('The brief did not come back.', 'offline'),
  refetch: () => {},
};

const RESEARCH_EARLY: ResearchStep[] = [
  { key: 'forecast', title: 'Forecast pulled', detail: '19–27°C, one wet day.', done: true },
  { key: 'closet', title: 'Closet read', detail: '10 pieces, 7 of them right for this weather.', done: true },
  { key: 'looks', title: 'Building eight looks', detail: null, done: false },
  { key: 'memo', title: 'Writing the memo', detail: null, done: false },
];

const RESEARCH_LATE: ResearchStep[] = [
  ...RESEARCH_EARLY.slice(0, 2),
  { key: 'looks', title: 'Building eight looks', detail: '6 pieces carry every look, repeats counted so the bag stays small.', done: true },
  { key: 'memo', title: 'Writing the memo', detail: null, done: false },
];

type Mode = 'k04-early' | 'k04-late' | 'k05' | 'f1' | 'f2' | 'f3' | 'f4';

const MODES: { key: Mode; label: string }[] = [
  { key: 'k04-early', label: 'K-04 · early' },
  { key: 'k04-late', label: 'K-04 · late' },
  { key: 'k05', label: 'K-05 · memo' },
  { key: 'f1', label: 'K-06 · no forecast' },
  { key: 'f2', label: 'K-06 · closet thin' },
  { key: 'f3', label: 'K-06 · membership' },
  { key: 'f4', label: 'K-06 · memo failed' },
];

function Switcher({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-gutter pb-3">
      {MODES.map((m) => (
        <Pressable
          key={m.key}
          onPress={() => onChange(m.key)}
          className="rounded-full border px-3.5 py-2"
          style={{ borderColor: mode === m.key ? theme.ink : theme.rule }}>
          <Text variant="label" style={{ color: mode === m.key ? theme.ink : theme.muted }}>
            {m.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function DevPackingMemoScreen() {
  const [mode, setMode] = useState<Mode>('k05');
  // Hooks run unconditionally, before the `__DEV__` early return below —
  // `__DEV__` is a build-time constant so this never actually changes shape
  // between renders, but `react-hooks/rules-of-hooks` cannot know that.
  const byId = useMemo(() => new Map<string, Item>(), []);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const noop = () => {};

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="px-gutter pt-2 pb-1">
        <Text variant="eyebrow">Packing · K-04, K-05, K-06</Text>
      </View>
      <Switcher mode={mode} onChange={setMode} />

      {mode === 'k04-early' ? (
        <ResearchSteps steps={RESEARCH_EARLY} colophon="LISBON · 4 DAYS · WARM CITY" days={4} />
      ) : null}

      {mode === 'k04-late' ? (
        <ResearchSteps steps={RESEARCH_LATE} colophon="LISBON · 4 DAYS · WARM CITY" days={4} />
      ) : null}

      {mode === 'k05' ? (
        <PackingMemo
          trip={FIXTURE_TRIP}
          days={4}
          packing={GOOD_PACKING}
          brief={BRIEF_OK}
          byId={byId}
          resolve={() => undefined}
          membershipUnconfirmed={false}
          hasLastList={false}
          membershipRetrying={false}
          onOpenLastList={noop}
          onRetryMembership={noop}
          savedNotice={false}
          onSaveToPlan={noop}
          savingToPlan={false}
          onSwapDay={noop}
          onShare={noop}
          shareMounted={false}
          shareViewRef={{ current: null }}
          onCardReady={noop}
        />
      ) : null}

      {mode === 'f1' ? (
        <ForecastHorizonFailure
          placeName={FIXTURE_TRIP_FAR.destination.name}
          monthName="September"
          normalsLine="No real forecast yet — this is what Lisbon is normally like in September: 18–27°C."
          normalsLoading={false}
          onPackAnyway={noop}
          onSaveAndRevise={noop}
          saving={false}
        />
      ) : null}

      {mode === 'f2' ? (
        <ShortfallFailure
          sentence={shortfallSentence(
            lookSchedule(FIXTURE_TRIP.startsOn, 4, FIXTURE_TRIP.parts).length,
            THIN_PACKING.unfilled,
            firstUnfilledPart(THIN_PACKING.looks),
          )}
          onShow={noop}
        />
      ) : null}

      {mode === 'f3' ? (
        <PackingMemo
          trip={FIXTURE_TRIP}
          days={4}
          packing={GOOD_PACKING}
          brief={BRIEF_OK}
          byId={byId}
          resolve={() => undefined}
          membershipUnconfirmed
          hasLastList
          membershipRetrying={false}
          onOpenLastList={noop}
          onRetryMembership={noop}
          savedNotice={false}
          onSaveToPlan={noop}
          savingToPlan={false}
          onSwapDay={noop}
          onShare={noop}
          shareMounted={false}
          shareViewRef={{ current: null }}
          onCardReady={noop}
        />
      ) : null}

      {mode === 'f4' ? (
        <PackingMemo
          trip={FIXTURE_TRIP}
          days={4}
          packing={GOOD_PACKING}
          brief={BRIEF_FAILED}
          byId={byId}
          resolve={() => undefined}
          membershipUnconfirmed={false}
          hasLastList={false}
          membershipRetrying={false}
          onOpenLastList={noop}
          onRetryMembership={noop}
          savedNotice={false}
          onSaveToPlan={noop}
          savingToPlan={false}
          onSwapDay={noop}
          onShare={noop}
          shareMounted={false}
          shareViewRef={{ current: null }}
          onCardReady={noop}
        />
      ) : null}
    </SafeAreaView>
  );
}
