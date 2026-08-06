import { Image } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { formatTemp } from '@/features/context/weather';
import { dayLabel, shortDate, type PlannedDay } from '@/features/plan/packing';
import { oklchToHex } from '@/lib/color';
import { explain, type Garment, type WeatherContext } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

/**
 * One SF Symbol per day. There is no separate "condition" field in the
 * forecast — precipitation, wind and apparent temperature are all this has to
 * read from — so these thresholds mirror `symbolFor` on the Today tab's
 * WeatherStrip exactly, rather than inventing a second interpretation of the
 * same numbers.
 */
const weatherSymbol = (w: WeatherContext): SFSymbol => {
  if (w.precipitationChance >= 0.5) return 'cloud.rain';
  if (w.precipitationChance >= 0.25) return 'cloud.sun';
  if (w.windKph >= 25) return 'wind';
  if (w.feelsLikeC >= 24) return 'sun.max';
  if (w.feelsLikeC <= 4) return 'snowflake';
  return 'cloud.sun';
};

export function DayRow({
  day,
  resolveImage,
  onPlan,
  planned,
  planning,
  isLast,
  units = 'F',
}: {
  day: PlannedDay;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onPlan?: () => void;
  planned?: boolean;
  planning?: boolean;
  /** Suppresses the row's bottom hairline for the last row in a list. */
  isLast?: boolean;
  units?: 'C' | 'F';
}) {
  const theme = useTheme();
  const pieces = [...(day.outfit?.items ?? [])].sort(
    (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
  );

  // The three (or fewer) garments the swatch cluster is drawn from — the same
  // slice the name line below reads from, so the two never disagree.
  const swatchPieces = pieces.slice(0, 3);

  // The week planner never names its outfits (that prose is generated
  // per-day on the Today tab, not for seven days at once), so this reuses
  // real, already-scored facts rather than inventing a title: the piece list
  // stands in for a name, and `explain` — the same sentence shown as
  // "reasoning" on the Today plate — stands in for the day's context.
  // Capitalized to the approved frames' register ("Shirt · Skirt · Loafer"),
  // matching the Today plate's labelFor — lowercase reads as debug output.
  const name = pieces
    .map((g) => {
      const s = g.subcategory ?? g.category;
      return s.charAt(0).toUpperCase() + s.slice(1);
    })
    .join(' · ');
  const reasoning = day.outfit ? explain(day.outfit) : null;

  const a11yLabel = [
    `${dayLabel(day.date)}, ${shortDate(day.date)}`,
    day.weather ? formatTemp(day.weather.feelsLikeC, units) : null,
    day.outfit ? name : "Nothing in your closet works for this day's weather yet.",
    reasoning,
    onPlan ? (planned ? 'Already planned' : 'Plan this outfit') : null,
  ]
    .filter(Boolean)
    .join('. ');

  const containerClassName = [
    'flex-row items-center gap-3.5 px-gutter py-5',
    isLast ? '' : 'border-b border-hairline dark:border-hairline-dark',
    onPlan ? 'active:opacity-60' : '',
  ].join(' ');

  const trailing = onPlan ? (
    planning ? (
      <ActivityIndicator size="small" color={theme.muted} />
    ) : planned ? (
      <SymbolView
        name="checkmark.circle.fill"
        size={16}
        tintColor={theme.accent}
        resizeMode="scaleAspectFit"
      />
    ) : null
  ) : null;

  const rowContent = (
    <>
      <View style={{ width: 42 }}>
        <Text variant="stat">{day.date.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
        {day.weather ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Text variant="caption">{formatTemp(day.weather.feelsLikeC, units)}</Text>
            <SymbolView
              name={weatherSymbol(day.weather)}
              size={10}
              tintColor={theme.faint}
              resizeMode="scaleAspectFit"
            />
          </View>
        ) : null}
      </View>

      {swatchPieces.length ? (
        <View className="flex-row gap-1">
          {swatchPieces.map((g) => {
            // Colour is what the design calls for — a garment is only drawn
            // as a photo when it somehow has no colour tagged at all.
            const hex = g.colors[0] ? oklchToHex(g.colors[0].oklch) : undefined;
            const uri = hex ? undefined : resolveImage(g.cutoutPath, g.thumbPath);
            return (
              <View
                key={g.id}
                className="h-4 w-4 overflow-hidden rounded-sm bg-tray dark:bg-tray-dark">
                {hex ? (
                  <View style={{ flex: 1, backgroundColor: hex }} />
                ) : uri ? (
                  <Image
                    source={stableImageSource(uri)}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <View className="flex-1">
        {day.outfit ? (
          <>
            <Text variant="callout" numberOfLines={1}>
              {name}
            </Text>
            {reasoning ? (
              <Text variant="caption" numberOfLines={1} className="mt-0.5">
                {reasoning}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="caption">Nothing in your closet works for this day&rsquo;s weather yet.</Text>
        )}
      </View>

      {trailing}
    </>
  );

  return onPlan ? (
    <Pressable
      onPress={onPlan}
      disabled={planning}
      accessibilityRole="button"
      accessibilityState={{ disabled: planning, selected: Boolean(planned) }}
      accessibilityLabel={a11yLabel}
      className={containerClassName}>
      {rowContent}
    </Pressable>
  ) : (
    <View accessibilityLabel={a11yLabel} className={containerClassName}>
      {rowContent}
    </View>
  );
}
