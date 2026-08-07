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
  weatherOnly = false,
}: {
  weather: WeatherContext | null;
  events: EventContext[];
  city: string;
  units?: 'C' | 'F';
  usingFallbackLocation?: boolean;
  onEnableLocation?: () => void;
  onConnectCalendar?: () => void;
  calendarEnabled?: boolean;
  /**
   * Just the weather sentence, nothing under it. The nothing-works state
   * (T-09) keeps this line — its reason card is read against the same weather
   * — but drops the calendar, permission and location rows along with the
   * greeting and plans pill.
   */
  weatherOnly?: boolean;
}) {
  const theme = useTheme();

  const weatherLine = weather ? (
    <Text variant="label" numberOfLines={2}>
      Feels {formatTemp(weather.feelsLikeC, units)} · {describeWeather(weather, units)}
      {` · ${city}`}
    </Text>
  ) : (
    <Text variant="label">Weather unavailable — styling on your closet alone.</Text>
  );

  if (weatherOnly) {
    return <View className="mt-1.5 px-gutter">{weatherLine}</View>;
  }

  return (
    <View className="mt-1.5 px-gutter">
      {weatherLine}

      {/* Location off is a dead end otherwise: iOS only ever asks once, so
          without a way back the forecast is silently someone else's city
          forever. Says which city it fell back to, and offers the fix. */}
      {usingFallbackLocation && onEnableLocation ? (
        <Pressable
          onPress={onEnableLocation}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Using ${city}. Turn on location to use where you are.`}
          className="mt-1.5 flex-row items-center gap-1.5 active:opacity-60">
          <SymbolView
            name="location.slash"
            size={13}
            tintColor={theme.accentWarm}
            resizeMode="scaleAspectFit"
          />
          {/* Ink, not clay. `accentWarm` on canvas is 2.98:1 — below AA for a
              13pt label, and this is a call to action, not decoration. The
              palette is locked, so the fix is usage: the tint stays on the
              leading glyph, which carries no information, and the sentence
              goes to ink — which also tells it apart from the plain muted
              context lines above it. */}
          <Text variant="label" className="flex-1" style={{ color: theme.ink }}>
            Using {city} — turn on location for where you are
          </Text>
        </Pressable>
      ) : null}

      {events.length > 0 ? (
        <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
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
        <Text variant="label" className="mt-1.5">
          Nothing on your calendar today.
        </Text>
      ) : onConnectCalendar ? (
        // Not a modal on mount. Asking for the calendar before the user has
        // seen a single outfit is how permission prompts get declined.
        <Pressable
          onPress={onConnectCalendar}
          hitSlop={8}
          accessibilityRole="button"
          className="mt-1.5 flex-row items-center gap-1.5 active:opacity-60">
          <SymbolView
            name="calendar"
            size={13}
            tintColor={theme.accentWarm}
            resizeMode="scaleAspectFit"
          />
          {/* Same reasoning as the location line above: tint on the glyph,
              ink on the sentence. */}
          <Text variant="label" className="flex-1" style={{ color: theme.ink }}>
            Use today&rsquo;s plans to sharpen these
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
