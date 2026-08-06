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
  startsAt: Date;
  endsAt: Date | null;
  partySize: number | null;
  visibility: EventVisibility;
  venueName: string | null;
  venueAddress: string | null;
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
  startsAt: Date;
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
    startsAt: new Date(row.starts_at),
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    partySize: row.party_size,
    visibility: row.visibility,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
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
    startsAt: new Date(row.starts_at),
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
