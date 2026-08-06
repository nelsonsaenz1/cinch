import type {
  EventCommentRow,
  EventOutfitPostRow,
  EventPostItemRow,
} from '@/features/social/db-rows';
import { toGarment, type Garment, type ItemRow } from '@/lib/styling';

/**
 * Domain shapes for the event outfit board — posts, votes, comments — mapped
 * from the wire rows in `@/features/social/db-rows` (Agent DB's seam) the same
 * way `closet/queries.ts` maps items: snake_case stays at the query boundary,
 * everything the screens touch is camelCase.
 */

/** One outfit option a member pinned to her board. */
export type EventOutfitPost = {
  id: string;
  eventId: string;
  userId: string;
  outfitId: string;
  caption: string | null;
  createdAt: Date;
};

/**
 * A post composed into something a screen can render: the garments (from the
 * `event_post_items` projection — never a grant on `items`), the tally (from
 * `event_vote_counts`), and the signed picks (votes are signed on purpose —
 * "Dana picked this one" is social warmth, not surveillance).
 */
export type PostedLook = EventOutfitPost & {
  garments: Garment[];
  votes: number;
  voterIds: string[];
};

/**
 * One attendee's board. The grouping is load-bearing product design: every
 * poll is one woman's options judged against each other, never attendees
 * ranked against each other. Nothing in this module may compare boards.
 */
export type AttendeeBoard = {
  userId: string;
  looks: PostedLook[];
};

export type EventComment = {
  id: string;
  eventId: string;
  /** null = the event-level thread; set = a comment on one look. */
  postId: string | null;
  userId: string;
  body: string;
  reported: boolean;
  hidden: boolean;
  createdAt: Date;
};

/** The caller's one movable pick for this event, or null. */
export type MyVote = { postId: string } | null;

/**
 * The compliment vocabulary — fixed, positive-only, in the stylist's voice
 * (product-spec §3.5). There is deliberately no free-emoji path and no
 * down-reaction of any kind; a compliment is sent as a signed comment on the
 * look, which is the only text-carrying surface the schema provides.
 */
export const COMPLIMENTS = ['That’s the one', 'So you', 'Chic', 'Bold', 'Obsessed'] as const;

export type Compliment = (typeof COMPLIMENTS)[number];

export const isCompliment = (body: string): boolean =>
  (COMPLIMENTS as readonly string[]).includes(body);

/** Max active looks per member per occasion (product-spec §3.4). */
export const MAX_LOOKS_PER_BOARD = 3;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function toEventOutfitPost(row: EventOutfitPostRow): EventOutfitPost {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    outfitId: row.outfit_id,
    caption: row.caption,
    createdAt: new Date(row.created_at),
  };
}

export function toEventComment(row: EventCommentRow): EventComment {
  return {
    id: row.id,
    eventId: row.event_id,
    postId: row.post_id,
    userId: row.user_id,
    body: row.body,
    reported: row.reported,
    hidden: row.hidden,
    createdAt: new Date(row.created_at),
  };
}

/**
 * An `event_post_items` row -> the engine's `Garment`, so the board renders
 * with the exact stack machinery Today uses (`stackLayout`, `GarmentCell`).
 *
 * The projection view deliberately serves presentation columns only — no
 * prices, no wear counts, no formality scores — so the row is widened into a
 * stub `ItemRow` with the same neutral defaults `toGarment` itself falls back
 * to. Reusing `toGarment` rather than hand-building a `Garment` keeps slot
 * derivation and visual weights in exactly one place.
 */
export function toPostGarment(row: EventPostItemRow): Garment {
  const stub: Partial<ItemRow> = {
    id: row.item_id,
    user_id: row.user_id,
    category: row.category as ItemRow['category'],
    subcategory: row.subcategory,
    colors: row.colors as ItemRow['colors'],
    pattern: null,
    material: null,
    brand: null,
    formality_score: null,
    warmth_score: null,
    water_resistant: false,
    seasons: [],
    occasions: [],
    description: null,
    wear_count: 0,
    last_worn_at: null,
    purchase_price: null,
    thumb_path: row.thumb_path,
    cutout_path: row.cutout_path,
    plate_path: row.plate_path,
  };
  return toGarment(stub as ItemRow);
}

/**
 * Group looks into per-attendee boards, preserving post order within a board.
 * Board order is the caller's job (roster order, self first) — this helper
 * only refuses to lose a poster whose member row the roster query missed.
 */
export function boardsFor(looks: PostedLook[]): AttendeeBoard[] {
  const byUser = new Map<string, PostedLook[]>();
  for (const look of looks) {
    const list = byUser.get(look.userId) ?? [];
    list.push(look);
    byUser.set(look.userId, list);
  }
  return [...byUser.entries()].map(([userId, list]) => ({ userId, looks: list }));
}

/**
 * The pick-leader of one board — the look crowned once the board locks.
 *
 * Strictly within one attendee's own options: ties break to the earliest
 * pinned (she led longest), and a board with zero picks crowns nothing rather
 * than inventing a winner. Never called across boards.
 */
export function boardLeader(looks: PostedLook[]): PostedLook | null {
  let leader: PostedLook | null = null;
  for (const look of looks) {
    if (look.votes === 0) continue;
    if (
      !leader ||
      look.votes > leader.votes ||
      (look.votes === leader.votes && look.createdAt < leader.createdAt)
    ) {
      leader = look;
    }
  }
  return leader;
}
