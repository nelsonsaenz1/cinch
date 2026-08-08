// Hand-written row shapes for the social tables/views, used until
// `npm run gen:types` regenerates src/types/database.ts. snake_case on
// purpose: these mirror the wire format, and each feature maps to camelCase
// in its own types.ts (the closet/queries.ts pattern).

export type EventVisibility = 'invite_only' | 'friends';
export type EventMemberRole = 'host' | 'attendee';
export type EventMemberState = 'invited' | 'joined' | 'declined' | 'removed';
export type BorrowStatus = 'pending' | 'approved' | 'declined' | 'canceled' | 'returned';
export type ReportSubject = 'profile' | 'item' | 'outfit_post' | 'comment' | 'event';

/**
 * The jsonb bag on `events.venue_meta` — a place-search payload, not a
 * managed entity (Migration B, 20260807101000). Typed as an open record
 * rather than the `{ latitude, longitude, source }` the place field writes:
 * the column has held whatever any writer put there since the day it was
 * created, and a row read today may predate that shape or come from a client
 * two versions behind. So the type promises only "some JSON object", and
 * `parseVenueMeta` in features/events/types.ts is what turns it into
 * coordinates or into null — never a cast.
 */
export type EventVenueMetaRow = Record<string, unknown>;

export interface EventRow {
  id: string; host_id: string; title: string; note: string | null;
  occasion: string | null; dress_code: string | null;
  /** Null since 20260808130000 — an occasion may be named and not yet dated. */
  starts_at: string | null; ends_at: string | null; party_size: number | null;
  visibility: EventVisibility;
  venue_name: string | null; venue_address: string | null;
  venue_meta: EventVenueMetaRow | null; reservation_url: string | null;
  canceled_at: string | null; created_at: string; updated_at: string;
}

export interface EventMemberRow {
  event_id: string; user_id: string; role: EventMemberRole;
  state: EventMemberState; invited_by: string | null;
  created_at: string; updated_at: string;
}

export interface EventOutfitPostRow {
  id: string; event_id: string; user_id: string; outfit_id: string;
  caption: string | null; created_at: string;
}

export interface EventOutfitVoteRow {
  post_id: string; event_id: string; voter_id: string; created_at: string;
}

export interface EventVoteCountRow {
  event_id: string; post_id: string; votes: number;
}

export interface EventCommentRow {
  id: string; event_id: string; post_id: string | null; user_id: string;
  body: string; reported: boolean; hidden: boolean; created_at: string;
}

export interface EventPostItemRow {
  post_id: string; event_id: string; item_id: string; position: number;
  user_id: string; category: string; subcategory: string | null;
  colors: unknown; thumb_path: string | null; cutout_path: string | null;
  plate_path: string | null; borrowable: boolean;
}

export interface BorrowRequestRow {
  id: string; item_id: string; owner_id: string; requester_id: string;
  event_id: string | null; message: string | null; status: BorrowStatus;
  created_at: string; updated_at: string;
}

export interface SocialProfileRow {
  user_id: string; username: string | null; display_name: string | null;
  avatar_url: string | null; bio: string | null;
}

export interface FriendItemRow {
  id: string; user_id: string; category: string; subcategory: string | null;
  colors: unknown; pattern: string | null; material: string | null;
  brand: string | null; seasons: string[]; occasions: string[];
  description: string | null; thumb_path: string | null;
  cutout_path: string | null; plate_path: string | null;
  borrowable: boolean; created_at: string;
  wear_count: number; last_worn_at: string | null;
}

// One row per friend from `friend_closet_meta` — the header of the Friend's
// Closet page. Friendship-gated server-side; a NULL stat means the owner hid
// that stat (all three are NULL when the whole closet is hidden), so NULL and
// zero are different answers and must stay distinguishable.
export interface FriendClosetMetaRow {
  user_id: string; bio: string | null; closet_hidden: boolean;
  pieces: number | null; wears_logged: number | null;
  cost_per_wear: number | null;
}

export interface UserBlockRow {
  blocker_id: string; blocked_id: string; created_at: string;
}

export interface FollowRow {
  follower_id: string; followee_id: string; created_at: string;
}
