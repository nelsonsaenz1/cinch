/**
 * Venue handling for occasions.
 *
 * FOUNDER SCOPE (2026-08-05): venue entry is MANUAL. The host types the venue
 * name and city; there is no search API, no venue entity, no photos. What ships
 * here is (a) the snapshot shape the event row stores, (b) the reservation-link
 * hostname reader that powers the "Open in OpenTable" text button, and (c) a
 * clearly-marked seam where device-local venue search plugs in later.
 */

/** What a venue is to an event: a snapshot of context, not a managed entity.
 *  Matches the `venue_name` / `venue_address` / `venue_meta` columns. */
export interface VenueSnapshot {
  name: string;
  address: string | null;
  meta: unknown | null;
}

/**
 * Device-local venue search — the seam, not the feature.
 *
 * TODO(SOCIAL-VENUE): non-blocking. The build plan reserves this signature for
 * MapKit local search via a small module in `modules/` (MKLocalSearch is free
 * and on-device; see docs/social/reservations-research.md). Deliberately out of
 * this pass by founder decision — manual entry is the product. Returning an
 * empty list is the graceful fallback the create screen is built against: it
 * renders plain text fields and never shows a search affordance while
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
