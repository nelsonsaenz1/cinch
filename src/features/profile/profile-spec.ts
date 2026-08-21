/**
 * Profile — your own room. What the page decides before it draws. Redesign 07.
 *
 * A `.ts`, not a `.tsx`, for the reason `trips-list-spec.ts`, `trip-detail-spec.ts`
 * and `plan-week-spec.ts` all give: the node test bundler cannot parse React
 * Native's Flow source, so anything worth PINNING must not reach a component
 * file. Everything here is a pure function of its arguments — no hooks, no
 * ambient clock, no query. That is what lets `tests/profile-layout.test.ts`
 * assert the plan door, the marks and the friends line directly instead of
 * inferring them from a render.
 *
 * ── THE ORDER, WHICH IS THE BRIEF ────────────────────────────────────────────
 *
 * Directive §7 states it as the founder's own spec, and it is not a preference:
 * identity compact at top (avatar, name, handle, a tappable friends count),
 * then Most worn, then Favorite outfits, then the stats as designed marks, then
 * the capacity/plan door as ONE quiet row, then closet photos at the bottom as
 * a tight grid. `PROFILE_SECTIONS` writes the order down so a test can hold it;
 * the body draws it in exactly that sequence.
 *
 * ── WHAT THIS PAGE REFUSES TO INVENT ─────────────────────────────────────────
 *
 * Every number on it is read, never estimated. Pieces is the closet's own
 * length, outfits made is `useOutfitCount`, cost-per-wear is `closetStats`'s
 * average over the pieces that have BOTH a price and a wear — and each mark is
 * simply absent when its number is not known yet. A mark drawn as "—" or as a
 * zero is a claim about somebody's wardrobe that the data did not make, which
 * is the same refusal `StatRow` and the plate's cost-per-wear line already
 * carry.
 *
 * The plan door's ceiling comes from `plans.ts` through `useCapacity`, per the
 * constraint that survives every redesign: "numbers shown to users derive from
 * plans.ts". The artifact's own 45-piece free ceiling is frame fiction and is
 * NOT copied here.
 */

// ---------------------------------------------------------------------------
// Copy — the artifact's words, and nothing that promises a count it cannot make
// ---------------------------------------------------------------------------

export const PROFILE_COPY = {
  /** The rail headers, set in their area accents. */
  mostWorn: 'Most worn',
  favorites: 'Favorite outfits',
  closet: 'Closet',
  seeAll: 'See all',

  /** The stat marks. */
  pieces: 'Pieces',
  outfitsMade: 'Outfits made',
  costPerWear: 'Cost per wear',

  /** The friends count, which is a door and not a statistic. */
  noFriends: 'No friends yet',
  friendsHint: 'Opens your friends list',

  /** The overflow control and its rows. */
  more: 'More',
  moreHint: 'Edit your profile, open your wear diary, or open settings',
  editProfile: 'Edit profile',
  diary: 'Wear diary',
  done: 'Done',

  /** Empty — a new account, nothing in the closet yet. */
  emptyTitle: 'Your room is empty',
  emptyBody: 'Add a few pieces and the rails fill themselves.',
  emptyAction: 'Add to your closet',

  /** Error — the rails did not load, and the closet on the device still can. */
  offlineKicker: 'Offline',
  offlineTitle: 'Your rails didn’t load',
  offlineBody: 'The closet below is what’s saved on this device.',
  /**
   * The state the artifact did not draw: the read failed AND there is nothing
   * cached underneath it. The frame's line would be pointing at a grid that is
   * not there, so the band says the true thing instead.
   */
  offlineBodyEmpty: 'Nothing is saved on this device yet.',
  tryAgain: 'Try again',

  /** The plan door's own action word, for a free account. */
  upgrade: 'Upgrade',
} as const;

/**
 * ── THE ONE PROSE LINE THIS PAGE KEEPS ───────────────────────────────────────
 *
 * "What Cinch has learned" was a titled card of paragraph copy, and the
 * direction is explicit that explanation becomes structure or dies. It does not
 * die: the sentence is a real read of the style profile and a capability the
 * Profile/Settings reconciliation names, so it survives as ONE quiet line under
 * the marks — no header, no card, no retry button of its own.
 */

/** How many reactions the style engine wants before it will say anything. */
export const TASTE_THRESHOLD = 8;

/** "a, b, and c" — never an Oxford-less run-on, never a trailing "and" for one. */
export function joinNaturally(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * The honest sentence, or nothing at all.
 *
 * The words are the shipped card's own words, unchanged — they were already the
 * right ones, and the redesign moved the sentence rather than rewriting it. The
 * one behaviour that changes is the failure: the card used to draw an error
 * branch with a retry button, and a quiet line has nowhere to put one, so a
 * failed read simply says nothing. That is strictly better than what the branch
 * existed to prevent, which was a failed read falling through to
 * `feedbackCount = 0` and telling somebody with months of reactions "Nothing
 * yet" — an error asserting something false about their taste.
 */
export function learnedLine(input: {
  failed: boolean;
  loading: boolean;
  feedbackCount: number;
  summary: readonly string[];
}): string | null {
  if (input.failed || input.loading) return null;
  if (input.feedbackCount === 0) {
    return 'Nothing yet — react to a few outfits and Cinch will start learning what you actually wear.';
  }
  if (input.feedbackCount < TASTE_THRESHOLD) {
    const remaining = TASTE_THRESHOLD - input.feedbackCount;
    return `Still early. ${remaining} more ${remaining === 1 ? 'reaction' : 'reactions'} and Cinch will start recognizing your taste.`;
  }
  return input.summary.length > 0
    ? `Still learning. So far you ${joinNaturally(input.summary)}. Learned from ${input.feedbackCount} reactions.`
    : `Learned from ${input.feedbackCount} reactions, but no clear pattern yet.`;
}

// ---------------------------------------------------------------------------
// The order — the founder's spec, written down so it can be held
// ---------------------------------------------------------------------------

export const PROFILE_SECTIONS = [
  'identity',
  'most-worn',
  'favorites',
  'marks',
  'plan-door',
  'closet',
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// Identity — the friends count, which is the only number in the header
// ---------------------------------------------------------------------------

/**
 * "12 friends", "1 friend", "No friends yet" — or nothing at all.
 *
 * `undefined` is the count not being known yet, and it returns `null` rather
 * than a zero: "No friends yet" is a statement about somebody's circle, and a
 * query in flight has not made it. The same em-dash rule `StatRow` keeps, said
 * by drawing nothing instead of a dash.
 */
export function friendsLabel(count: number | undefined): string | null {
  if (count === undefined) return null;
  if (count <= 0) return PROFILE_COPY.noFriends;
  return `${count} ${count === 1 ? 'friend' : 'friends'}`;
}

/**
 * Whether the friends pill reads as a door or as a quiet fact.
 *
 * At zero it is still a door — the friends list is where requests and the
 * invite path live, which is exactly what somebody with no friends needs — but
 * it loses the blush ground and the oxblood, because an emphasised "No friends
 * yet" is the app being loud about an absence. The artifact draws it exactly
 * this way.
 */
export function friendsTone(count: number | undefined): 'accent' | 'quiet' {
  return count !== undefined && count > 0 ? 'accent' : 'quiet';
}

// ---------------------------------------------------------------------------
// The stat marks
// ---------------------------------------------------------------------------

export type StatMarkId = 'pieces' | 'outfits' | 'cost';

export type StatMark = {
  id: StatMarkId;
  /** The serif figure, already formatted. */
  figure: string;
  /** The tracked uppercase label under it. */
  label: string;
  /** The one mark that carries the warm ground and the oxblood figure. */
  accent: boolean;
};

/** "$4.10" — two places, always, so a column of marks cannot jitter. */
export function costPerWearFigure(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * The marks, in the artifact's order, with each one absent when its number is
 * not known.
 *
 * Three inputs, three different kinds of unknown:
 *
 * · `pieces` is the closet this page is already drawing, so it is always known
 *   by the time any mark renders — the page is in its loading state otherwise.
 * · `outfits` is `undefined` until `useOutfitCount` lands. The mark is dropped
 *   rather than drawn as a zero or a dash; it appears a beat later, which is
 *   honest, where "0 OUTFITS MADE" under somebody's thirty looks is not.
 * · `avgCostPerWear` is `null` when no piece carries both a price and a wear.
 *   The brief says "cost-per-wear if present" and this is what present means.
 *
 * Exactly one mark is accented, and it is the middle one — the artifact spends
 * the warm ground on outfits made, and the page's single filled oxblood is
 * spent elsewhere (the empty state's CTA, or the error state's retry).
 */
export function statMarks(input: {
  pieces: number;
  outfits: number | undefined;
  avgCostPerWear: number | null;
}): StatMark[] {
  const marks: StatMark[] = [
    { id: 'pieces', figure: String(input.pieces), label: PROFILE_COPY.pieces, accent: false },
  ];

  if (input.outfits !== undefined) {
    marks.push({
      id: 'outfits',
      figure: String(input.outfits),
      label: PROFILE_COPY.outfitsMade,
      accent: true,
    });
  }

  if (input.avgCostPerWear !== null && Number.isFinite(input.avgCostPerWear)) {
    marks.push({
      id: 'cost',
      figure: costPerWearFigure(input.avgCostPerWear),
      label: PROFILE_COPY.costPerWear,
      accent: false,
    });
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Favorite outfits — owner-private, and said so at the largest type
// ---------------------------------------------------------------------------

/**
 * "4 saved, only you can see them".
 *
 * The rail's tiles carry the privacy fact by being unlabelled and unshareable;
 * at accessibility sizes the rail collapses to this line, which is where the
 * fact has to become words. Returns `null` at zero, where the rail does not
 * draw at all and a line about nothing would be noise.
 */
export function favoritesPrivacyLine(count: number): string | null {
  if (count <= 0) return null;
  return `${count} saved, only you can see them`;
}

// ---------------------------------------------------------------------------
// The plan door — one quiet row, with the routing exactly as it shipped
// ---------------------------------------------------------------------------

export type PlanDoorRoute = 'manage' | 'paywall' | 'none';

export type PlanDoor = {
  /** "Standard · 84 of 150 pieces". */
  line: string;
  /** Blush and an "Upgrade" word for a free account; tray and a chevron otherwise. */
  tone: 'blush' | 'quiet';
  /** The action word, or `null` when the row carries a chevron instead. */
  action: string | null;
  /** How full the closet is, 0–1, for the free row's capacity mark. */
  fill: number;
  /** Where a press goes — and `'none'` is a row that is not a control at all. */
  route: PlanDoorRoute;
};

/** "84 of 150 pieces" — the numerator and the ceiling, both read. */
export function capacityLine(used: number, limit: number): string {
  return `${used} of ${limit} ${limit === 1 ? 'piece' : 'pieces'}`;
}

/**
 * The one quiet row, or `null` when the page must not make a claim yet.
 *
 * ── WHY `null` RATHER THAN A ROW WITH BLANKS ─────────────────────────────────
 *
 * `usePlan` answers `free` on an unreadable read — the right answer for a gate
 * and a false claim for a label reading "Cinch Free" — and `useCapacity`
 * derives its ceiling from whatever plan it was handed. So a row drawn while
 * the plan is loading or unconfirmed would print somebody's Standard closet
 * against the free ceiling. The row holds its geometry as a skeleton instead;
 * the correction 30 rule from the screen this replaces, unchanged: a pending
 * count is not a zero.
 *
 * ── WHY PRO GETS A ROW BUT NOT A DOOR ────────────────────────────────────────
 *
 * The shipped screen never showed a membership door to a Pro member and this
 * does not start. The capacity is still a fact worth stating, so the row draws
 * — with no chevron, no action word and no press. There is nothing behind it to
 * sell.
 *
 * The two doors that do exist are the ones that shipped: Standard goes to the
 * membership page it has, free meets the same placement it always met.
 */
export function planDoorFor(input: {
  plan: 'free' | 'standard' | 'pro';
  planName: string;
  planLoading: boolean;
  planUnconfirmed: boolean;
  capacityLoading: boolean;
  used: number;
  limit: number;
}): PlanDoor | null {
  if (input.planLoading || input.planUnconfirmed || input.capacityLoading) return null;
  if (input.limit <= 0) return null;

  const line = `${input.planName} · ${capacityLine(input.used, input.limit)}`;
  const fill = Math.max(0, Math.min(1, input.used / input.limit));

  if (input.plan === 'free') {
    return { line, tone: 'blush', action: PROFILE_COPY.upgrade, fill, route: 'paywall' };
  }
  if (input.plan === 'standard') {
    return { line, tone: 'quiet', action: null, fill, route: 'manage' };
  }
  return { line, tone: 'quiet', action: null, fill, route: 'none' };
}

// ---------------------------------------------------------------------------
// Which of the six frames the page is in
// ---------------------------------------------------------------------------

export type ProfileBodyState = 'loading' | 'error' | 'empty' | 'ready';

/**
 * The frame the page draws, decided once and in one place.
 *
 * Order matters and is the artifact's:
 *
 *  · `loading` while the closet read is in flight — every rail, mark and tile
 *    on this page is derived from it, so there is no partial page to draw.
 *  · `error` when that read failed. The identity block and whatever closet is
 *    cached stay on screen; only the rails and the marks are withheld, because
 *    they are the things the failed read was carrying.
 *  · `empty` for a closet with nothing in it — a new account, drawn as the
 *    rails it is going to have rather than as an apology.
 *  · `ready` otherwise.
 *
 * A failed read WITH cached rows is still `error`: the band has to say that the
 * grid underneath is what is on the device, and a page that silently served
 * stale rows as if they were fresh is the failure that band exists to name.
 */
export function profileBodyState(input: {
  closetLoading: boolean;
  closetError: boolean;
  pieces: number;
}): ProfileBodyState {
  if (input.closetLoading) return 'loading';
  if (input.closetError) return 'error';
  if (input.pieces <= 0) return 'empty';
  return 'ready';
}

// ---------------------------------------------------------------------------
// Geometry — the artifact's measures, and their large-type pairs
// ---------------------------------------------------------------------------

/** The identity block. */
export const AVATAR_SIZE = 66;
export const AVATAR_SIZE_AX = 64;
export const IDENTITY_GAP = 14;

/** The friends pill, and the full-width row it becomes. */
export const FRIENDS_RADIUS = 12;
export const FRIENDS_ROW_RADIUS_AX = 16;
export const FRIENDS_ROW_MIN_HEIGHT_AX = 60;

/** The overflow control — a 44pt square, which is the floor and the frame. */
export const MORE_SIZE = 44;
export const MORE_RADIUS = 12;
export const MORE_DOT = 4;

/** The two image rails. */
export const RAIL_TILE_WIDTH = 106;
export const RAIL_TILE_HEIGHT = 112;
export const RAIL_TILE_WIDTH_AX = 164;
export const RAIL_TILE_HEIGHT_AX = 168;
export const RAIL_TILE_RADIUS = 12;
export const RAIL_GAP = 6;
export const RAIL_GAP_AX = 8;

/** How many tiles each rail may hold. Both are existing limits, not new reads. */
export const MOST_WORN_TILES = 8;
export const FAVORITE_TILES = 8;

/** The favourite mark riding the corner of a favourite tile. */
export const FAVORITE_DOT = 20;
export const FAVORITE_DOT_INNER = 7;

/** The marks. */
export const MARK_RADIUS = 16;
/** What a mark's skeleton stands in at — the real mark's own resting height. */
export const MARK_SKELETON_HEIGHT = 74;

/** The pointer on a row that leads somewhere. A glyph, so it takes points. */
export const CHEVRON_SIZE = 9;
export const CHEVRON_SIZE_AX = 11;

/** The plan door. */
export const PLAN_ROW_RADIUS = 16;
export const PLAN_ROW_MIN_HEIGHT = 52;
export const PLAN_ROW_MIN_HEIGHT_AX = 60;
export const PLAN_TRACK_WIDTH = 40;
export const PLAN_TRACK_HEIGHT = 6;

/** The closet grid — tight, and bled to both edges. */
export const CLOSET_COLUMNS = 4;
export const CLOSET_COLUMNS_AX = 2;
export const CLOSET_GAP = 2;
export const CLOSET_TILE_HEIGHT = 92;
export const CLOSET_TILE_HEIGHT_AX = 132;
/** Two rows of the grid. The closet itself is one tap away and holds the rest. */
export const CLOSET_TILES = 8;

/**
 * The empty state's ghost rails, and the garments drawn inside them.
 *
 * The direction is explicit that an empty state should DRAW THE OBJECT rather
 * than explain it, and the artifact does: the three Most worn ghosts carry a
 * dress, a hat and a shoe as bare outlines. They are furniture — never
 * announced, never a picture of anything the reader owns — so they are geometry
 * here rather than an asset.
 */
export const GHOST_SHAPES = [
  { width: 36, height: 54, radius: 7 },
  { width: 38, height: 38, radius: 19 },
  { width: 42, height: 26, radius: 6 },
] as const;

export const GHOST_COLUMNS = 3;
export const GHOST_TILE_HEIGHT = 118;
export const GHOST_TILE_HEIGHT_FAVORITES = 100;

/** The one filled control on the states that have one. */
export const CTA_MIN_HEIGHT = 56;
export const CTA_RADIUS = 16;

/** The offline band, matching the shelf's own. */
export const BAND_RADIUS = 9;
export const BAND_DOT = 8;

/** The overflow menu's card. */
export const MENU_WIDTH = 232;
export const MENU_RADIUS = 16;

/**
 * Where the page recomposes instead of shrinking.
 *
 * The same threshold Plan's week, the event poster, the trips shelf and the
 * packing plate use — one number for the whole redesign, so two rebuilt pages
 * cannot disagree about what "large" is.
 */
export { AX_STACK_SCALE as PROFILE_STACK_SCALE } from '@/features/closet/dynamic-type';
