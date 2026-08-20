import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { useSession } from '@/features/auth/use-session';
import { useLifestyle } from '@/features/profile/use-lifestyle';
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

/**
 * SDK 57 REPLACED THIS API, AND THE OLD ONE NOW THROWS.
 *
 * `getCalendarsAsync`, `getEventsAsync`, `getCalendarPermissionsAsync` and
 * `requestCalendarPermissionsAsync` are all still exported by `expo-calendar`,
 * and every one of them is declared:
 *
 *   @deprecated Use `getCalendars()` … This method will throw in runtime.
 *
 * Not "will warn". So this was not a tidy-up — after the SDK 57 alignment the
 * calendar feature was broken end to end, and it fails in the least visible
 * place available: `loadTodaysEvents` runs inside a React Query `queryFn`,
 * which catches the throw and stores it as an error state, so `events.data`
 * is simply `undefined` and the day's context quietly has no events in it.
 * Nothing crashes. The Morning Edit just stops knowing you have a wedding.
 *
 * The replacements are `getCalendars()`, `calendar.listEvents()`,
 * `getCalendarPermissions()` and `requestCalendarPermissions()`. Events are now
 * listed per calendar object rather than by passing an array of ids, so the
 * fan-out happens here.
 */
async function loadTodaysEvents(): Promise<EventContext[]> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  if (!calendars.length) return [];

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  // `listEvents` is per-calendar now. `allSettled` rather than `all` because a
  // single unreadable calendar — a shared one whose account has gone stale is
  // the common case — must not cost the user every other calendar's events.
  const settled = await Promise.allSettled(calendars.map((c) => c.listEvents(start, end)));
  const raw = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  const unreadable = settled.filter((r) => r.status === 'rejected').length;
  if (unreadable) {
    console.warn(`calendar: ${unreadable} of ${calendars.length} calendars could not be read`);
  }

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
  targetFormality,
}: {
  note?: string | null;
  colorSeason?: string | null;
  targetOccasion?: string | null;
  /**
   * What the reader asked the day to feel like, 0..1 — redesign 11's feel chip.
   *
   * Threaded rather than invented: `resolveTargetFormality` already prefers an
   * explicit target over the calendar's dressiest commitment, so passing this
   * asks the scorer a question it has always known how to answer. Null keeps
   * the previous behaviour exactly, which is what every other caller gets.
   */
  targetFormality?: number | null;
} = {}) {
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const qc = useQueryClient();

  // --- Calendar permission persistence --------------------------------------
  //
  // The grant itself lives with iOS, not with this component — a fresh
  // `useState(false)` was forgetting it on every mount, so a cold start never
  // showed today's events and the connect CTA kept re-offering something
  // already turned on. Seed from the OS's own record on mount, and re-read on
  // foreground so a grant (or revocation) made from Settings is picked up
  // without a relaunch — the same pattern `use-camera-access.ts:64-69` uses.
  useEffect(() => {
    let cancelled = false;
    const readPermission = async () => {
      // `getCalendarPermissions()` — the `…Async` name throws on SDK 57.
      // Wrapped because this runs on every foreground: a throw here would take
      // down the AppState listener and stop the app noticing any later change.
      try {
        const { status } = await Calendar.getCalendarPermissions();
        if (!cancelled) setCalendarEnabled(status === 'granted');
      } catch {
        if (!cancelled) setCalendarEnabled(false);
      }
    };
    void readPermission();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void readPermission();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // --- Location ------------------------------------------------------------
  //
  // Gated on being signed in, and this guard is load-bearing rather than
  // defensive. `AuthGate` redirects to the sign-in screen from inside an
  // effect, so expo-router mounts `(tabs)` — and therefore Today — for a beat
  // before the redirect runs. Without this, the very first thing a brand-new
  // user saw was iOS asking for their location on top of the sign-in screen,
  // before they had any idea what the app was.
  //
  // That is the permission prompt people decline reflexively, and iOS only
  // offers it once.
  const session = useSession();

  // The lifestyle profile's standing preference, folded into every context
  // this hook assembles — Today, the stylist, events — so a college student's
  // ordinary morning quietly leans toward class-and-campus clothes without
  // any caller opting in. Soft by design: `occasionRule` lets an explicit
  // target or a calendar event outrank it entirely, and an unanswered
  // profile contributes nothing.
  const lifestyle = useLifestyle();

  const location = useQuery({
    queryKey: ['location'],
    enabled: Boolean(session.userId),
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
    enabled: Boolean(session.userId) && !location.isLoading,
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
    // `requestCalendarPermissions()` — the `…Async` name throws on SDK 57.
    //
    // No `writeOnly` argument: Cinch reads today's events to judge the day's
    // formality and never writes to a calendar, so write-only access would be
    // both the wrong grant and a worse prompt to show somebody.
    let status: string;
    try {
      ({ status } = await Calendar.requestCalendarPermissions());
    } catch {
      // A throw is not a denial — the user was never asked. Reporting
      // `undetermined` leaves the connect CTA offering to try again, which is
      // the truthful state.
      return 'undetermined';
    }

    if (status === 'granted') {
      setCalendarEnabled(true);
      return 'granted';
    }

    // LIMITED ACCESS, on iOS 17, means "Add Only" — write-only, not a subset of
    // calendars (that is the Photos model, and calendars do not have it).
    // `expo-calendar` folds it in with denial:
    //
    //   case .restricted, .denied, .writeOnly:  status = denied
    //     — CalendarPermissionsRequester.swift:34
    //
    // Which is the right answer here rather than a lossy one. Cinch reads
    // today's events to judge the day's formality and never writes, so
    // write-only access grants us exactly nothing. Reporting it as `denied`
    // keeps the connect CTA offering, which is truthful; reporting it as
    // `granted` would show a connected state that could never produce an event.
    setCalendarEnabled(false);
    return status === 'denied' ? 'denied' : 'undetermined';
  }, []);

  // --- Assembled context ---------------------------------------------------
  const context = useMemo<StyleContext>(() => {
    const now = new Date();
    return {
      weather: weather.data ?? null,
      events: events.data ?? [],
      note: note ?? null,
      targetFormality: targetFormality ?? null,
      targetOccasion: targetOccasion ?? null,
      lifestyleOccasions: lifestyle.engineOccasions.length ? lifestyle.engineOccasions : undefined,
      season: currentSeason(now, coords.latitude),
      colorSeason: colorSeason ?? null,
      // Read once per render rather than at scoring time, so the whole pass
      // sees one consistent clock.
      now: now.getTime(),
    };
    // `now` intentionally refreshes whenever any input changes; it must not be
    // a dependency of itself.
  }, [
    weather.data,
    events.data,
    note,
    targetOccasion,
    targetFormality,
    colorSeason,
    coords.latitude,
    // Identity-stable: useLifestyle memoizes this array, precisely so it can
    // sit in this list without re-minting `now` every frame.
    lifestyle.engineOccasions,
  ]);

  /**
   * Turn location on from inside the app.
   *
   * iOS asks for a permission exactly once. After that a plain
   * `requestForegroundPermissionsAsync()` resolves `denied` immediately without
   * showing anything, so a "turn on location" control wired straight to it
   * looks broken. Branch on the current status instead: prompt while it is
   * still undetermined, and send the user to Settings once the system will no
   * longer ask. Either way the location query is invalidated so a granted
   * permission takes effect without a relaunch.
   */
  const requestLocation = useCallback(async () => {
    const current = await Location.getForegroundPermissionsAsync();

    if (current.status === 'granted') {
      await qc.invalidateQueries({ queryKey: ['location'] });
      return;
    }

    if (current.canAskAgain) {
      const next = await Location.requestForegroundPermissionsAsync();
      if (next.status === 'granted') {
        await qc.invalidateQueries({ queryKey: ['location'] });
      }
      return;
    }

    await Linking.openSettings();
  }, [qc]);

  return {
    context,
    cityLabel: coords.label || FALLBACK.label,
    // Exposed for the week planner and packing list, which fetch their own
    // multi-day forecasts rather than reusing today's single reading.
    coords: { latitude: coords.latitude, longitude: coords.longitude },
    usingFallbackLocation: !coords.precise,
    weatherLoading: weather.isLoading,
    weatherFailed: weather.isError,
    /**
     * When the reading on screen was actually taken — redesign 11's stale
     * state. Zero until one lands, which reads as "no reading" rather than as
     * the epoch, because every caller checks the data first.
     *
     * Exposed so a reading can be DATED rather than dropped: a two-hour-old
     * "63° and grey" is not a lie a reader can see, and the honest answer is
     * to keep the words and add the hour.
     */
    weatherFetchedAt: weather.dataUpdatedAt,
    calendarEnabled,
    eventsLoading: events.isLoading,
    requestCalendar,
    requestLocation,
  };
}
