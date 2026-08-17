/**
 * EVERY STATE THE SAVED-LOOKS FLOW CAN BE IN, AS PURE FUNCTIONS.
 *
 * Three machines, because §10 names three and they do not compose: the list, the
 * save action, and the detail. Between them, eight of the twelve states are
 * waiting, emptiness, refusal or revocation — which is where a unit like this is
 * actually judged. A screen that resolves its own state inline resolves it
 * slightly differently from the analytics call beside it, and the state that
 * gets under-tested is always one of the eight.
 *
 * No React, no react-native, no supabase — the whole point. The node runner
 * exercises the real functions rather than a description of them, the same split
 * `daily-social/states.ts` and `circles/states.ts` made.
 *
 * ── THE TWO THAT LOOK IDENTICAL FROM THE DATA ──────────────────────────────
 *
 * · **`empty` versus `offline`.** Both arrive as a page with no cards on it. One
 *   of them says "Nothing saved yet", and drawn over a failed read it tells
 *   somebody with fourteen saved looks that they have none. So `offline`
 *   outranks `empty` unconditionally, even when the cache is genuinely empty:
 *   a read that failed knows nothing about what is there.
 * · **`unavailable` versus a failed detail read.** One means somebody else's
 *   sharing changed; the other means we could not read the reader's own row.
 *   They are two different apologies, and only the first is true.
 *
 * ── AND THE FILTER IS NOT A FETCH ──────────────────────────────────────────
 *
 * §10: "Filter is a client-side facet over the loaded set; changing it never
 * refetches." `filterSaves` is that sentence, and it lives here rather than in
 * the screen so it cannot quietly become a query key. A refetch on every chip
 * tap would also re-resolve `availability` for the whole list, which is
 * correct-but-wasteful in a way nobody would notice until a revoked look started
 * flickering between states as somebody browsed their own shelves.
 */

import type { SavedAvailability, SavedCollection, SavedLook } from './types';

// ---------------------------------------------------------------------------
// The list — OS-01, OS-03, OS-09
// ---------------------------------------------------------------------------

/**
 * The five, tagged. A discriminated union rather than a bare string union
 * because three of them carry numbers the drawing and the analytics both need,
 * and a caller that re-derived those beside the state is a caller that can
 * derive them from a different input than the state was resolved from.
 */
export type SavedListState =
  /** Nothing has answered yet — OS-09a's skeleton. Never an empty state. */
  | { kind: 'loading' }
  /** The read failed and there is nothing cached — OS-09c. Offers the read again. */
  | { kind: 'error' }
  /**
   * The device is offline but the cache has looks in it — OS-09b. A BANNER over
   * real content, not a screen instead of it: those looks are the reader's own
   * rows and they are true, just possibly not current.
   */
  | { kind: 'offline'; savedCount: number; unavailableCount: number }
  /** The read succeeded and there is genuinely nothing — OS-01. */
  | { kind: 'empty' }
  /** Cards to draw — OS-03. `unavailableCount` drives OS-06's count banner. */
  | { kind: 'populated'; savedCount: number; unavailableCount: number };

export type SavedListStateKind = SavedListState['kind'];

/** Every kind, in the order the atlas walks them. */
export const SAVED_LIST_STATES: readonly SavedListStateKind[] = [
  'loading',
  'error',
  'offline',
  'empty',
  'populated',
];

export interface SavedListInput {
  /** The read has not answered yet. Defaults false. */
  loading?: boolean;
  /** The read failed. */
  failed: boolean;
  /** The device believes it has no connection. */
  offline?: boolean;
  /** What is in hand — from the server, or from the persisted cache. */
  saves: readonly SavedLook[];
}

/**
 * Which of the five the reader is in.
 *
 * Order matters, and every step of it is a refusal:
 *
 *   1. **Loading first.** A screen that has not heard back knows nothing, and
 *      the one thing it must not do is claim there is nothing saved. OS-01
 *      carries a picture of the control and an instruction; drawn over a pending
 *      read it teaches somebody who has fourteen looks how to make their first.
 *   2. **Offline-with-content second, ahead of failure.** This is the case
 *      OS-09b exists for and it is the good one: real rows, honestly labelled as
 *      possibly stale. Resolving it as `error` would throw away content the
 *      reader can use.
 *   3. **Failure third**, and it swallows offline-with-nothing too. Both mean
 *      "we could not tell you", and OS-09c's "Your saves are safe" is the
 *      sentence both deserve. Splitting them would give the network case an
 *      empty screen with a different apology and no more information.
 *   4. **Then, and only then, emptiness.** Reached exactly when a read
 *      succeeded and returned no rows.
 */
export function resolveSavedListState(input: SavedListInput): SavedListState {
  if (input.loading) return { kind: 'loading' };

  const savedCount = input.saves.length;
  const unavailableCount = input.saves.filter((s) => s.availability === 'unavailable').length;

  if (input.offline && savedCount > 0) {
    return { kind: 'offline', savedCount, unavailableCount };
  }
  if (input.failed || input.offline) return { kind: 'error' };
  if (savedCount === 0) return { kind: 'empty' };
  return { kind: 'populated', savedCount, unavailableCount };
}

/**
 * Is this a state whose emptiness is real, rather than a wait or a failure?
 *
 * `empty` alone. `loading` knows nothing yet and neither `offline` nor `error`
 * knows more than that it could not read — none of the three is entitled to an
 * empty state's claim.
 */
export function isSavedListEmpty(state: SavedListState): boolean {
  return state.kind === 'empty';
}

/**
 * May the collection filter row be on screen?
 *
 * Only over cards. A filter above nothing is a control with no effect, and above
 * a skeleton it is a control the reader can operate before the thing it filters
 * exists. OS-09a draws skeleton chips instead, which are a picture of the row
 * rather than the row.
 */
export function showsFilterBar(state: SavedListState, collections: readonly SavedCollection[]) {
  return (state.kind === 'populated' || state.kind === 'offline') && collections.length > 0;
}

/**
 * The failure carries no state of its own.
 *
 * Clearing `failed` returns the identical state for identical content, so
 * nothing about having been offline changes what is drawn afterwards — including
 * the chosen filter, which lives in the screen and is never keyed on this.
 */
export function savedListStateAfterRecovery(input: SavedListInput): SavedListState {
  return resolveSavedListState({ ...input, failed: false, offline: false, loading: false });
}

// ---------------------------------------------------------------------------
// The filter — a facet, never a fetch
// ---------------------------------------------------------------------------

/**
 * The chosen collection, or `null` for All. A distinct type so a screen cannot
 * pass a save id where a collection id belongs and have it merely return
 * nothing.
 */
export type SavedFilter = string | null;

/**
 * The loaded set, narrowed. Pure, total, and never a query key.
 *
 * Order is preserved from the input rather than re-sorted: the list arrives
 * newest-first from the server, and a facet that re-ordered would make the same
 * look move when a chip was tapped.
 */
export function filterSaves(saves: readonly SavedLook[], filter: SavedFilter): SavedLook[] {
  if (filter === null) return [...saves];
  return saves.filter((save) => save.collectionId === filter);
}

/**
 * How many looks sit in each collection, counted from the set already in hand.
 *
 * Client-side deliberately — see `SavedCollection.savedCount`. The alternative is
 * a server count that can disagree with the grid the reader is looking at, which
 * is the worse failure of the two: a wrong number beside a right list is read as
 * the list being wrong.
 *
 * Counts EVERY save, including unavailable ones. They are still in the
 * collection, OS-06 still draws their tiles, and a chip that excluded them would
 * promise a grid shorter than the one it opens.
 */
export function collectionCounts(saves: readonly SavedLook[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const save of saves) {
    if (!save.collectionId) continue;
    counts.set(save.collectionId, (counts.get(save.collectionId) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// The save action — OS-02
// ---------------------------------------------------------------------------

/**
 * §10's save machine, whole:
 *
 *   `idle --tap--> validating --ok--> saved(toast) [+ optional sheet]`
 *   `validating --duplicate--> already_saved(toast→View)`
 *   `validating --no-access--> blocked(inline error, no write)`
 *   `saved --undo(≤5s)--> idle`
 *
 * `blocked` IS A STATE AND NOT AN ERROR TOAST. The insert policy refuses a
 * source the caller cannot see, and the refusal happens with no row written — so
 * the honest thing on screen is an inline message beside the control that was
 * tapped, not a banner that looks like something went wrong with the app. "No
 * access" here almost always means the look expired or was un-shared between the
 * screen being drawn and the tap landing, which is somebody else's ordinary
 * decision rather than a fault.
 */
export type SaveActionState =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'saved'; savedId: string }
  | { kind: 'already_saved'; savedId: string }
  | { kind: 'blocked' };

export type SaveActionStateKind = SaveActionState['kind'];

export const SAVE_ACTION_STATES: readonly SaveActionStateKind[] = [
  'idle',
  'validating',
  'saved',
  'already_saved',
  'blocked',
];

/**
 * Does this state put a toast on screen, and of which of the two tones?
 *
 * SUCCESS AND INFO ARE NOT THE SAME TOAST, and the distinction is carried here
 * so that the toast, the haptic and the copy cannot disagree. §8 gives the
 * duplicate a light selection tick and explicitly "no success chime": a second
 * tap that celebrates like a first tap teaches the reader they now have two.
 */
export function saveToastTone(state: SaveActionState): 'success' | 'info' | null {
  if (state.kind === 'saved') return 'success';
  if (state.kind === 'already_saved') return 'info';
  return null;
}

/**
 * May Undo be offered?
 *
 * Only for a save that was just made. A duplicate has nothing to undo — the row
 * predates the tap — and undoing it would delete something the reader saved
 * days ago on the strength of a tap they made by accident today. That toast
 * offers "View" instead, which is the useful action and the safe one.
 */
export function offersUndo(state: SaveActionState): boolean {
  return state.kind === 'saved';
}

// ---------------------------------------------------------------------------
// The detail — OS-04, OS-06
// ---------------------------------------------------------------------------

export type SavedDetailState =
  | { kind: 'loading' }
  | { kind: 'error' }
  /** The row is gone — removed here, or on another device. Pop, do not apologise. */
  | { kind: 'missing' }
  | { kind: 'available'; save: SavedLook }
  | { kind: 'unavailable'; save: SavedLook };

/**
 * Which detail the reader is looking at.
 *
 * `missing` is separated from `error` because they are different apologies and
 * only one of them is true. A `null` row means RLS matched nothing — the save
 * was removed, here or on another device — and the right answer is to leave,
 * silently. An `error` means the read failed and the row's fate is unknown, so
 * the screen must not claim it is gone.
 *
 * Note what does NOT appear: a branch on whether the source was expired,
 * un-shared, deleted or blocked. `availability` is a boolean by construction and
 * this is where that stays true, because a client that could tell those apart
 * would eventually print the difference.
 */
export function resolveSavedDetailState(input: {
  loading?: boolean;
  failed: boolean;
  save: SavedLook | null;
}): SavedDetailState {
  if (input.loading) return { kind: 'loading' };
  if (input.failed) return { kind: 'error' };
  if (!input.save) return { kind: 'missing' };
  return input.save.availability === 'available'
    ? { kind: 'available', save: input.save }
    : { kind: 'unavailable', save: input.save };
}

/**
 * May this save be turned into a plan?
 *
 * Available only. OS-06 replaces the whole action row with "Keep note only" and
 * "Remove save", and it has to: planning reads the SOURCE to know what the look
 * was made of, and the source is precisely what is no longer readable. Offering
 * the button would be drawing a door into a wall.
 */
export function canPlan(availability: SavedAvailability): boolean {
  return availability === 'available';
}
