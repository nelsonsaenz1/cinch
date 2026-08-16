/**
 * TODAY'S CONTEXT, DISCLOSED PROGRESSIVELY — UX-03.
 *
 * The composer is the only permission-free way the day's plans reach the
 * styling engine. `/event/new` writes a Cinch occasion, which `useStyleContext`
 * never reads; the device calendar is the other input and it costs a
 * permission. So this field is not optional furniture — it is the sentence
 * "dinner at 7 then drinks after", which is what the engine exists for.
 *
 * What was wrong was never the field. It was that the field was ALWAYS THERE:
 * a permanently open 44pt tray with a placeholder, above three outfit plates,
 * on every visit including the overwhelming majority where the reader has
 * nothing to add. UX-03's correction is disclosure, not deletion — a compact
 * `Add context` affordance that opens the same field on intent.
 *
 * ── THE THREE REFUSALS IN THIS FILE ───────────────────────────────────────
 *
 *   * CLOSING IS NOT DISCARDING. Committing keeps the words in the field as
 *     well as sending them, and re-opening seeds the field from what is
 *     committed — so tapping away mid-sentence and coming back does not cost
 *     the sentence, and changing "dinner at 7" to "dinner at 8" is an edit
 *     rather than a retype. "Preserve entered context" is the brief's phrase.
 *   * COMMITTING NOTHING IS CLEARING. A committed empty string would put the
 *     screen into an applied state that styles for "" and says so; blank is
 *     how a person un-says something, and it is read as that.
 *   * THERE IS NO CLOCK IN HERE. The context lives as long as the screen does,
 *     exactly as it did before, and no local-midnight rule was added — the
 *     implementation plan refuses that invention explicitly. This is a
 *     disclosure change, not a new piece of product state.
 *
 * Primitives in, primitives out: no React and no React Native, because the unit
 * test bundler cannot follow React Native's Flow source and this reducer is the
 * part of the composer worth testing.
 */

export type ComposerState = {
  /** Whether the editor is open. */
  open: boolean;
  /** What is in the field right now — committed or not. */
  draft: string;
  /** What the engine is actually styling for. Trimmed, or empty for none. */
  committed: string;
};

/** A screen that has never been told anything about the day. */
export const EMPTY_COMPOSER: ComposerState = { open: false, draft: '', committed: '' };

/**
 * Which of the three faces the composer wears.
 *
 * `add` — one quiet affordance, and the plates below are the page.
 * `editing` — the field, open because the reader asked for it.
 * `applied` — the sentence being styled for, and the way to change or clear it.
 */
export type ComposerFace = 'add' | 'editing' | 'applied';

export function composerFace(state: ComposerState): ComposerFace {
  if (state.open) return 'editing';
  return state.committed ? 'applied' : 'add';
}

/**
 * Open the editor.
 *
 * The draft is seeded from what is committed when there is nothing half-typed,
 * so re-opening an applied context is an EDIT of that sentence rather than a
 * blank field the reader has to retype to keep. A live draft wins, because it
 * is the newer of the two things the reader said.
 */
export function openComposer(state: ComposerState): ComposerState {
  return { ...state, open: true, draft: state.draft || state.committed };
}

/**
 * Commit what is in the field and close.
 *
 * Trimmed once, here, so `committed` is the same string the engine is keyed on
 * and the one the applied sentence quotes — a screen that styled for "dinner "
 * and printed "dinner" would be two facts about one word.
 */
export function commitComposer(state: ComposerState): ComposerState {
  const committed = state.draft.trim();
  return { open: false, draft: committed, committed };
}

/** Clear everything — the ✕ on the applied line. Back to the bare affordance. */
export function clearComposer(): ComposerState {
  return EMPTY_COMPOSER;
}

/** The affordance's own words. Short, and a verb: it opens a field. */
export const ADD_CONTEXT_LABEL = 'Add context';

/** What the affordance tells VoiceOver, which has no plus glyph to read. */
export const ADD_CONTEXT_HINT = 'Tell Cinch what today looks like so it can style for it';

/** "Styling for “dinner at 7”." — the applied sentence, quoted so the reader's own words are visibly theirs. */
export function appliedLine(committed: string): string {
  return `Styling for “${committed}”.`;
}
