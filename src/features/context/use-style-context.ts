import { useQuery } from '@tanstack/react-query';
import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import { useCallback, useMemo, useState } from 'react';

import type { EventContext, StyleContext } from '@/lib/styling';

import { fetchWeather } from './weather';

/**
 * Fallback coordinates: Manhattan.
 *
 * Used when location is denied or unavailable. A wrong-city forecast is far
 * better than no outfits at all — and the UI says which city it used, so the
 * user is never quietly misled about why the suggestions look odd.
 */
const FALLBACK = { latitude: 40.7128, longitude: -74.006, label: 'New York' };

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Formality of a calendar event, inferred from its title.
 *
 * Crude by design. The alternative — asking a model to rate every event — would
 * send the user's entire calendar to a third party for a number that is right
 * most of the time from keywords alone, and the user can correct it in one tap.
 * Ordered most-specific first, since "client dinner" must not match "dinner".
 */
const FORMALITY_RULES: [RegExp, number][] = [
  [/\b(wedding|gala|black.?tie|funeral|ceremony)\b/i, 5],
  [/\b(interview|board|pitch|keynote|presentation|client|investor|court)\b/i, 4],
  [/\b(dinner|date|theatre|theater|opera|gallery|launch|reception)\b/i, 4],
  [/\b(meeting|standup|stand-up|1:1|review|office|work|appointment|doctor|dentist)\b/i, 3],
  [/\b(lunch|coffee|brunch|call|sync)\b/i, 3],
  [/\b(drinks|bar|pub|party|birthday|friends|hang|movie|game|concert)\b/i, 2],
  [/\b(gym|workout|run|yoga|training|climb|swim|practice|class)\b/i, 1],
];

export function inferEventFormality(title: string): number {
  for (const [re, score] of FORMALITY_RULES) if (re.test(title)) return score;
  return 3;
}

const minutesFromMidnight = (d: Date) => d.getHours() * 60 + d.getMinutes();

async function loadTodaysEvents(): Promise<EventContext[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (!calendars.length) return [];

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const raw = await Calendar.getEventsAsync(
    calendars.map((c) => c.id),
    start,
    end,
  );

  return raw
    // All-day entries are birthdays, holidays and reminders — they are not
    // places you go, and letting them set the day's formality is how you end up
    // being told to dress for "Company Holiday".
    .filter((e) => !e.allDay && e.title)
    .map((e) => {
      const startsAt = new Date(e.startDate);
      const endsAt = new Date(e.endDate ?? e.startDate);
      return {
        id: e.id,
        title: e.title,
        startsAt: minutesFromMidnight(startsAt),
        endsAt: minutesFromMidnight(endsAt),
        formality: inferEventFormality(e.title),
        occasion: null,
        indoor: true,
      } satisfies EventContext;
    })
    .sort((a, b) => a.startsAt - b.startsAt);
}

// ---------------------------------------------------------------------------
// Season
// ---------------------------------------------------------------------------

/** Meteorological season, flipped below the equator. */
export function currentSeason(date: Date, latitude: number): string {
  const north = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer',
                 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
  const month = date.getMonth();
  if (latitude >= 0) return north[month]!;
  // Six months out of phase. Cheap to support and otherwise every suggestion
  // for a user in Sydney or Buenos Aires is exactly wrong.
  return north[(month + 6) % 12]!;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStyleContext({
  note,
  colorSeason,
  targetOccasion,
}: {
  note?: string | null;
  colorSeason?: string | null;
  targetOccasion?: string | null;
} = {}) {
  const [calendarEnabled, setCalendarEnabled] = useState(false);

  // --- Location ------------------------------------------------------------
  const location = useQuery({
    queryKey: ['location'],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return { ...FALLBACK, precise: false };

      // Balanced accuracy is deliberate: city-level is all a forecast needs,
      // and asking for the best fix costs battery and time for no gain.
      const pos = await Location.getLastKnownPositionAsync()
        ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      if (!pos) return { ...FALLBACK, precise: false };

      let label = '';
      try {
        const [place] = await Location.reverseGeocodeAsync(pos.coords);
        label = place?.city ?? place?.subregion ?? place?.region ?? '';
      } catch {
        // Reverse geocoding is a nicety; never let it break the forecast.
      }

      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        label,
        precise: true,
      };
    },
  });

  const coords = location.data ?? { ...FALLBACK, precise: false };

  // --- Weather -------------------------------------------------------------
  const weather = useQuery({
    queryKey: ['weather', coords.latitude.toFixed(2), coords.longitude.toFixed(2)],
    enabled: !location.isLoading,
    // Forecasts do not move fast enough to justify refetching on every focus.
    staleTime: 30 * 60_000,
    retry: 1,
    queryFn: ({ signal }) => fetchWeather(coords.latitude, coords.longitude, signal),
  });

  // --- Calendar ------------------------------------------------------------
  const events = useQuery({
    queryKey: ['calendar-events'],
    enabled: calendarEnabled,
    staleTime: 10 * 60_000,
    queryFn: loadTodaysEvents,
  });

  const requestCalendar = useCallback(async (): Promise<PermissionStatus> => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
      setCalendarEnabled(true);
      return 'granted';
    }
    return status === 'denied' ? 'denied' : 'undetermined';
  }, []);

  // --- Assembled context ---------------------------------------------------
  const context = useMemo<StyleContext>(() => {
    const now = new Date();
    return {
      weather: weather.data ?? null,
      events: events.data ?? [],
      note: note ?? null,
      targetFormality: null,
      targetOccasion: targetOccasion ?? null,
      season: currentSeason(now, coords.latitude),
      colorSeason: colorSeason ?? null,
      // Read once per render rather than at scoring time, so the whole pass
      // sees one consistent clock.
      now: now.getTime(),
    };
    // `now` intentionally refreshes whenever any input changes; it must not be
    // a dependency of itself.
  }, [weather.data, events.data, note, targetOccasion, colorSeason, coords.latitude]);

  return {
    context,
    cityLabel: coords.label || FALLBACK.label,
    // Exposed for the week planner and packing list, which fetch their own
    // multi-day forecasts rather than reusing today's single reading.
    coords: { latitude: coords.latitude, longitude: coords.longitude },
    usingFallbackLocation: !coords.precise,
    weatherLoading: weather.isLoading,
    weatherFailed: weather.isError,
    calendarEnabled,
    eventsLoading: events.isLoading,
    requestCalendar,
  };
}
