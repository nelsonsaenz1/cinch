/**
 * Venue handling for occasions.
 *
 * FOUNDER SCOPE (2026-08-05): venue entry is MANUAL. The host types the venue
 * name and city; there is no search API, no venue entity, no photos. What
 * shipped here was (a) the snapshot shape the event row stores, (b) the
 * reservation-link hostname reader that powers the "Open in OpenTable" text
 * button, and (c) a clearly-marked seam where device-local venue search plugs
 * in later.
 *
 * AMENDED (2026-08-08, new-occasion-spec.md §5): the Where field searched the
 * Open-Meteo GAZETTEER — `searchPlaces()` in features/context/weather.ts, the
 * same vendor as the forecast — so a resolved place carried coordinates and
 * therefore a forecast. That was a place search, not a venue search: it
 * resolves cities and landmarks, so "The Stanley" fell through to the field's
 * "Use as typed" row.
 *
 * AMENDED (2026-08-15, LP-05, decisions D2/D3): the seam is filled. Venue
 * suggestions now come from Apple MapKit, on this device, through the local
 * Expo module in `modules/venue-search` — `MKLocalSearch` over points of
 * interest and addresses. MapKit is THE venue-suggestion source and it has no
 * fallback: on a denied location, offline, zero results or a service error the
 * field stays manual-first and the `Use "…" as typed` row is the answer, which
 * is what it has always been. The gazetteer is NOT that fallback and must
 * never become it — it is retained only on runtimes where the native module is
 * absent entirely (Expo Go, any bundle running on a pre-MapKit binary), where
 * it remains the shipping coordinate path the forecast depends on.
 *
 * ── What this file is ──────────────────────────────────────────────────────
 *
 * PURE. Not one runtime import, and that is deliberate rather than tidy: the
 * unit runner (scripts/run-tests.mjs) is esbuild over TypeScript with no React
 * and no native shims, and `expo-modules-core` cannot be bundled into it. So
 * the native handle is REGISTERED here by the one component that owns the
 * field, and everything below — the debounce constants, the dedupe, the
 * ordering, the reducer, the row list — is testable without a device.
 */

import type {
  NativeVenue,
  NativeVenueSearchOptions,
  NativeVenueSearchResult,
} from '../../../modules/venue-search/src/VenueSearch.types';

/** What a venue is to an event: a snapshot of context, not a managed entity.
 *  Matches the `venue_name` / `venue_address` / `venue_meta` columns. */
export interface VenueSnapshot {
  name: string;
  address: string | null;
  meta: unknown | null;
}

/** One suggestion, as the app understands it. Structurally the native record;
 *  named separately so a native field can be dropped without renaming the app's
 *  vocabulary. */
export type VenueSuggestion = NativeVenue;

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

export type VenueSearchProvider = (
  query: string,
  options: NativeVenueSearchOptions,
) => Promise<NativeVenueSearchResult>;

let provider: VenueSearchProvider | null = null;

/**
 * Hand the seam its native implementation, once, at module scope.
 *
 * `null` un-registers, which is what a runtime without the module is: not an
 * error state, a designed one. Registration rather than a direct import
 * because this file must stay bundle-able by a Node test runner — see the
 * header.
 */
export function setVenueSearchProvider(next: VenueSearchProvider | null): void {
  provider = next;
}

/** Whether this runtime can search at all. False in Expo Go and on any binary
 *  built before the MapKit module landed. */
export function venueSearchAvailable(): boolean {
  return provider !== null;
}

/** Why a search produced nothing. `unavailable` is the module being absent —
 *  distinct from a search that ran and failed. */
export type VenueSearchFailure = 'offline' | 'throttled' | 'error' | 'unavailable';

export type VenueSearchOutcome =
  | { ok: true; venues: VenueSuggestion[] }
  | { ok: false; venues: []; failure: VenueSearchFailure };

/** Long enough that "de" does not search the world; short enough for "LA". */
export const VENUE_MIN_QUERY = 2;

/** Per-keystroke debounce. The reason MKLocalSearchCompleter's streaming is
 *  not needed: MapKit is asked once the typing stops. */
export const VENUE_DEBOUNCE_MS = 300;

/** Six rows plus the as-typed row is a panel; twelve is a page. */
export const VENUE_RESULT_CAP = 6;

/**
 * Device-local venue search — the seam, now the feature.
 *
 * Returns an outcome rather than throwing, because every failure here is an
 * ordinary event in the life of a search field and each one is a different
 * quiet line. Nothing in the query, the coordinates, or the results is logged,
 * persisted, or sent anywhere: MapKit answers on the device and the answer
 * lives exactly as long as the panel does.
 */
export async function searchVenues(
  query: string,
  options: NativeVenueSearchOptions = {},
): Promise<VenueSearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length < VENUE_MIN_QUERY) return { ok: true, venues: [] };
  if (!provider) return { ok: false, venues: [], failure: 'unavailable' };

  try {
    const result = await provider(trimmed, { limit: VENUE_RESULT_CAP * 2, ...options });
    if (!result.ok) return { ok: false, venues: [], failure: result.reason };
    return { ok: true, venues: dedupeVenues(result.venues, VENUE_RESULT_CAP) };
  } catch {
    // A native rejection is not a designed outcome — the module answers with
    // an envelope — so anything that lands here is a bridge fault, reported as
    // the generic service error rather than swallowed.
    return { ok: false, venues: [], failure: 'error' };
  }
}

// ---------------------------------------------------------------------------
// Ordering and dedupe
// ---------------------------------------------------------------------------

/**
 * The identity of a suggestion for dedupe purposes.
 *
 * The OS identifier when there is one (iOS 18+), and otherwise name plus
 * locality folded to lower case. Never the coordinate: two entrances to the
 * same building are metres apart and would survive a coordinate-keyed dedupe
 * as two identical-looking rows.
 */
export function venueKey(venue: VenueSuggestion): string {
  if (venue.id) return `id:${venue.id}`;
  return `name:${venue.name.trim().toLowerCase()}|${(venue.locality ?? '').trim().toLowerCase()}`;
}

/**
 * MapKit's ranking, deduped and capped — never re-sorted.
 *
 * Re-sorting would be the app second-guessing a relevance model it cannot see,
 * and it would make the list jump as results refine. Stability is the whole
 * requirement: the same query must produce the same rows in the same order, so
 * a finger already moving toward row two lands on row two.
 */
export function dedupeVenues(venues: VenueSuggestion[], cap = VENUE_RESULT_CAP): VenueSuggestion[] {
  const seen = new Set<string>();
  const out: VenueSuggestion[] = [];

  for (const venue of venues) {
    if (out.length >= cap) break;
    const name = venue.name.trim();
    if (!name) continue;
    const key = venueKey(venue);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(venue);
  }

  return out;
}

// ---------------------------------------------------------------------------
// The adapter: suggestion → what the UI and the row actually speak
// ---------------------------------------------------------------------------

/**
 * A suggestion as the place field's `resolved` selection.
 *
 * Structural rather than an import of `PlaceSelection`, so this file keeps its
 * zero-import rule and the component keeps owning its own union. The shape is
 * checked by the compiler at the call site, which is where a drift would
 * matter.
 */
export function venueSelection(venue: VenueSuggestion): {
  kind: 'resolved';
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  source: 'mapkit';
  category: string | null;
  url: string | null;
  placeId: string | null;
} {
  return {
    kind: 'resolved',
    name: venue.name.trim(),
    address: venue.locality ?? '',
    latitude: venue.latitude,
    longitude: venue.longitude,
    // MKLocalSearch answered, so MapKit is what the coordinate came from. It is
    // stated HERE, at the only place that knows it, rather than inferred later:
    // the gazetteer writes the same shape through the same helpers, and a
    // resolver that does not name itself is a row the column has to guess at.
    source: 'mapkit',
    category: venue.category,
    // MapKit's local module answers with no URL — the native record
    // (`VenueSearch.types.ts`) has no such field and widening it would change
    // the accepted native contract. The slot is carried anyway because LP-05
    // names the venue URL as one of the five things a keystroke must clear,
    // and a field that cannot be set is still a field that must not persist.
    url: null,
    placeId: venue.id,
  };
}

// ---------------------------------------------------------------------------
// Resolved metadata, and clearing it (LP-05)
// ---------------------------------------------------------------------------

/**
 * Everything a resolved pick knows beyond the venue's NAME.
 *
 * One record rather than five pieces of form state, because the atlas's rule is
 * about all five at once: "typing after a resolved selection clears stale
 * address, coordinates, category, URL, and place identifier." Five separate
 * setters is five chances to forget one, and forgetting one is exactly the bug
 * — an event carrying the category or the MapKit identifier of a place the user
 * typed over. The name is deliberately NOT in here: the name is the text in the
 * field, and the text is what the user is editing.
 */
export type ResolvedVenueMeta = {
  /** The locality line — writes `venue_address`. */
  address: string | null;
  /**
   * The pair, and which resolver produced it.
   *
   * `source` is OPTIONAL for one reason: a draft written before it existed
   * restores a pair with no resolver named, and the serializer's documented
   * fallback (`open-meteo`, the only resolver that predates the field) is the
   * right answer for exactly those blobs. Every live selection states it.
   */
  coords: { latitude: number; longitude: number; source?: 'mapkit' | 'open-meteo' } | null;
  /** `MKPointOfInterestCategory` raw value. */
  category: string | null;
  /** The venue's own URL. Always null from this provider; see `venueSelection`. */
  url: string | null;
  /** `MKMapItem.identifier`, where the OS has one. */
  placeId: string | null;
};

/**
 * What the user settled on for Where (N-06) — the field's answer, in one place.
 *
 * Two kinds, and the difference is the whole design. A `resolved` pick came
 * back from a search and carries coordinates, so the occasion earns a
 * forecast. A `typed` one is whatever the user wrote, kept verbatim, and
 * simply does not — "a friend's flat has no listing, and an event should not
 * be blocked on a geocoder agreeing it exists."
 *
 * It lives HERE rather than in the component that renders the field, because
 * two screens now act on it — the form and the detail page's repair sheet —
 * and both reach it through this file's adapters. One definition is what stops
 * a second screen from reading four of the six resolved fields and calling
 * that a write.
 */
export type VenuePlaceSelection =
  | {
      kind: 'resolved';
      /** Writes `venue_name`. */
      name: string;
      /** The locality line — writes `venue_address`. */
      address: string;
      latitude: number;
      longitude: number;
      /** Which resolver produced the pair. Required, and stated by the panel
       *  that produced it: two providers write this one shape, so the row's
       *  provenance cannot be inferred downstream. */
      source: 'mapkit' | 'open-meteo';
      /** `MKPointOfInterestCategory` raw value, where the provider has one. */
      category: string | null;
      /** The venue's own URL. No provider here surfaces one; the slot exists
       *  because LP-05 requires it be cleared with the rest. */
      url: string | null;
      /** The provider's place identifier — `MKMapItem.identifier` on MapKit. */
      placeId: string | null;
    }
  | { kind: 'typed'; name: string };

/** No resolved venue: the state a keystroke returns the form to. */
export function emptyResolvedVenueMeta(): ResolvedVenueMeta {
  return { address: null, coords: null, category: null, url: null, placeId: null };
}

/** Whether anything resolved is still being held. */
export function hasResolvedVenueMeta(meta: ResolvedVenueMeta): boolean {
  return (
    meta.address !== null ||
    meta.coords !== null ||
    meta.category !== null ||
    meta.url !== null ||
    meta.placeId !== null
  );
}

/**
 * A selection as the metadata the form should hold.
 *
 * A `typed` pick — the `Use “…” as typed` row — resolves nothing, so it returns
 * the empty record rather than keeping whatever the previous pick left behind.
 * That is the same answer a keystroke gets, which is the point: there is one
 * definition of "not resolved" and both paths reach it.
 */
export function resolvedVenueMetaFor(
  selection:
    | {
        kind: 'resolved';
        address: string;
        latitude: number;
        longitude: number;
        source: 'mapkit' | 'open-meteo';
        category: string | null;
        url: string | null;
        placeId: string | null;
      }
    | { kind: 'typed' },
): ResolvedVenueMeta {
  if (selection.kind !== 'resolved') return emptyResolvedVenueMeta();
  return {
    address: selection.address,
    coords: {
      latitude: selection.latitude,
      longitude: selection.longitude,
      source: selection.source,
    },
    category: selection.category,
    url: selection.url,
    placeId: selection.placeId,
  };
}

/**
 * The resolved record as the blob `venue_meta` stores.
 *
 * The form holds five resolved fields (`ResolvedVenueMeta`); the column takes
 * three of them. The address is its own column, and the URL is not stored at
 * all — no provider here surfaces one, and LP-05 names it as something to
 * CLEAR rather than to keep. What is left is the coordinate pair, the
 * point-of-interest category and the stable place identifier.
 *
 * THE RESOLVER RIDES ALONG, unchanged, from the selection that made this pair.
 * `venueMetaJson` in features/events/mutations.ts writes whatever `source` it
 * is handed and falls back to `open-meteo` for a pair that names none — so a
 * helper that dropped the key would file every MapKit pick this field now
 * produces under the gazetteer's name. Provenance is carried, never re-derived:
 * a MapKit result with no category and no identifier (an address, or iOS 17) is
 * indistinguishable from a gazetteer pick by shape alone.
 *
 * KEYS ARE OMITTED, NOT NULLED, when there is nothing to say — a gazetteer
 * pick produces exactly the two-number object it always did. Structural rather
 * than an import of `VenueCoords`, so this file keeps its zero-import rule;
 * the compiler checks the shape at the call site, which is where a drift would
 * matter.
 */
export function venueMetaForColumn(meta: ResolvedVenueMeta): {
  latitude: number;
  longitude: number;
  source?: 'mapkit' | 'open-meteo';
  category?: string;
  placeId?: string;
} | null {
  if (!meta.coords) return null;
  return {
    latitude: meta.coords.latitude,
    longitude: meta.coords.longitude,
    ...(meta.coords.source ? { source: meta.coords.source } : null),
    ...(meta.category ? { category: meta.category } : null),
    ...(meta.placeId ? { placeId: meta.placeId } : null),
  };
}

/**
 * A selection as the three venue fields a write sets, together.
 *
 * The repair path (`PlaceSheet` on the detail page, N-10's "Add a place")
 * writes a selection DIRECTLY, with no form state in between — so it is the
 * one caller that could reach past `venueMetaForColumn` and hand the column a
 * hand-built object. It did, and the object had two of the five keys: the
 * coordinate survived and the resolver, the category and the identifier did
 * not, which meant a MapKit venue repaired after the fact was filed under
 * `open-meteo` while the same venue picked during creation was filed
 * correctly. One helper, so the two paths cannot disagree again.
 *
 * ALL THREE FIELDS, ALWAYS. Coordinates travel with the name they were
 * resolved for — a patch that sets one and not the other is how a venue ends
 * up carrying the last place's weather — and a typed answer clears the two it
 * cannot fill rather than leaving them behind. The URL is not among them: it
 * is not a column, and LP-05 names it as something to clear.
 */
export function venueWriteFor(selection: VenuePlaceSelection): {
  venueName: string;
  venueAddress: string | null;
  venueMeta: ReturnType<typeof venueMetaForColumn>;
} {
  const meta = resolvedVenueMetaFor(selection);
  return {
    venueName: selection.name,
    venueAddress: meta.address,
    venueMeta: venueMetaForColumn(meta),
  };
}

/**
 * A suggestion as the snapshot the event row stores.
 *
 * `meta` uses the SAME key names the column now holds — `placeId`, not a
 * second spelling of it. This helper predates the write path and had invented
 * `mapkitId`; two names for one identifier in one jsonb bag is a reader
 * checking both forever, so it is the column's vocabulary that wins.
 */
export function toVenueSnapshot(venue: VenueSuggestion): VenueSnapshot {
  return {
    name: venue.name.trim(),
    address: venue.locality,
    meta: {
      latitude: venue.latitude,
      longitude: venue.longitude,
      placeId: venue.id,
      category: venue.category,
    },
  };
}

// ---------------------------------------------------------------------------
// The suggestion state machine
// ---------------------------------------------------------------------------

export type VenueQueryState = {
  /** The trimmed live text. */
  query: string;
  /** The id of the newest request issued. Replies below it are stale. */
  requestId: number;
  /** True once a row has been tapped, false again on the next keystroke.
   *  Without it the panel reopens under the answer the user just chose. */
  settled: boolean;
  status: 'idle' | 'searching' | 'ready' | 'failed';
  venues: VenueSuggestion[];
  failure: VenueSearchFailure | null;
};

export type VenueQueryEvent =
  | { type: 'query'; text: string }
  | { type: 'settled' }
  | { type: 'result'; requestId: number; outcome: VenueSearchOutcome };

export function venueQueryInitial(): VenueQueryState {
  return { query: '', requestId: 0, settled: false, status: 'idle', venues: [], failure: null };
}

/** Whether the query is long enough and unsettled enough to be searched. */
export function venueSearchable(state: VenueQueryState): boolean {
  return !state.settled && state.query.length >= VENUE_MIN_QUERY;
}

/**
 * The whole of the suggestion behaviour, as a reducer.
 *
 * Extracted from the component for one reason: latest-request-wins, dedupe,
 * ordering and the always-present as-typed row are the parts most likely to be
 * subtly wrong, and none of them need a renderer to check.
 */
export function venueQueryReduce(
  state: VenueQueryState,
  event: VenueQueryEvent,
): VenueQueryState {
  switch (event.type) {
    case 'query': {
      const query = event.text.trim();
      if (query === state.query && !state.settled) return state;

      // A new query invalidates every reply still in flight: the id moves, and
      // `result` below drops anything that does not match it. Results are
      // cleared with it rather than left on screen under a different word.
      return {
        query,
        requestId: state.requestId + 1,
        settled: false,
        status: query.length >= VENUE_MIN_QUERY ? 'searching' : 'idle',
        venues: [],
        failure: null,
      };
    }

    case 'settled':
      // The panel closes; nothing else is thrown away, so re-editing the text
      // starts a fresh search rather than resurrecting the old one.
      return { ...state, settled: true, status: 'idle', venues: [], failure: null };

    case 'result': {
      // LATEST-REQUEST-WINS. Two overlapping searches routinely land out of
      // order and the older one would otherwise overwrite the newer answer.
      if (event.requestId !== state.requestId) return state;
      if (state.settled) return state;

      if (!event.outcome.ok) {
        return { ...state, status: 'failed', venues: [], failure: event.outcome.failure };
      }
      return {
        ...state,
        status: 'ready',
        venues: dedupeVenues(event.outcome.venues),
        failure: null,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// What the panel renders
// ---------------------------------------------------------------------------

export type VenueRow =
  | { kind: 'venue'; venue: VenueSuggestion }
  /** Always last, always present while the panel is open. */
  | { kind: 'typed'; text: string };

/** Whether the suggestion panel is on screen at all. */
export function venuePanelOpen(state: VenueQueryState): boolean {
  return venueSearchable(state);
}

/**
 * The rows, in order.
 *
 * The as-typed row is appended unconditionally — not when the search fails,
 * not when it is empty, ALWAYS — because manual entry is a first-class path
 * and a field that offers it only after a geocoder has given up has made the
 * geocoder the authority on whether a place exists.
 */
export function venueRows(state: VenueQueryState): VenueRow[] {
  if (!venuePanelOpen(state)) return [];
  const rows: VenueRow[] = state.venues.map((venue) => ({ kind: 'venue', venue }));
  rows.push({ kind: 'typed', text: state.query });
  return rows;
}

/**
 * The one quiet line under the panel, or null.
 *
 * One line each, never two, and never a retry button: the next keystroke is
 * the retry, and a button would ask the user to fix the network before
 * finishing a form that does not need the network at all.
 *
 * AND NEVER THE REMEDY, which these lines used to carry. Each ended with
 * — use what you typed. — roughly half the sentence spent instructing the
 * reader to do the thing the row directly above already offers: `venueRows`
 * pushes the `typed` row unconditionally, behind the same `venuePanelOpen`
 * guard this function returns null under, so a status line cannot appear
 * without that tappable row above it. Naming an affordance that is already on
 * screen and already tappable is not reassurance; it is the copy explaining
 * the interface to itself.
 *
 * So each line states its fact and stops. The remedy is the row.
 */
export function venueStatusLine(state: VenueQueryState): string | null {
  if (!venuePanelOpen(state)) return null;

  switch (state.status) {
    case 'searching':
      return 'Looking nearby…';
    case 'ready':
      return state.venues.length === 0 ? 'No nearby matches.' : null;
    case 'failed':
      switch (state.failure) {
        case 'offline':
          return 'You’re offline.';
        case 'throttled':
          return 'Too many searches just now.';
        case 'unavailable':
          // The module is absent, so no venue affordance was ever offered and
          // there is nothing to explain. Silence, not an apology.
          return null;
        default:
          return 'Nearby search is unavailable.';
      }
    default:
      return null;
  }
}

/** The line shown when location was asked for and refused. One line, and the
 *  search carries on without it. */
export const VENUE_LOCATION_DENIED_LINE = 'Searching without your location.';

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
