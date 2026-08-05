import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayRow } from '@/components/plan/day-row';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { type PlannedDay } from '@/features/plan/packing';
import { hexToOklch } from '@/lib/color';
import {
  type FeatureVector,
  type Garment,
  type OutfitCandidate,
  type WeatherContext,
} from '@/lib/styling';
import { dateKey } from '@/lib/date';

/**
 * Plan fixture — `cinch://dev-plan`.
 *
 * Mirrors (tabs)/plan.tsx's week view — the "This week" header, the accent
 * rule, and the DayRow list — with six hardcoded days so it can be judged
 * signed-out: five distinct weather glyphs (rain, overcast, sun, wind, cold),
 * six different palettes, and six different outfits. Renders the real DayRow
 * component fed mock data, rather than redrawing its look — this is the same
 * list plan.tsx renders for a real week, minus the planner and forecast
 * queries. No `onPlan` handler is passed, matching the static (non-editable)
 * state the handoff shows.
 *
 * Dev-only, like dev-closet and dev-screens: __DEV__-gated by the `dev-`
 * route prefix in the auth gate.
 */

const FEATURES: FeatureVector = {
  palette: 0.8,
  formality: 0.7,
  weather: 0.85,
  occasion: 0.6,
  proportion: 0.75,
  pattern: 0.9,
  season: 0.7,
  freshness: 0.8,
  affinity: 0.75,
};

function garment(
  id: string,
  slot: Garment['slot'],
  category: Garment['category'],
  subcategory: string,
  hex: string,
): Garment {
  return {
    id,
    slot,
    category,
    subcategory,
    colors: [
      {
        oklch: hexToOklch(hex) ?? { L: 0.5, C: 0, h: 0 },
        name: subcategory,
        family: 'neutral',
        neutrality: 1,
        metallic: false,
        weight: 1,
      },
    ],
    visualWeight: 0.3,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 0,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: null,
    cutoutPath: null,
    platePath: null,
  };
}

function outfit(items: Garment[], notes: OutfitCandidate['notes']): OutfitCandidate {
  return { items, features: FEATURES, score: 0.8, notes, harmonies: [] };
}

function weather(feelsLikeC: number, precipitationChance: number, windKph: number): WeatherContext {
  return {
    feelsLikeC,
    highC: feelsLikeC + 3,
    lowC: feelsLikeC - 3,
    precipitationChance,
    windKph,
    swing: false,
  };
}

// Monday of the current week — just a stable anchor for six consecutive dates.
const monday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const dayAt = (offset: number) => {
  const d = monday();
  d.setDate(d.getDate() + offset);
  return d;
};

const DAYS: PlannedDay[] = [
  {
    date: dayAt(0),
    weather: weather(12, 0.6, 12), // rain
    outfit: outfit(
      [
        garment('mon-1', 'outerwear', 'outerwear', 'Wool coat', '#3A3A38'),
        garment('mon-2', 'base_top', 'top', 'Cotton shirt', '#E3DBCB'),
        garment('mon-3', 'footwear', 'footwear', 'Suede boots', '#8A94A0'),
      ],
      { weather: 'blocks the morning rain', formality: 'sharp enough for back-to-back meetings' },
    ),
  },
  {
    date: dayAt(1),
    weather: weather(15, 0.3, 10), // overcast
    outfit: outfit(
      [
        garment('tue-1', 'outerwear', 'outerwear', 'Camel overshirt', '#B08A76'),
        garment('tue-2', 'base_top', 'top', 'Cream knit', '#F2EEE6'),
        garment('tue-3', 'bottom', 'bottom', 'Indigo jeans', '#6E7C8C'),
      ],
      {
        weather: 'light enough for a mild, free evening',
        freshness: 'first outing this week for the camel overshirt',
      },
    ),
  },
  {
    date: dayAt(2),
    weather: weather(26, 0.05, 8), // sun
    outfit: outfit(
      [
        garment('wed-1', 'base_top', 'top', 'Linen shirt', '#C9BBA6'),
        garment('wed-2', 'bottom', 'bottom', 'Ivory trousers', '#F2EEE6'),
        garment('wed-3', 'footwear', 'footwear', 'Suede loafers', '#D8D2C4'),
      ],
      {
        weather: 'breathable linen for the warmest day this week',
        palette: 'sand and ivory stay easy outdoors',
      },
    ),
  },
  {
    date: dayAt(3),
    weather: weather(15, 0.1, 30), // wind
    outfit: outfit(
      [
        garment('thu-1', 'outerwear', 'outerwear', 'Slate blazer', '#8A94A0'),
        garment('thu-2', 'base_top', 'top', 'Cream blouse', '#E3DBCB'),
        garment('thu-3', 'bottom', 'bottom', 'Walnut trousers', '#4A3B31'),
      ],
      {
        weather: 'holds up against the wind picking up today',
        palette: 'slate and cream stay quiet for the office',
      },
    ),
  },
  {
    date: dayAt(4),
    weather: weather(2, 0.05, 14), // cold
    outfit: outfit(
      [
        garment('fri-1', 'outerwear', 'outerwear', 'Charcoal jacket', '#3A3A38'),
        garment('fri-2', 'base_top', 'top', 'Oxblood sweater', '#7A2E2A'),
        garment('fri-3', 'bottom', 'bottom', 'Indigo denim', '#6E7C8C'),
      ],
      {
        weather: 'warm enough once the evening chill sets in',
        palette: 'oxblood carries the look from desk to drinks',
      },
    ),
  },
  {
    date: dayAt(5),
    weather: weather(18, 0.1, 10), // mild / default
    outfit: outfit(
      [
        garment('sat-1', 'base_top', 'top', 'Ivory tee', '#F2EEE6'),
        garment('sat-2', 'bottom', 'bottom', 'Denim jeans', '#6E7C8C'),
        garment('sat-3', 'footwear', 'footwear', 'Taupe sneakers', '#D8D2C4'),
      ],
      { weather: 'light layers for an open, easy Saturday', affinity: 'a pairing you keep coming back to' },
    ),
  },
];

const weekRangeLabel = (() => {
  const start = DAYS[0]!.date;
  const end = DAYS[DAYS.length - 1]!.date;
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${month(start)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
})();

export default function DevPlanScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="px-gutter pb-3 pt-2">
        <Text variant="display">Plan</Text>
      </View>

      <View className="mb-4 flex-row gap-2 px-gutter">
        <Chip label="This week" selected />
        <Chip label="Packing" />
      </View>

      <ScrollView contentContainerClassName="pb-10">
        <View className="mb-1 flex-row items-baseline justify-between px-gutter">
          <Text variant="title">This week</Text>
          <Text variant="label" className="text-faint dark:text-faint-dark">
            {weekRangeLabel}
          </Text>
        </View>
        <Text variant="label" className="mb-5 px-gutter text-accent dark:text-accent-dark">
          No piece worn more than twice
        </Text>

        {DAYS.map((day, i) => (
          <DayRow
            key={dateKey(day.date)}
            day={day}
            resolveImage={() => undefined}
            isLast={i === DAYS.length - 1}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
