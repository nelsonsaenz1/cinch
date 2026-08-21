import type { WearFailureKind } from '@/features/styling/wear-failure';

/**
 * The wear confirmation — what the commit step decides before it draws.
 * Redesign 13.
 *
 * A `.ts` with no React and no `.tsx` import, on the wave's rule: the node
 * bundler cannot parse React Native's Flow source, so anything a test needs to
 * read has to live where no component can reach it.
 *
 * ── WHAT THIS STEP IS FOR ───────────────────────────────────────────────────
 *
 * A wear is a FACT, and this is the last moment before it becomes one. Opening
 * writes nothing. Cancelling writes nothing. Confirming writes exactly one
 * atomic transaction, and confirming with nothing chosen is a legal wear —
 * `rating: null`, `favorite: false` — because inventing a taste signal from
 * somebody's silence is the one thing a learning system may never do.
 *
 * ── WHAT THIS MODULE DOES NOT OWN ───────────────────────────────────────────
 *
 * The write. `useWearOutfit` already carries the operation id, the atomicity
 * and the failure taxonomy; `wear_outfit_tx` already enforces ownership, the
 * 1–5 range and the single increment. Nothing here computes, retries or
 * classifies anything — it decides WORDS, GEOMETRY and the learning mapping,
 * and every one of those is a pure function a test can execute.
 */

// ---------------------------------------------------------------------------
// The local state machine
// ---------------------------------------------------------------------------

/**
 * Four states, and the transitions between them.
 *
 *   idle → confirming → settled
 *              ↓
 *            failed → confirming (retry, SAME operation id)
 *
 * `failed` returns to an EDITABLE state with the selections intact, which is
 * what makes "your stars are still here" true rather than reassuring. `settled`
 * is terminal: the wear is history and the only action left is to leave.
 */
export type WearPhase = 'idle' | 'confirming' | 'settled' | 'failed';

/**
 * Whether the sheet may be dismissed right now.
 *
 * FALSE ONLY WHILE CONFIRMING, and that is the whole point: a dismissal
 * accepted mid-flight leaves a transaction in the air with nobody watching for
 * its answer, which is how a wear comes to exist that the app believes was
 * cancelled. Every other state — including `failed` — dismisses freely, because
 * nothing was written in any of them.
 */
export function mayDismiss(phase: WearPhase): boolean {
  return phase !== 'confirming';
}

/**
 * Whether the rating and the favourite may still be changed.
 *
 * Same rule, for a different reason: a star tapped while the write is in flight
 * would be a selection the transaction never carried, sitting on screen looking
 * as though it had been saved.
 */
export function mayEdit(phase: WearPhase): boolean {
  return phase === 'idle' || phase === 'failed';
}

/**
 * Whether a confirm tap should be acted on.
 *
 * The in-flight guard, stated once and asserted by a test. A second tap during
 * `confirming` is swallowed here rather than deduplicated later — the operation
 * id would make a duplicate harmless, but a request that never leaves is
 * cheaper than one that has to be recognised on arrival.
 */
export function mayConfirm(phase: WearPhase): boolean {
  return phase === 'idle' || phase === 'failed';
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

export const STARS = [1, 2, 3, 4, 5] as const;
export type Star = (typeof STARS)[number];

/**
 * Tapping a star, including tapping the chosen one again.
 *
 * Re-tapping CLEARS, and it clears to `null` rather than to `0`. That
 * distinction is the whole of this function: zero is a rating somebody gave,
 * and null is a rating nobody gave. The RPC's range is 1–5 precisely so that
 * zero can never be mistaken for the low end of the scale.
 */
export function toggleStar(current: number | null, tapped: Star): number | null {
  return current === tapped ? null : tapped;
}

/** Whether a star is drawn filled — every star up to and including the choice. */
export function starFilled(current: number | null, star: Star): boolean {
  return current !== null && star <= current;
}

/**
 * The hint under "How was it?".
 *
 * Two states, not three. The accepted frames show "Optional" on the untouched
 * sheet, "Cleared" after a rating is taken back, and "Skip if you like" on the
 * unrated-is-legal frame — but that third frame is in the SAME state as the
 * first, so a third string would be a difference the reader could see and the
 * app could not explain. "Optional" carries both.
 */
export function ratingHint(rating: number | null, cleared: boolean): string {
  return rating === null && cleared ? WEAR_COPY.ratingCleared : WEAR_COPY.ratingOptional;
}

// ---------------------------------------------------------------------------
// What taste learns, and what it does not
// ---------------------------------------------------------------------------

/**
 * The one mapping from an explicit choice to a learning signal.
 *
 *   favourite   → positive, and it OVERRIDES a conflicting rating
 *   4 or 5      → positive
 *   1 or 2      → negative
 *   3           → neutral, recorded and teaching nothing
 *   unrated     → NO LEARNING AT ALL
 *
 * The favourite override is the interesting one and it is deliberate: somebody
 * who gives two stars and then keeps the outfit anyway has told you something
 * stronger than the stars did. The unrated case is the important one: it
 * returns null, and null means the learner is never called — a wear with no
 * opinion attached must not drift the model in either direction.
 */
export function tasteSignal(rating: number | null, favorite: boolean): boolean | null {
  if (favorite) return true;
  if (rating === null) return null;
  if (rating >= 4) return true;
  if (rating <= 2) return false;
  return null;
}

/**
 * Whether the sheet should explain that the favourite outranked the stars.
 *
 * Only when the two genuinely disagree. Saying it over a five-star favourite
 * would be the app narrating an argument nobody was having.
 */
export function favoriteOverridesRating(rating: number | null, favorite: boolean): boolean {
  return favorite && rating !== null && rating <= 2;
}

// ---------------------------------------------------------------------------
// Failure, told apart
// ---------------------------------------------------------------------------

export type WearErrorView = {
  title: string;
  body: string;
  /** The primary action's label. */
  action: string;
  /**
   * False when the failure cannot be fixed from this sheet — a session that
   * ended needs a sign-in, and a "Try again" that will fail identically is the
   * dead control every refusal in this app forbids.
   */
  retryable: boolean;
};

/**
 * The three failures a wearer can actually be in, and their words.
 *
 * OFFLINE and NETWORK are the same underlying kind and are told apart anyway,
 * because they are different situations for the reader: one is a connection
 * that was never there when the tap landed, and one is a connection that
 * dropped mid-write. Both say plainly that NOTHING WAS WRITTEN and that nothing
 * is being held — this app has no wear queue, and promising one would be a lie
 * the next screen exposes.
 *
 * `rejected` and `unexpected` are defects rather than user errors: the RPC
 * refuses unowned items, empty arrays and out-of-range ratings, and none of
 * those can be produced by using the sheet correctly. They get the honest
 * generic and stay retryable, because a transient server fault looks the same
 * from here.
 */
export function wearErrorView(kind: WearFailureKind, offline: boolean): WearErrorView {
  switch (kind) {
    case 'signed_out':
      return {
        title: 'Sign in to log this',
        body: 'Your session ended. Nothing was written.',
        action: 'Sign in',
        retryable: false,
      };
    case 'network':
    case 'session_unavailable':
      return offline
        ? {
            title: 'You are offline',
            body: 'Logging needs a connection. Nothing is held in a queue — try again when you are back.',
            action: 'Try again',
            retryable: true,
          }
        : {
            title: 'Could not log it',
            body: 'The connection dropped before it saved. Nothing was written and your stars are still here.',
            action: 'Try again',
            retryable: true,
          };
    case 'rejected':
    case 'unexpected':
      return {
        title: 'Could not log it',
        body: 'Nothing was written and your stars are still here. Try again in a moment.',
        action: 'Try again',
        retryable: true,
      };
  }
}

// ---------------------------------------------------------------------------
// The pieces line
// ---------------------------------------------------------------------------

/**
 * "Wool coat, linen shirt, ankle boots" — or, past four pieces, the plainer
 * "Coat, shirt, trousers, skirt, boots".
 *
 * The colour is dropped once the list gets long, which is the accepted frame's
 * own behaviour and the right one: five colours in one line stops being a
 * description of an outfit and becomes a paint chart. The line never truncates
 * and never ends in an ellipsis — an outfit summarised by "and 2 more" is an
 * outfit the reader has to open something else to see.
 */
export function piecesSummary(
  pieces: readonly { category: string; subcategory: string | null; colors: readonly { name: string }[] }[],
): string {
  const long = pieces.length > 4;
  return pieces
    .map((p, i) => {
      const kind = p.subcategory?.trim() || (p.category === 'other' ? 'piece' : p.category);
      const word = long ? kind : [p.colors[0]?.name, kind].filter(Boolean).join(' ');
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(', ');
}

// ---------------------------------------------------------------------------
// Geometry — the accepted measures
// ---------------------------------------------------------------------------

export const SHEET_RADIUS = 28;
export const COLLAGE_RADIUS = 20;
export const COLLAGE_HEIGHT = 158;
/** Short devices and accessibility sizes both tighten the collage to make room. */
export const COLLAGE_HEIGHT_TIGHT = 118;

export const STAR_TARGET = 52;
export const STAR_TARGET_AX = 64;
export const STAR_GLYPH = 36;
export const STAR_GLYPH_AX = 56;

export const HEART_ROW = 60;
export const HEART_ROW_AX = 72;

export const CTA_HEIGHT = 56;
export const CTA_HEIGHT_AX = 60;
export const CTA_RADIUS = 30;
export const CANCEL_HEIGHT = 48;

/** A 667pt screen is short enough that the collage has to give up height. */
export const SHORT_DEVICE_HEIGHT = 700;

export function collageHeight(screenHeight: number, ax: boolean): number {
  return ax || screenHeight < SHORT_DEVICE_HEIGHT ? COLLAGE_HEIGHT_TIGHT : COLLAGE_HEIGHT;
}

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

export const WEAR_COPY = {
  /** The modal's own announcement, and its header. */
  sheetTitle: 'Log today’s outfit',

  ratingHeading: 'How was it?',
  ratingOptional: 'Optional',
  ratingCleared: 'Cleared',

  favorite: 'Favorite',
  favoritePrivate: 'Only you can see this',

  /** Shown only when the favourite and the stars genuinely disagree. */
  favoriteOverride: 'Marked a favorite — that is what taste learns from, not the two stars.',

  /**
   * The boundary, stated on the sheet that collects the private things.
   *
   * It names every field that stays owner-side rather than saying "private",
   * because a reader cannot check a word and can check a list.
   */
  privacyNote:
    'Never shared: rating, favorite, occasion, weather, notes and cost-per-wear stay on your side of the wall.',

  confirm: 'Log this outfit',
  confirmPending: 'Logging…',
  cancel: 'Cancel',
  done: 'Done',

  /** One settled wear. Announced once, and never celebrated. */
  settled: 'Logged. Wear counts updated.',
  /**
   * A retry that found the original. The operation id did its work and the
   * reader is told the thing they would otherwise have to trust: it happened
   * once.
   */
  settledIdempotent: 'Logged once. Nothing was duplicated.',
} as const;

/**
 * The spoken label for the collage — one coherent outfit, never five cells.
 *
 * "The quiet Wednesday, three pieces. Image." is the accepted announcement. The
 * count is of the reader's OWN outfit on their OWN screen, which is why a
 * number is allowed here and forbidden in the payloads.
 */
export function collageLabel(name: string, pieceCount: number): string {
  return `${name}, ${pieceCount} piece${pieceCount === 1 ? '' : 's'}`;
}
