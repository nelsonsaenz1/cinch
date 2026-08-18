import { daysBetween, formatDateRange, fromIsoDate, type IsoDate } from '@/features/plan/trip';
import type { Json } from '@/types/database';

/**
 * Trips — the list. What the shelf decides before it draws. Redesign 04.
 *
 * A `.ts`, not a `.tsx`, for the reason `plan-week-spec.ts` and
 * `event-detail-spec.ts` both give: the node test bundler cannot parse React
 * Native's Flow source, so anything worth PINNING must not reach a component
 * file. Everything here is a pure function of its arguments — no hooks, and no
 * `new Date()` read from the ambient clock; the caller passes today in. That is
 * what lets `tests/trips-list-layout.test.ts` assert the partition and the two
 * sorts directly instead of inferring them from a render at whatever moment the
 * suite happened to run.
 *
 * ── WHY THE PARTITION IS ABOUT THE END DATE, NOT THE START ───────────────────
 *
 * The page is the founder's ask stated plainly: after planning a trip you come
 * back and see all of them. The one arrangement that would betray that is a
 * trip you are ON being filed under "Where you've been" because its start date
 * has passed. So a trip leaves the upcoming shelf only once its LAST day is
 * behind today — a trip spanning today is still the next thing, and it takes
 * the hero card.
 *
 * ── WHY UNDATED TRIPS ARE UPCOMING ───────────────────────────────────────────
 *
 * The `trips` row is written the moment the questionnaire is answered, and the
 * date question can be the one somebody abandoned. A row with no usable dates
 * is therefore an intention, not a memory, and it belongs where intentions go —
 * at the END of the upcoming shelf, after everything that knows when it is,
 * because a trip with no date cannot claim to be the next one.
 */

// ---------------------------------------------------------------------------
// Copy — nothing here promises a count of anything
// ---------------------------------------------------------------------------

export const TRIPS_COPY = {
  title: 'Trips',
  back: 'Back',
  plan: 'Plan a trip',
  nextUp: 'Next up',
  /** The rest of the upcoming shelf, headed by whichever of these two fits. */
  laterThisYear: 'Later this year',
  laterOn: 'Later on',
  past: 'Where you’ve been',
  packed: 'Packed',
  emptyTitle: 'No trips packed yet',
  emptyBody: 'Plan one and it stays here with everything you packed.',
  offlineKicker: 'Offline',
  offlineTitle: 'Couldn’t refresh your trips',
  offlineBody: 'These are the ones saved on this device.',
  /**
   * The state the artifact did not draw: the refresh failed AND there is
   * nothing cached to fall back on. The frame's line would be a claim about
   * rows that are not there, so the band says the true thing instead.
   */
  offlineBodyEmpty: 'Nothing is saved on this device yet.',
  cached: 'Saved on this device',
  tryAgain: 'Try again',
  /** The two entry points, worded identically on both surfaces. */
  seeAll: 'See all trips',
  open: (destination: string) => `Open ${destination}`,
} as const;

// ---------------------------------------------------------------------------
// The partition and the two sorts
// ---------------------------------------------------------------------------

/** The least a row must carry to be filed. Both dates may be missing. */
export type TripStamp = {
  id: string;
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
};

/** `YYYY-MM-DD` and nothing else — a half-typed date is not a date. */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Local-noon milliseconds, or null. Noon so no timezone shift changes the day. */
function stamp(iso: IsoDate | null | undefined): number | null {
  if (!iso || !ISO.test(iso)) return null;
  const t = fromIsoDate(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** A trip's last day, falling back to its first when only one end is known. */
function lastDay(trip: TripStamp): number | null {
  return stamp(trip.endsOn) ?? stamp(trip.startsOn);
}

/** A trip's first day, falling back to its last when only one end is known. */
function firstDay(trip: TripStamp): number | null {
  return stamp(trip.startsOn) ?? stamp(trip.endsOn);
}

/**
 * Upcoming above, past below — and a trip spanning today is upcoming.
 *
 * `today` is anchored to local noon here rather than at the call site, so a
 * caller passing `new Date()` at 23:50 gets the same answer as one passing it
 * at 00:10 on the same date.
 */
export function partitionTrips<T extends TripStamp>(
  trips: readonly T[],
  today: Date,
): { upcoming: T[]; past: T[] } {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0).getTime();

  const upcoming: T[] = [];
  const past: T[] = [];

  for (const trip of trips) {
    const end = lastDay(trip);
    // No date at all: an intention, and intentions are never memories.
    if (end === null || end >= now) upcoming.push(trip);
    else past.push(trip);
  }

  return { upcoming: sortUpcoming(upcoming), past: sortPast(past) };
}

/**
 * Soonest first. Undated trips fall to the end, and ties break on id.
 *
 * The id tiebreak is not decoration: two trips that start on the same day would
 * otherwise swap places between renders depending on the order PostgREST
 * happened to return them, and a shelf that reorders under the reader's thumb
 * is the bug this line exists to refuse.
 */
export function sortUpcoming<T extends TripStamp>(trips: readonly T[]): T[] {
  return [...trips].sort((a, b) => {
    const x = firstDay(a);
    const y = firstDay(b);
    if (x === null && y === null) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (x !== y) return x - y;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Most recent first — the last thing you did reads at the top of the memory. */
export function sortPast<T extends TripStamp>(trips: readonly T[]): T[] {
  return [...trips].sort((a, b) => {
    const x = lastDay(a);
    const y = lastDay(b);
    if (x === null && y === null) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (x !== y) return y - x;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * The heading over the upcoming trips that are not the next one.
 *
 * The artifact draws "Later this year", which is true of the frame and not of
 * every shelf — a December reader with a March trip would be told their spring
 * is this year. So the label follows the trips: it stays the artifact's words
 * while everything under it is in today's calendar year, and widens to "Later
 * on" the moment one is not.
 */
export function laterLabel(rest: readonly TripStamp[], today: Date): string {
  const year = today.getFullYear();
  for (const trip of rest) {
    const first = firstDay(trip);
    // An undated trip makes no claim about the year, so it forces the wider
    // heading rather than being quietly counted as this one.
    if (first === null) return TRIPS_COPY.laterOn;
    if (new Date(first).getFullYear() !== year) return TRIPS_COPY.laterOn;
  }
  return TRIPS_COPY.laterThisYear;
}

// ---------------------------------------------------------------------------
// The colophon
// ---------------------------------------------------------------------------

/** Inclusive days minus one. A same-day trip has no nights and says so. */
export function nightCount(startsOn: IsoDate | null, endsOn: IsoDate | null): number | null {
  if (stamp(startsOn) === null || stamp(endsOn) === null) return null;
  return Math.max(0, daysBetween(startsOn as IsoDate, endsOn as IsoDate) - 1);
}

/**
 * `10–14 Sep · 4 nights` — the upcoming card's dates.
 *
 * `formatDateRange` is `features/plan/trip.ts`'s, already locale-formatted and
 * already used by the questionnaire's own summary; a second month table here
 * would be the same sentence spelled two ways in one app. Null when the row has
 * no usable dates, and the card then carries its destination alone.
 */
export function tripDatesLine(startsOn: IsoDate | null, endsOn: IsoDate | null): string | null {
  if (stamp(startsOn) === null || stamp(endsOn) === null) return null;
  const range = formatDateRange(startsOn as IsoDate, endsOn as IsoDate);
  const nights = nightCount(startsOn, endsOn);
  if (nights === null || nights === 0) return range;
  return `${range} · ${nights} ${nights === 1 ? 'night' : 'nights'}`;
}

/**
 * `May 2026 · 5 nights` — the past row's dates.
 *
 * A trip you took last spring is remembered by its month, not by which Tuesday
 * it started on, which is exactly what the artifact draws under "Where you've
 * been" and why this is a different function rather than a flag on the one
 * above. Sentence case, not tracked caps: the frames set the past section in
 * the quieter register throughout.
 */
export function pastDatesLine(startsOn: IsoDate | null, endsOn: IsoDate | null): string | null {
  const start = stamp(startsOn) ?? stamp(endsOn);
  if (start === null) return null;
  const month = new Date(start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const nights = nightCount(startsOn, endsOn);
  if (nights === null || nights === 0) return month;
  return `${month} · ${nights} ${nights === 1 ? 'night' : 'nights'}`;
}

/**
 * What the serif sets — the place, as the row recorded it.
 *
 * `place_name` and nothing else. The artifact draws "Marfa, Texas", which is
 * `place_name` plus `place_admin1` for that particular row, and appending the
 * region generally does not hold: the geocoder returns admin1 "Ciudad de
 * México" beside name "Mexico City", and the hero card would then read "Mexico
 * City, Ciudad de México" in 40pt serif. One field, always correct, is worth
 * more on this page than a second one that is sometimes prettier.
 */
export function destinationLabel(place: { name: string }): string {
  return place.name.trim();
}

// ---------------------------------------------------------------------------
// The collage
// ---------------------------------------------------------------------------

/** Three across on the hero, four in the shelf card's square. */
export const HERO_TILES = 3;
export const CARD_TILES = 4;

/**
 * Which packed pieces the card draws.
 *
 * `memo.bag` is the packing engine's own ordering — most-worn first — so the
 * collage shows the pieces the trip was actually built around rather than
 * whatever four uuids `item_ids` happens to list first. `item_ids` is the
 * fallback for a row saved before the memo existed, and for one that was
 * answered but never packed.
 *
 * Written defensively because `memo` is `jsonb`: it is whatever was written the
 * day it was written, and a shape assertion here would be a crash on the
 * reader's shelf rather than a missing photograph.
 */
export function bagItemIds(memo: Json | null, itemIds: readonly string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value !== 'string' || !value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };

  if (memo && typeof memo === 'object' && !Array.isArray(memo)) {
    const bag = (memo as Record<string, unknown>).bag;
    if (Array.isArray(bag)) {
      for (const entry of bag) {
        if (out.length >= limit) break;
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          push((entry as Record<string, unknown>).itemId);
        }
      }
    }
  }

  for (const id of itemIds) {
    if (out.length >= limit) break;
    push(id);
  }

  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Geometry — the artifact's numbers
// ---------------------------------------------------------------------------

/** The masthead's tinted pill. 14 is the artifact's, between `md` and `lg`. */
export const HEADER_CTA_RADIUS = 14;
export const HEADER_CTA_RADIUS_AX = 16;

/** The section eyebrows that sit on a sand plate rather than on paper. */
export const EYEBROW_RADIUS = 8;
export const EYEBROW_RADIUS_AX = 9;

/** The hero's three-across band of packed pieces. */
export const HERO_COLLAGE_ROW = 104;
export const HERO_COLLAGE_ROW_AX = 88;
export const COLLAGE_GAP = 3;

/** The shelf card. */
export const CARD_RADIUS = 18;
export const CARD_PAD = 12;
export const CARD_PAD_AX = 14;
export const CARD_GAP = 10;
export const CARD_THUMB = 64;
export const CARD_THUMB_RADIUS = 12;
export const CARD_THUMB_GAP = 2;
/** Above the threshold the square becomes a band across the top of the card. */
export const CARD_COLLAGE_ROW_AX = 70;
export const CHEVRON = 12;

/** The offline frame's cached rows — the same card, one size down. */
export const CACHED_THUMB = 56;

/** The past section. */
export const PAST_THUMB = 38;
export const PAST_THUMB_RADIUS = 10;
export const PAST_ROW_GAP = 12;

/** The badge on the hero, and the pinned foot. */
export const BADGE_RADIUS = 8;
export const CTA_MIN_HEIGHT = 56;
export const CTA_RADIUS = 16;
export const BAND_RADIUS = 9;
export const BAND_DOT = 8;

/** The drawn suitcase on the empty frame. */
export const CASE_WIDTH = 186;
export const CASE_HEIGHT = 124;
export const CASE_RADIUS = 18;
export const CASE_BORDER = 3;
export const CASE_HANDLE_WIDTH = 56;
export const CASE_HANDLE_HEIGHT = 26;
export const CASE_STRIPE = 3;
export const CASE_STRIPE_HEIGHT = 88;

/**
 * Where the page recomposes instead of shrinking.
 *
 * The same threshold Plan's week and the event poster use — one number for the
 * whole redesign, so two rebuilt pages cannot disagree about what "large" is.
 */
export { AX_STACK_SCALE as TRIPS_LIST_STACK_SCALE } from '@/features/closet/dynamic-type';
