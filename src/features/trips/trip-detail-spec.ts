import { plateDayLabel, weatherMark } from '@/features/plan/new-trip-spec';
import { daysBetween, type IsoDate } from '@/features/plan/trip';
import type { Json } from '@/types/database';

/**
 * Trip Detail — what the page decides before it draws. Redesign 06.
 *
 * A `.ts`, not a `.tsx`, for the reason `trips-list-spec.ts`, `new-trip-spec.ts`
 * and `plan-week-spec.ts` all give: the node test bundler cannot parse React
 * Native's Flow source, so anything worth PINNING must not reach a component
 * file. Everything here is a pure function of its arguments — no hooks, no
 * storage, no `new Date()` read from the ambient clock — which is what lets
 * `tests/trip-detail-layout.test.ts` exercise the toggle, the progress
 * arithmetic, the completion test and the storage key directly rather than
 * inferring them from a render.
 *
 * ── THE ONE LAW THIS PAGE COULD BREAK ────────────────────────────────────────
 *
 * The pieces on this plate are the reader's OWN closet items, by the ids the
 * brief stored in `trips.memo` the day it was built. Nothing here invents a
 * piece, copies one, or falls back to a name when an id does not resolve —
 * `plateGroups` returns ids and only ids, and the drawing layer looks each one
 * up in the closet the same way every other garment well in the app does. A
 * piece that is no longer in the closet loses its photograph and keeps its
 * place; it does not become a stand-in for something the user never owned.
 *
 * ── WHY THE CHECK STATE IS PER PIECE, NOT PER TILE ───────────────────────────
 *
 * A garment worn on Thursday and again on Saturday appears in two day grids,
 * and the frames draw a mark on each tile. It is still ONE act — you put the
 * shirt in the bag once — so the check is keyed on the item id and both tiles
 * carry the same mark. The alternative, a check per (day, piece) pair, would
 * ask somebody to tick the same shirt twice to reach "9 of 9" and would count a
 * repeat as two pieces in the progress line. `plateItemIds` is therefore
 * DISTINCT, and it is the denominator.
 *
 * ── WHERE THE TWO KINDS OF STATE LIVE, AND WHY THEY DIFFER ───────────────────
 *
 * The TICKS are device-local (`tripChecksKey` below, stored by
 * `use-trip-checks.ts`). The directive asks for exactly that, and the accepted
 * error frame says it out loud — "what you already ticked is safe on this
 * device" — because a tick is about this suitcase in this room on this evening.
 *
 * The NOTE is a column on `trips`. That is a change of course mid-build and it
 * is recorded here rather than only in the report: this page was built against
 * a `trips` table with no note column, and `trips.note` was added to production
 * by a colliding session while the work was in flight. The column was applied
 * and verified, and rolling back a live column is the only destructive option
 * available, so it was adopted rather than reverted. A sentence somebody typed
 * is content, and content is worth a column in a way a tick is not — so the
 * split the page ships with is defensible on its own terms, whatever the route
 * to it was. `NOTE_MAX_LENGTH` here matches the column's own check constraint.
 */

// ---------------------------------------------------------------------------
// Copy — the frames' own words
// ---------------------------------------------------------------------------

export const TRIP_DETAIL_COPY = {
  back: 'Back',
  /** The overflow control the frames draw as three dots. */
  more: 'More',

  /** `6 of 9 packed`. Never "almost done", never a percentage. */
  packed: (packed: number, total: number) => `${packed} of ${total} packed`,
  fullyPacked: 'Fully packed',

  /** The note plate at rest, and the field it becomes. */
  notePlaceholder: 'Add a note for this trip',
  noteLabel: 'Trip note',
  noteDone: 'Done',

  /** The two quiet actions. */
  replan: 'Re-plan',
  delete: 'Delete trip',

  /** The completion frame replaces both of them with one way onward. */
  seeTheWeek: 'See the week',

  /** The trip that exists but was never packed. */
  emptyTitle: (destination: string) => `Nothing packed for ${destination}`,
  emptyBuild: 'Build the packing plan',

  /** The plate that would not load. */
  offlineKicker: 'Offline',
  errorTitle: 'The packing plate didn’t load',
  errorBody: 'What you already ticked is safe on this device.',
  ticked: (n: number) => `${n} ${n === 1 ? 'piece' : 'pieces'} ticked, saved locally`,
  tryAgain: 'Try again',
  allTrips: 'All trips',

  /** The delete sheet. Its second line is the law, stated to the reader. */
  deleteTitle: (destination: string) => `Delete the ${destination} trip?`,
  deleteBody: 'The packing plan goes. Your garments stay in the closet.',
  deleteConfirm: 'Delete trip',
  deleteCancel: 'Keep it',

  /** A tile's assistive label — the piece, and what a press would do. */
  pack: (piece: string) => `Pack ${piece}`,
  unpack: (piece: string) => `Unpack ${piece}`,
} as const;

// ---------------------------------------------------------------------------
// Local persistence — the KEY only. The store lives in `use-trip-checks.ts`.
// ---------------------------------------------------------------------------

/**
 * Per signed-in user AND per trip.
 *
 * `recent-people-spec.ts` establishes the user half and the reason: two people
 * sign in to one phone, and a list keyed on the device alone shows the first
 * one's state to the second. The trip half is this page's own addition and is
 * just as load-bearing — a key that carried only the user would make every trip
 * on the shelf share one set of ticks, so packing for Lisbon would arrive
 * half-done because Mexico City was.
 *
 * `tests/trip-detail-layout.test.ts` asserts both halves appear, because a key
 * that quietly drops one is a bug with no visible symptom until somebody has
 * two trips or one phone has two people.
 */
export function tripChecksKey(userId: string, tripId: string): string {
  return `cinch.trip-detail.checks.v1.${userId}.${tripId}`;
}

// ---------------------------------------------------------------------------
// The check set
// ---------------------------------------------------------------------------

/**
 * Tick or untick one piece.
 *
 * Pure, sorted, and duplicate-free, which is what makes it IDEMPOTENT in the
 * sense that matters: `toggleCheck(toggleCheck(ids, x), x)` is `ids`, and
 * ticking an already-ticked piece cannot add a second entry that would push the
 * progress line past its own total. Sorted so two orderings of the same taps
 * serialise to the same string.
 */
export function toggleCheck(checked: readonly string[], itemId: string): string[] {
  const set = new Set(checked);
  if (set.has(itemId)) set.delete(itemId);
  else set.add(itemId);
  return [...set].sort();
}

export function isChecked(checked: readonly string[], itemId: string): boolean {
  return checked.includes(itemId);
}

/**
 * What comes back out of storage, filtered to what is still on the plate.
 *
 * Re-planning a trip rewrites `memo`, and an id ticked before the re-plan may
 * name a piece the new bag does not carry. Dropping it at the read is what
 * keeps the stored set from growing a tail of ids nothing will ever clear.
 */
export function readChecked(parsed: unknown, valid: readonly string[]): string[] {
  if (!Array.isArray(parsed)) return [];
  const allowed = new Set(valid);
  return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id)))].sort();
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type Progress = {
  packed: number;
  total: number;
  /** 0–1, and 0 rather than NaN when there is nothing to pack. */
  ratio: number;
};

/**
 * How much of THIS plate is packed.
 *
 * Intersected with the plate rather than counting the stored set, and that is
 * the whole reason this is a function instead of `checked.length`: a piece that
 * was ticked before a re-plan and is not in the new bag would otherwise be
 * counted — printing "10 of 9 packed", which is both impossible and the kind of
 * number that makes a reader stop trusting the rest of the screen.
 */
export function packingProgress(pieceIds: readonly string[], checked: readonly string[]): Progress {
  const set = new Set(checked);
  const total = pieceIds.length;
  const packed = pieceIds.reduce((n, id) => (set.has(id) ? n + 1 : n), 0);
  return { packed, total, ratio: total === 0 ? 0 : packed / total };
}

/**
 * The success moment — every piece on the plate, and at least one piece.
 *
 * The `total > 0` guard is not defensive noise: an unpacked trip has an empty
 * plate, and "0 of 0" satisfies `packed === total`. Without the guard the empty
 * frame would announce itself as fully packed and fire the success haptic on
 * arrival, which is the app congratulating somebody for nothing.
 */
export function isFullyPacked(progress: Progress): boolean {
  return progress.total > 0 && progress.packed === progress.total;
}

/**
 * Which haptic a tick has earned — selection, or the success notification.
 *
 * Decided here rather than at the call site so the rule is testable: the
 * success buzz fires on the tick that COMPLETES the plate and on no other, and
 * in particular not on every tick once the plate is already complete (there are
 * none — the last tile is checked) and not when a piece is being UNticked back
 * down from complete.
 */
export function packEvent(before: number, after: number, total: number): 'complete' | 'selection' {
  return total > 0 && after === total && before < total ? 'complete' : 'selection';
}

// ---------------------------------------------------------------------------
// The plate, read back out of `trips.memo`
// ---------------------------------------------------------------------------

export type PlateGroup = {
  /** Stable across renders — the memo's own day index. */
  key: string;
  dayIndex: number;
  date: IsoDate | null;
  travelDay: boolean;
  tempC: number | null;
  /** Closet item ids, in the order the brief packed them. Deduplicated. */
  itemIds: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * The saved memo's days, back into groups the plate can draw.
 *
 * Written defensively, for the reason `bagItemIds` gives one file over: `memo`
 * is `jsonb` and is whatever was written the day it was written. A shape
 * assertion here would be a crash on somebody's own trip rather than a day that
 * draws with fewer wells, so every field is checked and every unusable one is
 * dropped.
 *
 * A day's pieces are deduplicated ACROSS its day parts: a day dressed for
 * morning and evening wears the same trousers in both more often than not, and
 * three wells showing one garment twice is a grid that misreports the day —
 * the same rule, and the same sentence, as the planned plate in
 * `packing-trip.tsx`.
 */
export function plateGroups(memo: Json | null): PlateGroup[] {
  if (!isRecord(memo)) return [];
  const days = memo.days;
  if (!Array.isArray(days)) return [];

  const out: PlateGroup[] = [];

  for (const raw of days) {
    if (!isRecord(raw)) continue;

    const dayIndex = typeof raw.dayIndex === 'number' ? raw.dayIndex : out.length;
    const seen = new Set<string>();
    const itemIds: string[] = [];

    const rows = Array.isArray(raw.rows) ? raw.rows : [];
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const ids = row.itemIds;
      if (!Array.isArray(ids)) continue;
      for (const id of ids) {
        if (typeof id !== 'string' || !id || seen.has(id)) continue;
        seen.add(id);
        itemIds.push(id);
      }
    }

    // A day the closet could not dress produced no rows. It is still a day of
    // the trip, and dropping it would renumber every day after it — so it
    // survives with an empty grid, which is what the frames' empty wells are.
    out.push({
      key: String(dayIndex),
      dayIndex,
      date: typeof raw.date === 'string' ? (raw.date as IsoDate) : null,
      travelDay: raw.travelDay === true,
      tempC: typeof raw.tempC === 'number' ? raw.tempC : null,
      itemIds,
    });
  }

  return out.sort((a, b) => a.dayIndex - b.dayIndex);
}

/**
 * Every piece on the plate, once each, in plate order — the progress denominator.
 *
 * It deliberately does NOT fall back to `trips.item_ids`: that column is the
 * bag as a flat list with no day structure, and a plate built from it would
 * draw pieces under day headings they were never packed for. A row with
 * `item_ids` but no memo days is the EMPTY frame, which is honest, rather than
 * a plate assembled out of guesses.
 */
export function plateItemIds(groups: readonly PlateGroup[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const id of group.itemIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** How many days the trip spans, for `plateDayLabel`'s arrival/home ends. */
export function tripDayCount(startsOn: IsoDate | null, endsOn: IsoDate | null): number {
  if (!startsOn || !endsOn) return 0;
  return Math.max(0, daysBetween(startsOn, endsOn));
}

/**
 * `Thu 10 · arrival` — reusing the plate's own label rather than a second one.
 *
 * `plateDayLabel` already carries the redesign-05 deviation this page inherits:
 * the artifact's middle bands read "Sat 12 · the birthday", which is an EVENT
 * title, and this app has no binding from a trip day to a calendar event. The
 * date alone is what the row can back. Restated here so the deviation is
 * visible on the page that draws it, not only on the page that wrote it.
 */
export function groupLabel(group: PlateGroup, days: number): string {
  if (!group.date) return '';
  return plateDayLabel(group.date, group.dayIndex, days);
}

/**
 * The honest line under the day band, where the artifact draws an event note.
 *
 * "travel day", a temperature, both, or nothing. Never "Late flight, warm
 * evening" — the memo records `travelDay` and `tempC` and nothing else about
 * what a day was for, so those two are the whole vocabulary.
 */
export function groupCaption(group: PlateGroup, tempLabel: string | null): string | null {
  const parts = [group.travelDay ? 'travel day' : null, tempLabel].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The hero's weather mark, from what the PLAN recorded — never a fresh guess.
 *
 * `SavedMemo` freezes the trip as it was built, and its per-day `tempC` values
 * are the only temperatures the row carries. Taking the range across them means
 * the chip states what this trip was packed against, which is the fact that
 * matters when you reopen the plan; refetching a forecast here would show a
 * number the bag was never chosen for, and for a past trip there is no forecast
 * to fetch at all. Null when no day recorded a temperature, and the chip is
 * then absent rather than showing an em dash.
 */
export function plateBand(groups: readonly PlateGroup[]): { lowC: number; highC: number } | null {
  const temps = groups.map((g) => g.tempC).filter((t): t is number => t !== null);
  if (!temps.length) return null;
  return { lowC: Math.min(...temps), highC: Math.max(...temps) };
}

/** `24° / 15°`, from the recorded band. Re-exported so callers need one import. */
export { weatherMark };

/** "Linen shirt" — the reader's own garment, capitalised. Null when it is gone. */
export function pieceLabel(
  item: { subcategory?: string | null; category?: string | null } | null | undefined,
): string | null {
  const raw = item?.subcategory ?? item?.category ?? null;
  if (!raw) return null;
  const s = raw.trim();
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

// ---------------------------------------------------------------------------
// The note — a column on `trips`, capped where the column caps it
// ---------------------------------------------------------------------------

/**
 * The column's own cap, restated in the client.
 *
 * `trips.note` carries `check (char_length(note) <= 2000)`. Enforcing it here
 * too is not belt-and-braces for its own sake: without it a long paste comes
 * back as a Postgres constraint violation — an error toast for something the
 * field should simply have stopped accepting — and the write that failed is the
 * one carrying the user's words.
 */
export const NOTE_MAX_LENGTH = 2000;

/**
 * What actually gets written.
 *
 * Trailing whitespace trimmed and the cap applied, so "  " and "" are the same
 * note and the column has one representation of "nothing typed" — which is the
 * property the migration's `not null default ''` is also reaching for. Leading
 * whitespace is kept: it is inside a sentence somebody wrote, and tidying the
 * front of their prose is not this function's business.
 */
export function normaliseNote(raw: string): string {
  return raw.replace(/\s+$/, '').slice(0, NOTE_MAX_LENGTH);
}

/**
 * Is this worth a round trip?
 *
 * The note saves on blur, and blurring a field nobody typed in — tapping in and
 * straight back out — must not spend a write. `null` from the row is the same
 * as `''` for this comparison, because the column cannot hold null but a trip
 * read before the column existed can arrive without it.
 */
export function noteChanged(next: string, saved: string | null | undefined): boolean {
  return normaliseNote(next) !== normaliseNote(saved ?? '');
}

// ---------------------------------------------------------------------------
// The empty frame's line
// ---------------------------------------------------------------------------

/**
 * "Six nights. Build the plan and it lands here."
 *
 * The artifact reads "Six nights, cool evenings. Build the plan and it lands
 * here." A trip that was never packed has no memo, therefore no recorded
 * temperature, therefore no basis for "cool evenings" — so the weather clause
 * is dropped rather than invented, and the nights clause goes too when the row
 * has no usable dates. What is left is a sentence every word of which is a
 * field. Listed as a deviation.
 */
const NIGHT_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
];

export function emptyBody(nights: number | null): string {
  const tail = 'Build the plan and it lands here.';
  if (nights === null || nights <= 0) return tail;
  const word = NIGHT_WORDS[nights] ?? String(nights);
  return `${word} ${nights === 1 ? 'night' : 'nights'}. ${tail}`;
}

// ---------------------------------------------------------------------------
// Geometry — the artifact's numbers
// ---------------------------------------------------------------------------

/** The back / overflow targets in the page's own chrome. */
export const CHROME_TARGET = 44;
export const CHROME_RADIUS = 14;

/** The hero band. */
export const HERO_PAD_X = 22;
export const HERO_GAP = 10;
export const MARK_RADIUS = 11;
export const MARK_DOT = 14;
export const BADGE_RADIUS = 9;
export const BADGE_DOT = 8;

/** The progress bar. */
export const BAR_HEIGHT = 8;
export const BAR_RADIUS = 4;
export const BAR_GAP = 12;

/** The cutout grid — three across, two above the threshold. */
export const GRID_COLUMNS = 3;
export const GRID_COLUMNS_AX = 2;
export const TILE_ROW = 104;
/** The completion frame drops the day captions, so its tiles gain the room back. */
export const TILE_ROW_COMPLETE = 98;
export const TILE_ROW_AX = 112;
export const TILE_RADIUS = 12;
export const TILE_RADIUS_AX = 14;
export const TILE_GAP = 6;
export const TILE_GAP_AX = 8;
export const TILE_PAD = 8;
export const GROUP_GAP = 16;

/** The check mark on a tile. */
export const MARK_SIZE = 26;
export const MARK_SIZE_AX = 32;
export const MARK_BORDER = 2;
export const MARK_BORDER_AX = 2.5;
export const MARK_INSET = 7;
export const MARK_INSET_AX = 8;

/** The note plate, at rest and focused. */
export const NOTE_RADIUS = 15;
export const NOTE_RADIUS_FOCUSED = 16;
export const NOTE_MIN_HEIGHT = 44;
export const NOTE_MIN_HEIGHT_FOCUSED = 56;
export const NOTE_DOT = 7;
export const NOTE_BORDER = 1.5;

/** The pinned foot. */
export const CTA_MIN_HEIGHT = 56;
export const CTA_SECONDARY_MIN_HEIGHT = 52;
export const CTA_MIN_HEIGHT_AX = 60;
export const CTA_RADIUS = 16;

/** The empty frame's drawn garments. */
export const GHOST_ROW = 110;
export const GHOST_BORDER = 1.5;

/** The error frame's local-state receipt. */
export const RECEIPT_RADIUS = 16;
export const RECEIPT_MARK = 22;

/** The delete sheet. */
export const SHEET_RADIUS = 30;
export const SHEET_GRABBER_WIDTH = 44;
export const SHEET_GRABBER_HEIGHT = 5;

/**
 * Where the page recomposes instead of shrinking.
 *
 * The same threshold Plan's week, the event poster, the trips shelf and the New
 * Trip flow use — one number for the whole redesign, so two rebuilt pages
 * cannot disagree about what "large" is.
 */
export { AX_STACK_SCALE as TRIP_DETAIL_STACK_SCALE } from '@/features/closet/dynamic-type';
