import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatTemp } from '@/features/context/weather';
import { dayLabel, shortDate, type PlannedDay } from '@/features/plan/packing';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

export function DayRow({
  day,
  resolveImage,
  onPlan,
  planned,
  planning,
  units = 'F',
}: {
  day: PlannedDay;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onPlan?: () => void;
  planned?: boolean;
  planning?: boolean;
  units?: 'C' | 'F';
}) {
  const theme = useTheme();
  const pieces = [...(day.outfit?.items ?? [])].sort(
    (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
  );

  return (
    <View className="mb-5 px-gutter">
      <View className="mb-2 flex-row items-baseline gap-2">
        <Text variant="heading">{dayLabel(day.date)}</Text>
        <Text variant="label">{shortDate(day.date)}</Text>
        <View className="flex-1" />
        {day.weather ? (
          <View className="flex-row items-center gap-1.5">
            {day.weather.precipitationChance >= 0.4 ? (
              <SymbolView
                name="cloud.rain"
                size={13}
                tintColor={theme.muted}
                resizeMode="scaleAspectFit"
              />
            ) : null}
            <Text variant="stat" className="text-label">
              {formatTemp(day.weather.highC, units)}
              <Text variant="label"> / {formatTemp(day.weather.lowC, units)}</Text>
            </Text>
          </View>
        ) : null}
      </View>

      {day.outfit ? (
        <>
          <View
            className="flex-row gap-1 overflow-hidden rounded-card bg-tray p-2 dark:bg-tray-dark"
            style={{ height: 110 }}
            accessibilityLabel={pieces
              .map((g) => `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim())
              .join(', ')}>
            {pieces.map((g) => {
              const uri = resolveImage(g.cutoutPath, g.thumbPath);
              return (
                <View
                  key={g.id}
                  style={{ flexGrow: g.visualWeight, flexShrink: 1, flexBasis: 0 }}
                  className="items-center justify-center">
                  {uri ? (
                    <Image
                      source={uri}
                      contentFit="contain"
                      transition={150}
                      cachePolicy="memory-disk"
                      style={{ width: '100%', height: '100%' }}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View
                      className="h-full w-full rounded-md"
                      style={{
                        backgroundColor: g.colors[0]
                          ? oklchToHex(g.colors[0].oklch)
                          : theme.hairline,
                      }}
                    />
                  )}
                </View>
              );
            })}
          </View>

          {onPlan ? (
            <View className="mt-2 flex-row items-center justify-between">
              <Text variant="label" numberOfLines={1} className="flex-1">
                {pieces
                  .slice(0, 3)
                  .map((g) => g.subcategory ?? g.category)
                  .join(' · ')}
              </Text>
              <Button
                title={planned ? 'Planned' : 'Plan it'}
                variant={planned ? 'ghost' : 'secondary'}
                onPress={onPlan}
                loading={planning}
                haptic
              />
            </View>
          ) : null}
        </>
      ) : (
        <View className="rounded-card border border-hairline p-4 dark:border-hairline-dark">
          <Text variant="label">
            Nothing in your closet works for this day&rsquo;s weather yet.
          </Text>
        </View>
      )}
    </View>
  );
}
