import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { describeWeather, formatTemp } from '@/features/context/weather';
import type { EventContext, WeatherContext } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

const symbolFor = (w: WeatherContext): SFSymbol => {
  if (w.precipitationChance >= 0.5) return 'cloud.rain';
  if (w.precipitationChance >= 0.25) return 'cloud.sun';
  if (w.windKph >= 25) return 'wind';
  if (w.feelsLikeC >= 24) return 'sun.max';
  if (w.feelsLikeC <= 4) return 'snowflake';
  return 'cloud.sun';
};

const clockLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
};

/**
 * The context header: what it feels like outside and what the day holds.
 *
 * Leads with apparent temperature rather than the actual reading, because that
 * is the number the outfits were actually chosen against — showing one figure
 * and reasoning from another is how a suggestion stops making sense.
 */
export function WeatherStrip({
  weather,
  events,
  city,
  units = 'F',
  usingFallbackLocation,
  onConnectCalendar,
  calendarEnabled,
}: {
  weather: WeatherContext | null;
  events: EventContext[];
  city: string;
  units?: 'C' | 'F';
  usingFallbackLocation?: boolean;
  onConnectCalendar?: () => void;
  calendarEnabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View className="px-gutter">
      {weather ? (
        <View className="flex-row items-center gap-3">
          <SymbolView
            name={symbolFor(weather)}
            size={26}
            tintColor={theme.ink}
            resizeMode="scaleAspectFit"
          />
          <View className="flex-1">
            <View className="flex-row items-baseline gap-2">
              <Text variant="stat" className="text-2xl">
                {formatTemp(weather.feelsLikeC, units)}
              </Text>
              <Text variant="label">feels like</Text>
            </View>
            <Text variant="label" numberOfLines={1}>
              {city}
              {usingFallbackLocation ? ' (location off)' : ''} · {describeWeather(weather, units)}
            </Text>
          </View>
        </View>
      ) : (
        <Text variant="label">Weather unavailable — styling on your closet alone.</Text>
      )}

      {events.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {events.slice(0, 4).map((e, i) => (
            <View key={e.id} className="flex-row items-center gap-2">
              {i > 0 ? <Text variant="label">·</Text> : null}
              <Text variant="label" numberOfLines={1}>
                {clockLabel(e.startsAt)} {e.title}
              </Text>
            </View>
          ))}
        </View>
      ) : calendarEnabled ? (
        <Text variant="label" className="mt-3">
          Nothing on your calendar today.
        </Text>
      ) : onConnectCalendar ? (
        // Not a modal on mount. Asking for the calendar before the user has
        // seen a single outfit is how permission prompts get declined.
        <Pressable
          onPress={onConnectCalendar}
          hitSlop={8}
          accessibilityRole="button"
          className="mt-3 flex-row items-center gap-1.5 active:opacity-60">
          <SymbolView
            name="calendar"
            size={13}
            tintColor={theme.accent}
            resizeMode="scaleAspectFit"
          />
          <Text variant="label" className="text-accent dark:text-accent-dark">
            Use today&rsquo;s plans to sharpen these
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
