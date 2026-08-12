import type { IntakeDraftRow } from './queries';

/**
 * The procession's state machine, as pure functions.
 *
 * Deliberately NOT a hook and deliberately NOT in a component. §6's note is
 * blunt about why: "the undo stack lives in use-procession, not in a component
 * — component state dies on a re-render from the query cache and the undo
 * silently stops working." Pulling the whole reducer out to plain data goes one
 * further, because it makes every rule here testable without a renderer, and
 * the rules are the part that has to be right.
 *
 * `use-procession.ts` will be a thin `useReducer` over this, and the screens
 * (PR-01…PR-07) wait on their atlas.
 *
 * THE INVARIANT EVERYTHING HERE SERVES
 *
 * Nothing is ever lost (reframe directive §4.6). A rejected card is not
 * deleted, it is marked `rejected` and can come back. An undo restores the
 * previous state exactly. Reaching the end does not discard anything the user
 * did not confirm — the held drafts are what M-08's picker offers.
 */

/** How many steps back the undo stack holds. Three, per §6.
 *
 *  Not unlimited: an undo stack that reaches the start of a forty-card
 *  procession is a second way to navigate it, with no affordance saying so, and
 *  the one real use — "that last one was wrong" — never needs more than a few.
 */
export const UNDO_DEPTH = 3;

export type CardState = IntakeDraftRow['state'];

export type ProcessionState = {
  /** Index into the ordered drafts. May equal `drafts.length`, which is the
   *  legitimate "finished, awaiting commit" position. */
  cursor: number;
  drafts: IntakeDraftRow[];
  /** Most recent first. Bounded to UNDO_DEPTH. */
  undo: UndoEntry[];
};

/**
 * One reversible step.
 *
 * The whole previous draft is kept, not a diff. A diff would have to describe
 * every field an edit could touch, and getting that wrong means an undo that
 * silently keeps part of a correction — which is worse than no undo, because
 * the card looks restored.
 */
type UndoEntry = {
  cursor: number;
  draft: IntakeDraftRow;
};

export type ProcessionAction =
  | { type: 'confirm' }
  | { type: 'reject' }
  | { type: 'edit'; patch: Partial<IntakeDraftRow> }
  | { type: 'ambiguous'; quantity: number }
  | { type: 'back' }
  | { type: 'undo' };

export function initProcession(drafts: IntakeDraftRow[], cursor: number): ProcessionState {
  return {
    drafts,
    cursor: Math.min(Math.max(cursor, 0), drafts.length),
    undo: [],
  };
}

/** The card under the thumb, or null when the procession has run off the end. */
export function currentDraft(state: ProcessionState): IntakeDraftRow | null {
  return state.drafts[state.cursor] ?? null;
}

/** What the count reads: "4 of 23". One-based, and clamped so the finished
 *  position shows the last card's number rather than one past it. */
export function positionLabel(state: ProcessionState): { index: number; total: number } {
  return {
    index: Math.min(state.cursor + 1, state.drafts.length),
    total: state.drafts.length,
  };
}

export function isFinished(state: ProcessionState): boolean {
  return state.drafts.length > 0 && state.cursor >= state.drafts.length;
}

/** Drafts that will actually become garments at commit. */
export function confirmedCount(state: ProcessionState): number {
  return state.drafts.filter((d) => d.state === 'confirmed').length;
}

export function processionReducer(
  state: ProcessionState,
  action: ProcessionAction,
): ProcessionState {
  switch (action.type) {
    case 'confirm':
      return advance(state, { state: 'confirmed' });

    // NOT a delete. The row stays, marked rejected, which is what makes this
    // undoable and what keeps the count in "23 pieces" honest about how many
    // things were actually heard.
    case 'reject':
      return advance(state, { state: 'rejected' });

    // An edit implies the card is now right, so it confirms too. Making someone
    // correct a card and THEN confirm it is a second tap for no information —
    // the correction is the confirmation.
    case 'edit':
      return advance(state, { ...action.patch, state: 'confirmed' });

    case 'ambiguous':
      return advance(state, {
        quantity: Math.min(Math.max(Math.round(action.quantity), 1), 12),
        state: 'confirmed',
      });

    // Step back WITHOUT changing anything. Distinct from undo: this is
    // navigation (the swipe-right gesture), and the card it lands on keeps
    // whatever state it already had.
    case 'back':
      return state.cursor <= 0 ? state : { ...state, cursor: state.cursor - 1 };

    case 'undo': {
      const [entry, ...rest] = state.undo;
      if (!entry) return state;
      return {
        cursor: entry.cursor,
        // Restored by id rather than by index: an undo that assumed position
        // would write the old draft over whatever happens to sit there now.
        drafts: state.drafts.map((d) => (d.id === entry.draft.id ? entry.draft : d)),
        undo: rest,
      };
    }
  }
}

/**
 * Apply a change to the current card, push the old one onto the undo stack, and
 * move on.
 *
 * A no-op when the procession has already run off the end, so a double-tap on
 * the last card cannot push a phantom entry or walk the cursor past the drafts.
 */
function advance(state: ProcessionState, patch: Partial<IntakeDraftRow>): ProcessionState {
  const draft = state.drafts[state.cursor];
  if (!draft) return state;

  return {
    cursor: state.cursor + 1,
    drafts: state.drafts.map((d) => (d.id === draft.id ? { ...d, ...patch } : d)),
    undo: [{ cursor: state.cursor, draft }, ...state.undo].slice(0, UNDO_DEPTH),
  };
}

/**
 * The card the last decision dropped, if the last decision was a drop.
 *
 * PR-05's confirmation band reads this. It is derived rather than stored, which
 * is what makes the band obey its own rule without a timer: the band is a
 * function of the top of the undo stack, so the NEXT decision pushes a new
 * entry and the band goes — "a tray band that stays until the next decision,
 * not a toast that vanishes on a timer".
 *
 * The undo entry holds the draft as it was BEFORE the reject, so the current
 * state has to be read back out of `drafts` by id.
 */
export function lastDropped(state: ProcessionState): IntakeDraftRow | null {
  const entry = state.undo[0];
  if (!entry) return null;
  const now = state.drafts.find((d) => d.id === entry.draft.id);
  return now && now.state === 'rejected' ? now : null;
}
