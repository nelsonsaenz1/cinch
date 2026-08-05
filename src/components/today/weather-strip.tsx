import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { describeWeather, formatTemp } from '@/features/context/weather';
import type { EventContext, WeatherContext } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

const clockLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
};

/**
 * The context line under the masthead: what it feels like outside and what the
 * day holds, set as the design's quiet single line rather than a stat block.
 *
 * Leads with apparent temperature rather than the actual reading, because that
 * is the number the outfits were actually chosen against — showing one figure
 * and reasoning from another is how a suggestion stops making sense. It stays
 * labelled "Feels" for exactly that reason.
 */
export function WeatherStrip({
  weather,
  events,
  city,
  units = 'F',
  usingFallbackLocation,
  onEnableLocation,
  onConnectCalendar,
  calendarEnabled,
}: {
  weather: WeatherContext | null;
  events: EventContext[];
  city: string;
  units?: 'C' | 'F';
  usingFallbackLocation?: boolean;
  onEnableLocation?: () => void;
  onConnectCalendar?: () => void;
  calendarEnabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View className="mt-2 px-gutter">
      {weather ? (
        <Text variant="label" numberOfLines={2}>
          Feels {formatTemp(weather.feelsLikeC, units)} · {describeWeather(weather, units)}
          {usingFallbackLocation ? ` · ${city}` : ` · ${city}`}
        </Text>
      ) : (
        <Text variant="label">Weather unavailable — styling on your closet alone.</Text>
      )}

      {/* Location off is a dead end otherwise: iOS only ever asks once, so
          without a way back the forecast is silently someone else's city
          forever. Says which city it fell back to, and offers the fix. */}
      {usingFallbackLocation && onEnableLocation ? (
        <Pressable
          onPress={onEnableLocation}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Using ${city}. Turn on location to use where you are.`}
          className="mt-2 flex-row items-center gap-1.5 active:opacity-60">
          <SymbolView
            name="location.slash"
            size={13}
            tintColor={theme.accentWarm}
            resizeMode="scaleAspectFit"
          />
          <Text variant="label" style={{ color: theme.accentWarm }}>
            Using {city} — turn on location for where you are
          </Text>
        </Pressable>
      ) : null}

      {events.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap items-center gap-x-2 gap-y-1">
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
        <Text variant="label" className="mt-2">
          Nothing on your calendar today.
        </Text>
      ) : onConnectCalendar ? (
        // Not a modal on mount. Asking for the calendar before the user has
        // seen a single outfit is how permission prompts get declined.
        <Pressable
          onPress={onConnectCalendar}
          hitSlop={8}
          accessibilityRole="button"
          className="mt-2 flex-row items-center gap-1.5 active:opacity-60">
          <SymbolView
            name="calendar"
            size={13}
            tintColor={theme.accentWarm}
            resizeMode="scaleAspectFit"
          />
          <Text variant="label" style={{ color: theme.accentWarm }}>
            Use today&rsquo;s plans to sharpen these
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
