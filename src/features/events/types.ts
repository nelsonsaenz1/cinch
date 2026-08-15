import type {
  EventMemberRole,
  EventMemberState,
  EventMemberRow,
  EventRow,
  EventVisibility,
  SocialProfileRow,
} from '@/features/social/db-rows';

/**
 * Domain types for occasions — the camelCase shapes the app renders from.
 *
 * The wire rows live in `@/features/social/db-rows` (snake_case, owned by the
 * DB slice) and are mapped here in one crossing point, mirroring `toItem` in
 * `closet/queries.ts`: swap one call site to change how the entire app reads
 * events. The shapes below are the §5.2 seam contract in the build plan —
 * `event-outfits` is coded against them, so widening is fine, renaming is not.
 */

// Re-exported so the rest of this feature (and its consumers) reach the enum
// unions through one import that already exists, rather than each file growing
// its own dependency on the DB seam module.
export type { EventMemberRole, EventMemberState, EventVisibility };

/**
 * Which resolver produced a coordinate pair.
 *
 * Two now, where there was one. The gazetteer answers "which Denver?" and is
 * the path a runtime without the MapKit module still takes; MKLocalSearch
 * answers "which restaurant?" and is what a current binary uses. The column
 * has always recorded its own provenance — the launch-polish packet is the
 * first time that record could be WRONG, because a second resolver now writes
 * the same shape.
 */
export type VenueCoordSource = 'open-meteo' | 'mapkit';

/**
 * Where an occasion is, as a pair of numbers.
 *
 * The only part of `venue_meta` the app has any use for: a resolved place
 * carries coordinates and therefore earns a forecast, a typed one does not
 * (new-occasion-spec.md §5). Kept as its own type because both directions
 * need it — `EventDetail` reads it and `CreateEventInput` writes it.
 *
 * `source` is optional because it is write-only provenance: `parseVenueMeta`
 * deliberately drops it on the way back in, so nothing that READS an occasion
 * has to care, and no existing caller had to change to keep compiling.
 *
 * `category` and `placeId` are the two things a MapKit pick knows that the
 * three venue columns cannot hold, and they ride in the SAME jsonb bag rather
 * than in columns of their own — no migration, and the shape is additive, so
 * every row written before them still parses. Both are optional in the exact
 * sense that matters: a typed venue has neither, a gazetteer pick has neither,
 * and nothing in the app requires either to render an occasion. They are a
 * breadcrumb, not a key — nothing joins on `placeId` and nothing branches on
 * `category`. Neither is ever put in an analytics payload, and there is no
 * venue URL here at all: the native record has no such field and LP-05 names
 * the URL as something to CLEAR, not something to keep.
 */
export interface VenueCoords {
  latitude: number;
  longitude: number;
  source?: VenueCoordSource;
  /** `MKPointOfInterestCategory` raw value, e.g. `MKPOICategoryRestaurant`. */
  category?: string;
  /** `MKMapItem.identifier`, where the OS has one (iOS 18+). */
  placeId?: string;
}

/**
 * `venue_meta` → coordinates, or null for anything else.
 *
 * The column is jsonb and has never been written until now, so every row that
 * reaches this function is either the shape the place field writes or
 * something nobody has seen. Validating rather than casting is the difference
 * between an occasion with no forecast and an occasion whose forecast is
 * fetched for `NaN, NaN`: the weather module's rule is that weather is
 * printed or dropped, never estimated, and that rule starts here. Anything
 * missing, non-numeric, non-finite or out of range is not a coordinate.
 *
 * THE COORDINATE IS STILL THE GATE. `category` and `placeId` are read back
 * only once the pair has validated, and each key is OMITTED rather than set to
 * null when it is absent or not a non-empty string. Omission is what keeps the
 * round trip honest: a screen that reads an occasion and writes it back must
 * not turn "this row never had a category" into "this row has a null one", and
 * it must not have to know the difference. It also keeps the return value
 * exactly `{latitude, longitude}` for every row written before these keys
 * existed, which is every row a gazetteer pick still writes today.
 */
export function parseVenueMeta(raw: unknown): VenueCoords | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { latitude, longitude, category, placeId } = raw as {
    latitude?: unknown;
    longitude?: unknown;
    category?: unknown;
    placeId?: unknown;
  };
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const coords: VenueCoords = { latitude, longitude };
  if (typeof category === 'string' && category.trim()) coords.category = category.trim();
  if (typeof placeId === 'string' && placeId.trim()) coords.placeId = placeId.trim();
  return coords;
}

/**
 * Coordinates → the `venue_meta` blob, with the resolver stamped on.
 *
 * The write half of `parseVenueMeta`, and it lives beside it for two reasons:
 * the round trip is one fact and reads better in one file, and this file
 * imports nothing at runtime — so the serializer is CALLABLE from a test,
 * where it previously sat private inside the mutation module behind a
 * React-Query and Supabase import and could only be pinned by reading its
 * source as text.
 *
 * The vendor name used to be a LITERAL here, on the reasoning that the data
 * layer is what knows where coordinates came from. That reasoning expired the
 * moment a second resolver existed: MKLocalSearch now writes this same shape
 * (features/events/venue-search.ts), so a hard-coded `open-meteo` stopped
 * describing the row and started misdescribing it. Provenance the writer
 * cannot state is provenance the column cannot keep.
 *
 * So the source rides on the coordinate itself and is written through. The
 * fallback stays `open-meteo` because that is the only resolver that predates
 * this field — an unstamped pair is, by construction, a gazetteer pair from
 * before MapKit shipped. This is serialization only: the column is jsonb and
 * `parseVenueMeta` drops the key on the way back in.
 *
 * TWO MORE OPTIONAL KEYS RIDE ALONG. A MapKit pick knows its point-of-interest
 * category and, on iOS 18 and up, a stable `MKMapItem.identifier`; the three
 * venue COLUMNS can hold neither, and adding columns for them would be a
 * migration this packet is not authorized to write. The jsonb bag already
 * exists and already takes an arbitrary object, so they go there.
 *
 * WRITTEN ONLY WHEN PRESENT. A key that is absent stays absent rather than
 * being written as null: a gazetteer pair produces byte-for-byte the row it
 * always did, so nothing about the pre-MapKit path changes, and no reader has
 * to distinguish "no category" from "a null category". Nothing else joins the
 * bag — there is no venue URL, because the native record has no such field.
 */
export function venueMetaJson(coords: VenueCoords | null): Record<string, unknown> | null {
  if (!coords) return null;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    source: coords.source ?? 'open-meteo',
    ...(coords.category ? { category: coords.category } : null),
    ...(coords.placeId ? { placeId: coords.placeId } : null),
  };
}

/** One person on an event's roster, identity hydrated from `social_profiles`. */
export interface EventMember {
  userId: string;
  role: EventMemberRole;
  state: EventMemberState;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** The full event, plus the two facts every screen branches on. */
export interface EventDetail {
  id: string;
  hostId: string;
  title: string;
  note: string | null;
  occasion: string | null;
  dressCode: string | null;
  /** Null for the atlas's thinnest occasion: named, not yet dated (N-10). */
  startsAt: Date | null;
  endsAt: Date | null;
  partySize: number | null;
  visibility: EventVisibility;
  venueName: string | null;
  venueAddress: string | null;
  /** Coordinates when the place was resolved by the geocoder, else null —
   *  parsed, never the raw jsonb, so no screen can read a shape off it. */
  venueMeta: VenueCoords | null;
  reservationUrl: string | null;
  canceledAt: Date | null;
  /** Derived against the current user, so screens never re-derive it. */
  isHost: boolean;
  /** The caller's roster state. `null` = not on the roster at all. */
  myState: EventMemberState | null;
}

/** One face in the card's overlapping-avatar cluster. `name` is null for the
 *  caller's own chip — `social_profiles` excludes self by design. */
export interface AttendeeChip {
  userId: string;
  name: string | null;
}

/**
 * The list-cell projection — the Plan tab's Events segment and the invites
 * strip render from this. The first six fields are the §5.2 contract; the
 * rest were added for the founder's event-card mock (attendee cluster,
 * "4 of 6 going", per-viewer look status) and are additive only.
 */
export interface EventSummary {
  id: string;
  title: string;
  /** Null for a dateless occasion — every date-rendering surface branches on
   *  it rather than printing a placeholder day (new-occasion-spec.md §8). */
  startsAt: Date | null;
  venueName: string | null;
  myState: EventMemberState | null;
  isHost: boolean;
  /** Joined members — the "4" in "4 of 6 going". */
  memberCount: number;
  endsAt: Date | null;
  occasion: string | null;
  /** Everyone asked and not silently out — joined + still-deciding.
   *  The "6" in "4 of 6 going". Declines are absence, never a count. */
  invitedCount: number;
  /** Joined members for the avatar cluster, host first. */
  attendees: AttendeeChip[];
  /**
   * Whether the viewer has shared any look into this event yet. Read from
   * `event_outfit_posts` (the table, not the OUTFITS module — no import).
   * `posted` is the closest honest reading of the mock's LOOK SET until a
   * chosen/crowned state exists in the schema; see `queries.ts`.
   */
  myLookState: 'posted' | 'none';
}

/**
 * The membership slice the event queries embed alongside each event row.
 * Narrower than the full `EventMemberRow` on purpose: list queries embed the
 * roster only to derive `myState` and the two counts, and asking PostgREST
 * for fewer columns keeps the payload the size of the question.
 */
export type EmbeddedMemberRow = Pick<EventMemberRow, 'user_id' | 'role' | 'state'>;

/** An event row as the list/detail queries actually receive it. */
export type EventWithMembersRow = EventRow & { event_members: EmbeddedMemberRow[] };

/** The caller's roster state within an embedded roster, or null when absent. */
export function myMemberState(
  members: EmbeddedMemberRow[],
  currentUserId: string | null,
): EventMemberState | null {
  if (!currentUserId) return null;
  return members.find((m) => m.user_id === currentUserId)?.state ?? null;
}

/** Row → domain, for the detail screen. */
export function toEvent(row: EventWithMembersRow, currentUserId: string | null): EventDetail {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    note: row.note,
    occasion: row.occasion,
    dressCode: row.dress_code,
    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    partySize: row.party_size,
    visibility: row.visibility,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    venueMeta: parseVenueMeta(row.venue_meta),
    reservationUrl: row.reservation_url,
    canceledAt: row.canceled_at ? new Date(row.canceled_at) : null,
    isHost: currentUserId !== null && row.host_id === currentUserId,
    myState: myMemberState(row.event_members, currentUserId),
  };
}

/**
 * Row → domain, for list cells.
 *
 * `profiles` hydrates the avatar cluster (fetched once for the whole list, not
 * per event); `myPostedEventIds` carries which events the viewer has shared a
 * look into. Both are lookups, not fetches — the query layer owns the I/O.
 */
export function toEventSummary(
  row: EventWithMembersRow,
  currentUserId: string | null,
  extras: {
    profiles: ReadonlyMap<string, SocialProfileRow>;
    myPostedEventIds: ReadonlySet<string>;
  },
): EventSummary {
  const joined = row.event_members.filter((m) => m.state === 'joined');
  // Host first in the cluster — the person whose table it is leads the row.
  joined.sort((a, b) => (a.role === 'host' ? -1 : 0) - (b.role === 'host' ? -1 : 0));

  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    venueName: row.venue_name,
    myState: myMemberState(row.event_members, currentUserId),
    isHost: currentUserId !== null && row.host_id === currentUserId,
    memberCount: joined.length,
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    occasion: row.occasion,
    invitedCount: row.event_members.filter((m) => m.state === 'joined' || m.state === 'invited')
      .length,
    attendees: joined.map((m) => {
      const profile = extras.profiles.get(m.user_id) ?? null;
      return {
        userId: m.user_id,
        name: profile?.display_name ?? profile?.username ?? null,
      };
    }),
    myLookState: extras.myPostedEventIds.has(row.id) ? 'posted' : 'none',
  };
}

/**
 * Roster row + identity → domain.
 *
 * `profile` is null in two honest cases: the row is the caller's own (the
 * `social_profiles` view excludes self by design) or the profile fetch raced a
 * just-sent invite. Both render fine from nulls — screens that know the
 * current user id print "You" for the first case.
 */
export function toEventMember(
  row: Pick<EventMemberRow, 'user_id' | 'role' | 'state'>,
  profile: SocialProfileRow | null,
): EventMember {
  return {
    userId: row.user_id,
    role: row.role,
    state: row.state,
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };
}
