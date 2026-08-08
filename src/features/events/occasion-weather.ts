import { useQuery } from '@tanstack/react-query';

import { daysFromToday, FORECAST_WINDOW_DAYS } from '@/components/events/EventCard';
import { fetchForecast } from '@/features/context/weather';
import type { WeatherContext } from '@/lib/styling';

import type { VenueCoords } from './types';

/**
 * The forecast for an occasion — its day, at its place, or nothing.
 *
 * Three conditions, all of them necessary (new-occasion-spec.md §7):
 *
 *   1. a date is set;
 *   2. the date is inside the seven-day window `EventCard` already prints
 *      against — the same `FORECAST_WINDOW_DAYS`, imported rather than copied,
 *      because the form, the card and the detail page disagreeing about how
 *      far ahead Cinch can see would be visible to the user;
 *   3. the place resolved and carries coordinates.
 *
 * Miss any one and the hook returns null, and the line simply does not
 * appear. In particular there is NO fallback to the user's own location: a
 * wedding in Denver read against the phone's coordinates in London is a
 * confident sentence about the wrong weather, which is worse than no
 * sentence. This is the same rule the share card states — weather is printed
 * or it is dropped, never estimated — applied to occasions.
 *
 * Keyed like the detail page's existing forecast query (coordinates rounded
 * to two decimals, then the span), so two surfaces asking about one place
 * share a cache entry instead of racing two requests.
 */
export function useOccasionWeather(
  startsAt: Date | null,
  coords: VenueCoords | null,
): WeatherContext | null {
  const dayIndex = daysFromToday(startsAt);
  const inWindow = dayIndex >= 0 && dayIndex < FORECAST_WINDOW_DAYS;

  const forecast = useQuery({
    // The key still names the coordinates when there are none so the key type
    // stays one shape; `enabled` is what keeps the query from ever running.
    queryKey: [
      'forecast',
      coords?.latitude.toFixed(2) ?? null,
      coords?.longitude.toFixed(2) ?? null,
      FORECAST_WINDOW_DAYS,
    ],
    enabled: Boolean(coords) && inWindow,
    // Half an hour. A forecast that moves within one editing session is
    // noise, and the same window the detail page uses.
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchForecast(coords!.latitude, coords!.longitude, FORECAST_WINDOW_DAYS, signal),
  });

  if (!inWindow) return null;
  return forecast.data?.[dayIndex] ?? null;
}
