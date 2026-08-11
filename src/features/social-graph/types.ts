import { z } from 'zod';

import type {
  BorrowRequestRow,
  BorrowStatus,
  FriendClosetMetaRow,
  FriendItemRow,
  SocialProfileRow,
} from '@/features/social/db-rows';
import { supabase } from '@/lib/supabase';
import { itemColor } from '@/schemas/item';

/**
 * Formerly an untyped cast while the social tables postdated the generated
 * types; the regen has landed, so this is the typed client again. Kept as a
 * named export only because every social-graph call site imports it.
 */
export const socialDb = supabase;

// ---------------------------------------------------------------------------
// Domain shapes — camelCase, mirroring the closet/queries.ts `toItem` pattern.
// ---------------------------------------------------------------------------

export interface SocialProfile {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

/** What the UI calls a person: display name, else username, else a neutral noun. */
export function profileName(profile: Pick<SocialProfile, 'username' | 'displayName'>): string {
  return profile.displayName || profile.username || 'A Cinch member';
}

export function toSocialProfile(row: SocialProfileRow): SocialProfile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
  };
}

type FriendItemColor = z.infer<typeof itemColor>;

export interface FriendItem {
  id: string;
  userId: string;
  category: string;
  subcategory: string | null;
  colors: FriendItemColor[];
  pattern: string | null;
  material: string | null;
  brand: string | null;
  seasons: string[];
  occasions: string[];
  description: string | null;
  thumbPath: string | null;
  cutoutPath: string | null;
  platePath: string | null;
  borrowable: boolean;
  createdAt: string;
  wearCount: number;
  lastWornAt: string | null;
  /** commerce-directive.md C-04 — whether this piece's OWNER has opted the
   *  whole closet into "Find it" (C-05's `shoppable` flag). Whether the row
   *  actually renders also depends on the VIEWER's own "Show where to buy"
   *  preference (C-03), which this type does not carry — that lives on the
   *  viewer's own profile and is read separately. */
  shoppable: boolean;
}

const itemColorList = z.array(itemColor);

/**
 * The `colors` jsonb, parsed leniently — same reasoning and same salvage as
 * `toColors` in closet/queries.ts (which is private to that file, on purpose:
 * the two crossings validate independently). A friend's garment with one
 * unreadable swatch is still a garment worth rendering in her closet.
 */
function toColors(raw: unknown, itemId: string): FriendItemColor[] {
  if (raw === null || raw === undefined) return [];

  const whole = itemColorList.safeParse(raw);
  if (whole.success) return whole.data;

  const salvaged = Array.isArray(raw)
    ? raw.flatMap((entry) => {
        const one = itemColor.safeParse(entry);
        return one.success ? [one.data] : [];
      })
    : [];

  console.warn(
    `[social-graph] friend item ${itemId}: dropped ${
      (Array.isArray(raw) ? raw.length : 1) - salvaged.length
    } malformed colour entr(ies)`,
  );

  return salvaged;
}

export function toFriendItem(row: FriendItemRow): FriendItem {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    subcategory: row.subcategory,
    colors: toColors(row.colors, row.id),
    pattern: row.pattern,
    material: row.material,
    brand: row.brand,
    seasons: row.seasons,
    occasions: row.occasions,
    description: row.description,
    thumbPath: row.thumb_path,
    cutoutPath: row.cutout_path,
    platePath: row.plate_path,
    borrowable: row.borrowable,
    createdAt: row.created_at,
    wearCount: row.wear_count,
    lastWornAt: row.last_worn_at,
    shoppable: row.shoppable,
  };
}

/**
 * The Friend's Closet header, from `friend_closet_meta`. NULL stats are not
 * missing data: they are the owner declining to show that number (all three go
 * NULL together when `closetHidden` is set), so the mapping preserves nulls
 * rather than defaulting to zero — the UI renders a withheld stat differently
 * from an empty closet.
 */
export interface FriendClosetMeta {
  userId: string;
  bio: string | null;
  closetHidden: boolean;
  pieces: number | null;
  wearsLogged: number | null;
  costPerWear: number | null;
}

export function toFriendClosetMeta(row: FriendClosetMetaRow): FriendClosetMeta {
  return {
    userId: row.user_id,
    bio: row.bio,
    closetHidden: row.closet_hidden,
    pieces: row.pieces,
    wearsLogged: row.wears_logged,
    costPerWear: row.cost_per_wear,
  };
}

export interface BorrowRequest {
  id: string;
  itemId: string;
  ownerId: string;
  requesterId: string;
  eventId: string | null;
  message: string | null;
  status: BorrowStatus;
  createdAt: string;
  updatedAt: string;
}

export function toBorrowRequest(row: BorrowRequestRow): BorrowRequest {
  return {
    id: row.id,
    itemId: row.item_id,
    ownerId: row.owner_id,
    requesterId: row.requester_id,
    eventId: row.event_id,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Which side of a borrow request the signed-in user is standing on. */
export type BorrowDirection = 'incoming' | 'outgoing';

/**
 * The garment a borrow row is about, reduced to what both sides may see.
 * Incoming requests resolve it from the owner's own `items`; outgoing from
 * `friend_items` — either way it flattens to this.
 */
export interface BorrowItemPreview {
  id: string;
  category: string;
  subcategory: string | null;
  thumbPath: string | null;
  cutoutPath: string | null;
}

/** One borrow request, hydrated for rendering: who, which garment, which way. */
export interface BorrowThread {
  request: BorrowRequest;
  direction: BorrowDirection;
  /** The other woman. Null when a block or departure has taken her identity offline. */
  counterpart: SocialProfile | null;
  /** Null when the friendship (and with it the read path) has been revoked. */
  item: BorrowItemPreview | null;
}

/** One row of the blocked-users list. */
export interface BlockedUser {
  userId: string;
  blockedAt: string;
  /**
   * Identity, when it can still be shown. `social_profiles` screens out blocked
   * pairs by design, so this hydrates from `public_profiles` and resolves only
   * for public accounts — a private blocked account renders as a neutral row.
   */
  profile: SocialProfile | null;
}
