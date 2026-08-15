/**
 * The native contract for nearby venue search, mirrored by hand.
 *
 * Exactly what `VenueSearchModule.swift` returns and nothing more — no product
 * vocabulary, no thresholds, no UI states. `src/features/events/venue-search.ts`
 * is where these become something the app understands, and it is the only file
 * allowed to import from here. Same rule `GarmentVision.types.ts` states, for
 * the same reason.
 *
 * This file imports nothing on purpose: it is types only, so a `import type`
 * of it costs a test bundle nothing at runtime.
 */

/** Why a search produced no venues. Each is a different quiet line. */
export type VenueSearchFailureReason = 'offline' | 'throttled' | 'error';

/**
 * One point of interest, bounded.
 *
 * `id` is `MKMapItem.identifier` where the OS has one (iOS 18+) and null
 * below it. Never treated as a key the app owns — it is a dedupe hint and a
 * breadcrumb stored in `venue_meta`, nothing more.
 */
export type NativeVenue = {
  id: string | null;
  name: string;
  /** At most two address parts, nearest first: `120 E 6th Ave, Denver`. */
  locality: string | null;
  latitude: number;
  longitude: number;
  /** `MKPointOfInterestCategory` raw value, e.g. `MKPOICategoryRestaurant`. */
  category: string | null;
};

/**
 * An envelope, not a rejection.
 *
 * A search field fails as part of its normal day, and "no matches" and "no
 * signal" are different sentences. `ok: false` with a reason keeps them
 * distinguishable without parsing an error message.
 */
export type NativeVenueSearchResult =
  | { ok: true; venues: NativeVenue[]; reason: null }
  | { ok: false; venues: NativeVenue[]; reason: VenueSearchFailureReason };

export type NativeVenueSearchOptions = {
  /** Region bias. Both or neither; omitted means MapKit picks its own region. */
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  limit?: number;
};

export type VenueSearchNativeModule = {
  isAvailable(): boolean;
  search(query: string, options?: NativeVenueSearchOptions): Promise<NativeVenueSearchResult>;
};
