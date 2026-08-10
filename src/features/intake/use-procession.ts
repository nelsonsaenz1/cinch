import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { saveCursor, saveDraft } from './actions';
import { intakeCardConfirmed, intakeCardRejected } from './analytics';
import {
  currentDraft,
  initProcession,
  isFinished,
  processionReducer,
  type ProcessionAction,
  type ProcessionState,
} from './procession';
import type { IntakeDraftRow } from './queries';

/**
 * The procession, with the two things a component cannot own.
 *
 * `procession.ts` is a pure reducer and it stays that way — it is the piece
 * that is testable without a renderer. This hook is the impure half: the undo
 * window, and getting the result to the database.
 *
 * WHY THE UNDO TIMER LIVES HERE
 *
 * The directive is explicit that the undo stack belongs in a hook rather than
 * a component, and the reason is not tidiness. `useDrafts` is a react-query
 * subscription; anything that invalidates it re-renders the review screen. A
 * `useState` timer inside `GarmentCard` would be torn down and re-created by
 * that re-render, so the four-second window would silently reset — or expire
 * early — every time an unrelated query settled. The bug would appear only
 * under real network timing and never in a fixture.
 *
 * WHY WRITES ARE FIRE-AND-FORGET
 *
 * A confirm must feel instantaneous; the card slides at 220ms and the next one
 * is already under the thumb. Awaiting a round trip before advancing would make
 * the whole procession feel like it is asking permission. So the reducer is the
 * source of truth for the session and the database catches up behind it.
 *
 * That is safe because of what the writes are: `state` on a draft row, and a
 * cursor. Losing one to a dropped connection costs a re-confirmation of one
 * card on resume — the drafts themselves were written server-side by
 * `parse-closet` and are not at risk. Nothing here can lose a garment, which is
 * the only property that matters (refusal 7).
 */

/** How long the undo affordance stays on screen after an action. */
const UNDO_WINDOW_MS = 4000;

/**
 * Cursor writes are debounced. Someone tapping through twenty cards in fifteen
 * seconds would otherwise issue twenty updates to the same row, and only the
 * last one is worth anything — the cursor is a resume hint, not a log.
 */
const CURSOR_DEBOUNCE_MS = 800;

export type UseProcession = {
  state: ProcessionState;
  dispatch: (action: ProcessionAction) => void;
  /** The card under the thumb, or null once the procession has run off the end. */
  draft: IntakeDraftRow | null;
  finished: boolean;
  /** True for `UNDO_WINDOW_MS` after a confirm or reject. */
  showUndo: boolean;
  /** Every draft the user kept, in spoken order. What `commitIntake` takes. */
  confirmed: IntakeDraftRow[];
};

export function useProcession(
  sessionId: string | null,
  drafts: IntakeDraftRow[],
  initialCursor: number,
): UseProcession {
  const [state, rawDispatch] = useReducer(
    processionReducer,
    { drafts, cursor: initialCursor },
    ({ drafts: d, cursor }) => initProcession(d, cursor),
  );

  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The row as it was BEFORE the action, captured synchronously in the
   * dispatch wrapper. Reading it out of the next render's state instead would
   * race the reducer and persist the wrong card.
   */
  const pending = useRef<IntakeDraftRow | null>(null);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
    },
    [],
  );

  const dispatch = useCallback(
    (action: ProcessionAction) => {
      const card = currentDraft(state);
      pending.current = card;

      rawDispatch(action);

      // The window opens on the two destructive-feeling actions and on nothing
      // else. `back` is already reversible by swiping the other way, and
      // offering undo for it would put two affordances on the same gesture.
      if (action.type === 'confirm' || action.type === 'reject') {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setShowUndo(true);
        undoTimer.current = setTimeout(() => setShowUndo(false), UNDO_WINDOW_MS);
      }
      // An undo closes the window immediately. Leaving it open would invite a
      // second tap that undoes the undo, which is not what the affordance says.
      if (action.type === 'undo') {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setShowUndo(false);
      }

      if (!card) return;

      switch (action.type) {
        case 'confirm':
          intakeCardConfirmed();
          void saveDraft(card.id, { state: 'confirmed' });
          break;
        case 'reject':
          intakeCardRejected();
          void saveDraft(card.id, { state: 'rejected' });
          break;
        case 'edit':
          void saveDraft(card.id, action.patch);
          break;
        case 'ambiguous':
          void saveDraft(card.id, { quantity: action.quantity, state: 'confirmed' });
          break;
        case 'undo':
          // Put the row back exactly as it was. `procession.ts` keeps the whole
          // previous draft rather than a diff for this reason — a partial
          // restore is worse than none, because the card looks restored.
          if (state.undo[0]) {
            const restored = state.undo[0].draft;
            void saveDraft(restored.id, { state: restored.state, quantity: restored.quantity });
          }
          break;
        default:
          break;
      }
    },
    [state],
  );

  // Cursor persistence, debounced. This is what makes the procession resumable
  // across a cold start (§5.1) — without it a killed app restarts at card one
  // and the user re-confirms a wardrobe they already checked.
  useEffect(() => {
    if (!sessionId) return;
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => {
      void saveCursor(sessionId, state.cursor);
    }, CURSOR_DEBOUNCE_MS);
  }, [sessionId, state.cursor]);

  const confirmed = useMemo(
    () => state.drafts.filter((d) => d.state === 'confirmed'),
    [state.drafts],
  );

  return {
    state,
    dispatch,
    draft: currentDraft(state),
    finished: isFinished(state),
    showUndo,
    confirmed,
  };
}
