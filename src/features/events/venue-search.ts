/**
 * Venue handling for occasions.
 *
 * FOUNDER SCOPE (2026-08-05): venue entry is MANUAL. The host types the venue
 * name and city; there is no search API, no venue entity, no photos. What ships
 * here is (a) the snapshot shape the event row stores, (b) the reservation-link
 * hostname reader that powers the "Open in OpenTable" text button, and (c) a
 * clearly-marked seam where device-local venue search plugs in later.
 *
 * AMENDED (2026-08-08, new-occasion-spec.md §5): half of that scope has been
 * answered, from a direction this file did not anticipate. The Where field now
 * searches the Open-Meteo GAZETTEER — `searchPlaces()` in
 * features/context/weather.ts, the same vendor as the forecast, already in the
 * repo and already in the privacy policy — so a resolved place carries
 * coordinates and therefore a forecast. That is a place search, not a venue
 * search: it resolves cities and landmarks, so "The Stanley" still falls
 * through to the field's "Use as typed" row, which is the atlas's own designed
 * fallback rather than a gap. Reservation links below are unchanged and still
 * render on the occasions that carry them, although the redesigned create form
 * no longer collects one.
 */

/** What a venue is to an event: a snapshot of context, not a managed entity.
 *  Matches the `venue_name` / `venue_address` / `venue_meta` columns. */
export interface VenueSnapshot {
  name: string;
  address: string | null;
  meta: unknown | null;
}

/**
 * Device-local venue search — still the seam, still not the feature.
 *
 * TODO(SOCIAL-VENUE): non-blocking, and now narrower than it was. The build
 * plan reserves this signature for MapKit local search via a small module in
 * `modules/` (MKLocalSearch is free and on-device; see
 * docs/social/reservations-research.md). It stays deferred for a mechanical
 * reason as well as a scope one: it is native, so it cannot ride an OTA
 * update, and shipping it means cutting a store build (spec §0.2).
 *
 * What filled the gap in the meantime is POI-blind. The gazetteer answers
 * "which Denver?", not "which restaurant?" — so this constant still reads
 * false, and the place field's own "Use as typed" row is what a venue name
 * lands in until MKLocalSearch arrives. Returning an empty list remains the
 * graceful fallback: nothing renders a venue-search affordance while
 * `VENUE_SEARCH_AVAILABLE` is false.
 */
export const VENUE_SEARCH_AVAILABLE = false;

export async function searchVenues(_query: string): Promise<VenueSnapshot[]> {
  return [];
}

/**
 * TODO(SOCIAL-CALENDAR): non-blocking. "Import from Calendar" (expo-calendar is
 * already a dependency; reservation confirmations land as calendar events with
 * venue + time) is likewise deferred by founder decision. When it ships it
 * belongs beside this seam: both produce the same prefill for the create sheet.
 */

// ---------------------------------------------------------------------------
// Reservation links
// ---------------------------------------------------------------------------

/**
 * Platform names by hostname, for the outbound reservation button.
 *
 * Plain-text nominative use only — "Open in OpenTable" in Cinch's own type,
 * never a logo (the platforms' terms are explicit about their marks; see
 * reservations-research.md). The URL itself is stored verbatim as pasted and
 * only ever handed to `Linking.openURL`, where the platform's own universal
 * link takes over. Cinch never fetches it.
 */
const RESERVATION_HOSTS: readonly { pattern: RegExp; name: string }[] = [
  { pattern: /(^|\.)opentable\.[a-z.]+$/i, name: 'OpenTable' },
  { pattern: /(^|\.)resy\.com$/i, name: 'Resy' },
  { pattern: /(^|\.)exploretock\.com$/i, name: 'Tock' },
  { pattern: /(^|\.)sevenrooms\.com$/i, name: 'SevenRooms' },
  { pattern: /(^|\.)yelp\.com$/i, name: 'Yelp' },
];

/**
 * The hostname of an https URL, or null for anything else.
 *
 * A regex rather than `new URL()` on purpose: this runs on every keystroke of
 * the paste field, and it must never throw on a half-pasted string — a parser
 * that throws is a validator wearing the wrong hat. https-only mirrors the
 * database CHECK on `reservation_url`, so the client refuses exactly what the
 * server would.
 */
function httpsHostname(url: string): string | null {
  const match = /^https:\/\/([^/:?#]+)/i.exec(url.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

/** "OpenTable" | "Resy" | … when the hostname is a known platform, else null. */
export function reservationPlatform(url: string | null): string | null {
  if (!url) return null;
  const host = httpsHostname(url);
  if (!host) return null;
  return RESERVATION_HOSTS.find((h) => h.pattern.test(host))?.name ?? null;
}

/** The text-button label: "Open in OpenTable", or the quiet generic. */
export function reservationLabel(url: string | null): string {
  const platform = reservationPlatform(url);
  return platform ? `Open in ${platform}` : 'View reservation';
}

/** Whether a pasted link is storable at all — the schema takes https or null. */
export function isValidReservationUrl(url: string): boolean {
  return httpsHostname(url) !== null;
}
