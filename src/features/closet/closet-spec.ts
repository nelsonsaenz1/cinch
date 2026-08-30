import { PLANS, type Plan } from '@/features/billing/plans';

/**
 * The closet — what the screen decides before it draws. Redesign 14.
 *
 * A `.ts` with no React and no `.tsx` import, on the wave's rule: the node
 * bundler cannot parse React Native's Flow source, so anything a test needs to
 * read has to live where no component can reach it.
 *
 * ── WHAT THIS SCREEN IS ─────────────────────────────────────────────────────
 *
 * A personal material library. Everything on it — the counts, the ceilings,
 * every mutation — is SERVER-AUTHORITATIVE; this module and the components
 * that read it display and preflight, and nothing here decides whether a write
 * is allowed. The server refuses correctly either way, and the cost of the
 * client being wrong is one honest error rather than a false wall.
 */

// ---------------------------------------------------------------------------
// Capacity — one number is not enough
// ---------------------------------------------------------------------------

/**
 * The three states a closet's capacity can be in.
 *
 * `active_full` and `total_full` are kept apart because THEY HAVE DIFFERENT
 * REMEDIES, and that is the whole reason this type exists rather than a
 * boolean. A closet at its active limit with storage to spare is fixed by
 * storing a piece: the slot frees and the piece stays in the total. A closet
 * whose storage is also full cannot be fixed that way at all, and offering
 * "Store pieces" there would be sending somebody to a door that is bricked up.
 */
export type CapacityState = 'room' | 'active_full' | 'total_full';

export function capacityState(input: {
  active: number;
  activeLimit: number;
  stored: number;
  storedLimit: number;
}): CapacityState {
  // Total first: a closet whose storage is full is in that state whether or
  // not the active grid also happens to be full, because storing is off the
  // table either way.
  if (input.stored >= input.storedLimit) return 'total_full';
  if (input.active >= input.activeLimit) return 'active_full';
  return 'room';
}

export type CapacityRemedy = {
  /** The sentence, or null when there is nothing to remedy. */
  body: string | null;
  /** The door's label, or null. */
  action: string | null;
  /** Which door: the plans placement, or the store flow. */
  door: 'plans' | 'store' | null;
};

/**
 * What to say, and which door to open.
 *
 * ── WHY FREE AND PAID DIFFER AT THE SAME STATE ──────────────────────────────
 *
 * Both are at the active limit with storage to spare, and both are told the
 * truth — but the USEFUL truth is different. On free, ten active is small
 * enough that storing is a treadmill: you free one slot and fill it, and the
 * honest primary is the larger closet. On a paid plan, a hundred and fifty
 * active is a closet somebody has actually built, and storing genuinely is the
 * right move: it keeps the piece and frees the slot.
 *
 * So free opens the plans door with no sentence in front of it — the band's
 * own numbers already state the fact, and the action is the remedy — while
 * paid names storing and opens the store flow, because storing is genuinely
 * the paid tier's right move.
 */
export function capacityRemedy(state: CapacityState, plan: Plan): CapacityRemedy {
  if (state === 'room') return { body: null, action: null, door: null };

  if (state === 'total_full') {
    return {
      // Storing cannot help, so the copy says exactly that rather than leaving
      // somebody to discover it by trying.
      body: 'Storage is full too, so storing will not free a slot. Delete a piece or move to a larger closet.',
      action: 'See plans',
      door: 'plans',
    };
  }

  return plan === 'free'
    ? {
        // No sentence — founder, 2026-08-26: the band's own numbers already
        // say the closet is full, and "store a piece to free a slot" read as
        // homework in front of the door. The action alone carries the remedy.
        body: null,
        action: 'See plans',
        door: 'plans',
      }
    : {
        body: 'Storing a piece frees an active slot and keeps it in your total.',
        action: 'Store pieces',
        door: 'store',
      };
}

/**
 * Whether the add control is disabled. It never is.
 *
 * A stated function rather than an absent one, because "Add piece stays
 * enabled at the limit" is a contract somebody could quietly break by adding a
 * `disabled` prop, and a test needs something to hold. The wall is met at the
 * ADD ATTEMPT, truthfully, by the server — a control greyed out before the
 * attempt teaches people the app is broken rather than that their closet is
 * full.
 */
export function addPieceDisabled(): false {
  return false;
}

/** The two segments of the capacity track, as fractions of the whole. */
export function capacityTrack(input: {
  active: number;
  stored: number;
  storedLimit: number;
}): { activeFraction: number; storedFraction: number } {
  const total = Math.max(1, input.storedLimit);
  const active = Math.max(0, Math.min(input.active, total));
  const stored = Math.max(0, Math.min(input.stored - active, total - active));
  return { activeFraction: active / total, storedFraction: stored / total };
}

/** "84 of 150 active" — the line above the track. */
export function activeLine(active: number, limit: number): string {
  return `${active} of ${limit} active`;
}

/**
 * "26 stored · 110 of 450" — the line below it.
 *
 * `stored` here is the ARCHIVED count and the second figure is the total,
 * because those are the two facts the ceiling is about: how many are put away,
 * and how much of the whole closet is spoken for.
 */
export function storedLine(archived: number, total: number, storedLimit: number): string {
  return `${archived} stored · ${total} of ${storedLimit}`;
}

/** "84 active · 26 stored", or "12 active · none stored" — the masthead's line. */
export function mastheadCounts(active: number, archived: number): string {
  return `${active} active · ${archived === 0 ? 'none' : archived} stored`;
}

/** The ceilings, read from `plans.ts` so a tier change moves them all at once. */
export function ceilingsFor(plan: Plan): { active: number; total: number } {
  return { active: PLANS[plan].items, total: PLANS[plan].storedItems };
}

// ---------------------------------------------------------------------------
// The rails
// ---------------------------------------------------------------------------

/**
 * Which rails have earned their place.
 *
 * EITHER RAIL IS ABSENT, NEVER EMPTY. A rail with no cards in it is a promise
 * the screen cannot keep — it says "you have most-worn pieces" to somebody who
 * has worn nothing — and the space is better spent on the grid, which always
 * has something in it.
 *
 * Most worn is derived from WEAR DATA. Favourite outfits is the private
 * favourite-OUTFITS rail from redesign 13; it is not a favourite-garment
 * state, and no garment on this screen carries a favourite marker.
 */
export type RailsPresent = 'none' | 'worn' | 'outfits' | 'both';

export function railsPresent(hasMostWorn: boolean, hasFavoriteOutfits: boolean): RailsPresent {
  if (hasMostWorn && hasFavoriteOutfits) return 'both';
  if (hasMostWorn) return 'worn';
  if (hasFavoriteOutfits) return 'outfits';
  return 'none';
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Which filters are active, for the one bounded analytics enum. */
export type FilterKind = 'category' | 'search' | 'both' | null;

export function filterKind(category: string, query: string): FilterKind {
  const cat = category !== 'All';
  const q = query.trim().length > 0;
  if (cat && q) return 'both';
  if (cat) return 'category';
  if (q) return 'search';
  return null;
}

/**
 * "Dresses · 2 of 14 match" — the title when a category and a search compose.
 *
 * The count always describes the CURRENT QUERY and never the whole closet.
 * A row of chips that kept showing whole-closet numbers inside a search would
 * be telling somebody there are twenty-two tops while showing them two.
 */
export function composedTitle(category: string, matched: number, inCategory: number): string {
  return category === 'All'
    ? `${matched} ${matched === 1 ? 'match' : 'matches'}`
    : `${matched} of ${inCategory} match`;
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export type SelectionSize = 'one' | 'many' | 'all';

/**
 * How large a selection is, as a bounded enum.
 *
 * Zero returns null and is not reported: an empty selection is a mode somebody
 * entered and has not used, not an action worth a row in a funnel. `all` is
 * relative to what is ON SCREEN, which is what "Actions apply to the filtered
 * set only" means and why the number is never the whole closet's.
 */
export function selectionSize(picked: number, shown: number): SelectionSize | null {
  if (picked <= 0) return null;
  if (picked >= shown && shown > 0) return 'all';
  return picked === 1 ? 'one' : 'many';
}

/** "Select all" until everything shown is picked, then "Deselect all". */
export function selectAllLabel(picked: number, shown: number): string {
  return picked >= shown && shown > 0 ? 'Deselect all' : 'Select all';
}

export function selectionCountLabel(picked: number): string {
  return `${picked} selected`;
}

/**
 * The note under the selection actions.
 *
 * At `all` it states the boundary outright — the actions apply to the FILTERED
 * set, not to the closet — because "Select all" inside a category filter is
 * the one place somebody could reasonably fear they had just selected
 * everything they own.
 */
export function selectionNote(picked: number, shown: number): string {
  return picked >= shown && shown > 0
    ? `All ${shown} shown ${shown === 1 ? 'piece is' : 'pieces are'} selected. Actions apply to the filtered set only.`
    : 'Storing frees an active slot and keeps the piece in your total.';
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

export type BulkAction = 'recategorise' | 'store' | 'restore' | 'delete';

export function storeConfirmTitle(count: number): string {
  return `Store ${count} ${count === 1 ? 'piece' : 'pieces'}?`;
}

export function deleteConfirmTitle(count: number): string {
  return `Delete ${count} ${count === 1 ? 'piece' : 'pieces'}?`;
}

export function moveTitle(count: number): string {
  return `Move ${count} ${count === 1 ? 'piece' : 'pieces'} to`;
}

/**
 * What a partial failure says.
 *
 * It names WHAT SURVIVED rather than what broke, because that is the fact the
 * reader needs before deciding whether to retry: "two of the three are still
 * on the server" tells them the operation was partial and the selection is
 * still worth keeping. A bare "something went wrong" leaves them to guess
 * whether pressing again deletes the first one twice.
 */
export function bulkFailureBody(action: BulkAction, remaining: number, total: number): string {
  const verb = action === 'delete' ? 'removed' : action === 'store' ? 'stored' : 'changed';
  const stillThere =
    remaining === total
      ? `Nothing was ${verb} and your selection is still here.`
      : `Your selection is still here. ${remaining} of the ${total} ${remaining === 1 ? 'piece is' : 'pieces are'} still on the server.`;
  return stillThere;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Three columns at a normal text size, ONE at an accessibility size.
 *
 * Not two, and not a peeking half column. A partially cut third column reads
 * as a horizontal scroll affordance the grid does not have, and it does not
 * reflow cleanly. One column at AX is the point: a three-column grid at
 * AX-XXXL is three crushed cards with clamped labels, which is worse for the
 * reader it is meant to help than a list would be.
 */
export const GRID_COLUMNS = 3;
export const GRID_COLUMNS_AX = 1;
export const GRID_GUTTER = 2;

/**
 * Rows part further than columns, because rows end in words. The 2pt gutter
 * is right BETWEEN wells — image against image, where the frames do the
 * separating — but a card's bottom edge is its caption ("Never worn",
 * "Worn 2 times"), and 2pt put that line nearly touching the next row's
 * photograph: text sandwiched between images, reading as annotation of the
 * wrong card (founder screenshot, 2026-08-30). Twelve gives the caption its
 * own band without loosening the columns.
 */
export const GRID_ROW_GAP = 12;

export function gridColumns(ax: boolean): number {
  return ax ? GRID_COLUMNS_AX : GRID_COLUMNS;
}

/** The add control: a 60pt circle, clear of the tab bar at every height. */
export const FAB_SIZE = 60;
export const FAB_RIGHT = 20;
export const FAB_BOTTOM = 100;

export const CHIP_HEIGHT = 44;
export const CHIP_HEIGHT_AX = 56;
export const CHIP_RADIUS = 13;

export const BAND_RADIUS = 16;
export const BAND_TRACK = 7;

export const RAIL_WELL = 96;
export const RAIL_WELL_AX = 118;

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

export const CLOSET_COPY = {
  title: 'Closet',
  addPiece: 'Add piece',

  /** The activation floor, verbatim and shared with Today. */
  emptyTitle: 'Start with ten pieces',
  emptyBody: 'Photograph what you actually reach for. Ten is enough for Cinch to make outfits from.',
  emptyAction: 'Add your first piece',

  errorTitle: 'Couldn’t load your closet',
  errorBody: 'Nothing has changed and nothing is lost — this device just couldn’t reach it.',
  errorRetry: 'Try again',
  errorLeave: 'Go to Today',

  offlineTitle: 'Offline',
  offlineBody: 'Showing the closet as it was last loaded.',
  offlineRetry: 'Retry',

  searchPlaceholder: 'Search your closet',
  searchFooter: 'Search names, colors and materials.',

  mostWorn: 'Most worn',
  favoriteOutfits: 'Favorite outfits',

  recategorise: 'Recategorise',
  store: 'Store',
  restore: 'Restore',
  delete: 'Delete',
  done: 'Done',
  cancel: 'Cancel',

  moveNote: 'Category is private and only changes how you browse.',

  storeBody:
    'They leave the active grid and keep counting toward your total. You can restore them any time.',
  storeAfter: 'Active after storing',

  /** The destructive sentence, and the one reassurance that matters. */
  deleteBody:
    'This removes them and their photographs from Cinch, along with their wear history. Pictures in your own camera roll stay where they are.',
  deleteInstead: 'Store instead',

  deleteFailedTitle: 'That didn’t delete',
  bulkRetry: 'Try again',
  bulkDismiss: 'Keep them for now',
} as const;

/** "Searching dresses for “linen” — name, colour and material." */
export function searchScopeLine(category: string, query: string): string {
  const where = category === 'All' ? 'your closet' : category.toLowerCase();
  return `Searching ${where} for “${query}” — name, color and material.`;
}
