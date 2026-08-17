/**
 * EVERY WORD THE SAVED-LOOKS FLOW SAYS, INCLUDING THE SPOKEN ONES.
 *
 * A `.ts` and not a component, for the reason every copy module in this codebase
 * is one: a sentence that makes a promise about who can see something is worth a
 * test, and a test should not have to render React to read it.
 * `features/privacy/visibility-copy.ts`, `features/daily-social/copy.ts` and
 * `features/circles/copy.ts` all made the same split for the same reason.
 *
 * ══ THE CONTRACT THIS FILE KEEPS ═══════════════════════════════════════════
 *
 * The handoff's §7 is a table of 47 strings and it ends "Verbatim strings appear
 * in the DC refs; keep them in sync." So these are transcribed, not paraphrased,
 * and `tests/saved-looks-copy.test.ts` reads the handoff back and fails on a
 * drift in either direction.
 *
 * ══ WHAT MAY NEVER APPEAR HERE ═════════════════════════════════════════════
 *
 * · **No word that implies anybody else can see a save.** No "share", no
 *   "public", no "followers", no "board" in the shared sense, no "who saved
 *   this". A save is a private note the reader made about a look, and the person
 *   whose look it was is not told it was kept — which is a property of the
 *   select policy (`owner_id = auth.uid()`, and nothing else), asserted in
 *   21_saved_looks.sql at 14.
 * · **Nothing that says which kind of revocation happened.** OS-06 says
 *   "expired or their sharing changed" and stops there. Expired, un-shared,
 *   circle changed and hard-deleted are one answer to the reader on purpose:
 *   `can_save_source` returns a boolean, and telling the four apart would be
 *   four different disclosures about somebody else's decision.
 * · **Nothing that claims the source was affected.** Removing a save removes a
 *   save. `REMOVE.body` says so in as many words, because the fear at that
 *   moment is that the thing being deleted is somebody else's look.
 * · **No blame, and no arithmetic in a headline.** The count sentences below
 *   rebuild around their number rather than printing "1 looks".
 */

// ---------------------------------------------------------------------------
// The list — OS-01, OS-03
// ---------------------------------------------------------------------------

/** The screen's own title. One word, and it is the customer's word. */
export const SAVED_TITLE = 'Saved';

/**
 * OS-01, verbatim.
 *
 * The hint is not an instruction and not a button — it is a picture of the
 * control, printed where somebody looking for it will read it. The save
 * affordance lives on the look surfaces (Daily, a group, an event), which is
 * exactly where this screen cannot send them, so the empty state describes the
 * thing rather than pretending to be a door to it.
 *
 * `symbol` is the SF name `EmptyState` takes. `bookmark` rather than `heart` or
 * `star`: the affordance drawn on every look surface in OS-02 is a bookmark, and
 * an empty state whose glyph is not the control it describes is a riddle.
 */
export const EMPTY = {
  symbol: 'bookmark',
  title: 'Nothing saved yet',
  body: 'Tap the bookmark on any look to keep it here — just for you.',
  hint: 'Look for this on any outfit',
} as const;

/** "All · 14" — the leading filter chip. Numerals: this is a data chip, not prose. */
export function allFilterLabel(total: number): string {
  return `All · ${count(total)}`;
}

// ---------------------------------------------------------------------------
// Saving — OS-02
// ---------------------------------------------------------------------------

/**
 * The affordance and its two toasts.
 *
 * `toastDuplicate` is an INFO state, not a success one, and the distinction is
 * carried in three places at once so it cannot be lost in any of them: this
 * string, the haptic (`selection`, never `success`), and the toast's own tone.
 * A second tap that chimes like a first tap teaches the reader they have saved
 * two things.
 */
export const SAVE = {
  cta: 'Save look',
  savedPill: 'Saved',
  toastCreated: 'Saved to your looks',
  toastUndo: 'Undo',
  toastDuplicate: 'Already in your looks',
  toastView: 'View',
} as const;

/**
 * The optional sheet after a save — OS-02b.
 *
 * "Optional" is the first word of the subtitle for a reason: the save has
 * already landed by the time this appears, and a sheet that looked mandatory
 * would make people think dismissing it undid something. `dismiss` is "Not now"
 * rather than "Cancel" for the same reason — there is nothing here to cancel.
 */
export const SAVE_SHEET = {
  title: 'Add to a collection?',
  subtitle: 'Optional — collections stay private to you.',
  newCollection: 'New collection',
  dismiss: 'Not now',
} as const;

// ---------------------------------------------------------------------------
// The detail — OS-04
// ---------------------------------------------------------------------------

export const DETAIL = {
  /**
   * The caps rule over the private card. It is a label, not a promise being
   * made — the promise is the select policy, and this is the reader being told
   * which half of the screen is theirs.
   */
  privateHeader: 'Private to you',
  noteLabel: 'Your note',
  savedLabel: 'Saved',
  collectionLabel: 'Collection',
  planCta: 'Plan this look',
  moveCta: 'Move to…',
  removeCta: 'Remove',
} as const;

/** "Saved from Maya's Daily look" — the provenance line, read-only, always. */
export function provenanceFrom(source: string): string {
  return `Saved from ${source.trim()}`;
}

// ---------------------------------------------------------------------------
// Collections — OS-05
// ---------------------------------------------------------------------------

export const COLLECTIONS = {
  title: 'Collections',
  section: 'Private collections',
  create: 'New collection',
  /**
   * The hint under the list, and its second sentence is the one that matters:
   * it answers, before anybody taps Delete, the question the confirm sheet would
   * otherwise be the first place to answer.
   */
  hint: 'Swipe a collection, or tap into it, to rename or delete. Deleting a collection keeps its looks in Saved.',
  renameTitle: 'Rename collection',
  /** The ceiling is printed because it is enforced — see `COLLECTION_NAME_MAX`. */
  nameHint: 'Names are private and visible only to you. 40 characters max.',
  save: 'Save',
  cancel: 'Cancel',
  done: 'Done',
} as const;

/** `Delete "Fall layering"?` — the name in the question, so nothing is ambiguous. */
export function deleteCollectionTitle(name: string): string {
  return `Delete “${name.trim()}”?`;
}

/**
 * WHAT SURVIVES, NAMED, AT ANY NUMBER.
 *
 * The sentence rebuilds around its count rather than printing "The 1 looks
 * inside", and the zero case drops the clause entirely — telling somebody that
 * the zero looks inside will stay in Saved is arithmetic, not reassurance.
 *
 * It is true of the schema rather than of this file: `saved_looks.collection_id`
 * is `on delete set null`, asserted in 21_saved_looks.sql at 23.
 */
export function deleteCollectionBody(memberCount: number): string {
  const n = count(memberCount);
  const tail = 'This can’t be undone.';
  if (n === 0) return `Nothing is inside it. ${tail}`;
  if (n === 1) return `The 1 look inside stays in Saved. ${tail}`;
  return `The ${n} looks inside stay in Saved. ${tail}`;
}

export const DELETE_COLLECTION = {
  confirm: 'Delete collection',
  /**
   * The calm outcome, first in reading order. `DeleteBoardSheet` set this
   * grammar and the reason holds here: the destructive action is the one that
   * has to be chosen deliberately, so it is not the one the eye lands on.
   */
  keep: 'Keep collection',
} as const;

/** "6 looks" — the quiet line under a collection's name. */
export function collectionCountLine(n: number): string {
  const c = count(n);
  return c === 1 ? '1 look' : `${c} looks`;
}

// ---------------------------------------------------------------------------
// The source that went away — OS-06
// ---------------------------------------------------------------------------

export const UNAVAILABLE = {
  title: 'This look is no longer available',
  keep: 'Keep note only',
  remove: 'Remove save',
  gridTag: 'Unavailable',
  /** OS-06's own heading over the snapshot card, in place of "Private to you". */
  keptHeader: 'What you kept',
} as const;

/**
 * Why it went, without saying which of the four things happened.
 *
 * Expired, un-shared, circle changed, hard-deleted: `can_save_source` returns a
 * boolean and the reader gets one sentence. Telling them apart would be telling
 * this reader about somebody else's decision, one case at a time.
 *
 * `name` is the source owner as the snapshot recorded them. The possessive is
 * built without an apostrophe-s on the label because the label already reads
 * "Ava's Daily look"; this takes the bare name.
 */
export function unavailableBody(name: string): string {
  const who = name.trim() || 'That person';
  return `${who}’s look expired or their sharing changed. You can still keep your note, or remove this save.`;
}

/**
 * THE SENTENCE THAT MAKES THE WHOLE FEATURE LEGIBLE, and it is true by
 * construction rather than by promise.
 *
 * `saved_looks` has no foreign key to `items`, `outfit_items` or `outfits`, and
 * 21_saved_looks.sql asserts exactly that at assertion 1. Nothing garment-level
 * was ever copied, so there is nothing to have kept.
 */
export function unavailablePrivacyNote(name: string): string {
  const who = name.trim() || 'that person';
  return `We never copied ${who}’s garments into your closet, so nothing private was kept beyond your own note.`;
}

/** The banner over OS-06's grid. Rebuilds around its number; never "1 looks". */
export function unavailableCountBanner(n: number): string {
  const c = count(n);
  return c === 1
    ? '1 saved look is no longer available.'
    : `${c} saved looks are no longer available.`;
}

// ---------------------------------------------------------------------------
// Removing — OS-07
// ---------------------------------------------------------------------------

export const REMOVE = {
  title: 'Remove this saved look?',
  confirm: 'Remove',
  moveInstead: 'Move to a collection instead',
  cancel: 'Cancel',
  /** The row hint above OS-07's list — the sentence that makes the gesture optional. */
  hint: 'Swipe a look for actions, or tap ••• for the same options.',
} as const;

/**
 * The fear at this moment is that the thing being deleted is somebody else's
 * look, so the second sentence answers it by name.
 */
export function removeBody(sourceLabel: string): string {
  const source = sourceLabel.trim() || 'its source';
  return `It leaves your Saved and any collection. The original in ${source} isn’t affected.`;
}

// ---------------------------------------------------------------------------
// Planning it — OS-08
// ---------------------------------------------------------------------------

export const PLAN = {
  title: 'Plan this look',
  matchedTag: 'Matched from your closet',
  noMatch: 'Nothing similar found',
  optional: 'Optional · skip for now',
  findSimilar: 'Find similar',
  addManual: 'Add manually',
  skip: 'Skip',
  ctaNote: 'You can add the missing pieces anytime.',
  doneTitle: 'Plan created',
  doneOpen: 'Open plan',
  doneBack: 'Back to Saved',
  cancel: 'Cancel',
} as const;

/** "Your closet · 2 matched" — the section rule over what was found. */
export function matchedHeader(n: number): string {
  return `Your closet · ${count(n)} matched`;
}

/** "Not in your closet · 2" — and the section is absent entirely at zero. */
export function missingHeader(n: number): string {
  return `Not in your closet · ${count(n)}`;
}

/**
 * "Create plan with 2 pieces" — and it says how many, because the number is the
 * whole point of the screen.
 *
 * The one-piece case is spelled out rather than left as "1 pieces", and the
 * zero case is not a label at all: a plan with nothing in it is not offered, and
 * `canCreatePlan` in `plan-match.ts` is what refuses it.
 */
export function planCta(pieces: number): string {
  const n = count(pieces);
  return n === 1 ? 'Create plan with 1 piece' : `Create plan with ${n} pieces`;
}

/** "Matching 4 pieces to your closet" — the line under the look being planned. */
export function matchingLine(pieces: number): string {
  const n = count(pieces);
  return n === 1 ? 'Matching 1 piece to your closet' : `Matching ${n} pieces to your closet`;
}

// ---------------------------------------------------------------------------
// Waiting, offline, refused — OS-09
// ---------------------------------------------------------------------------

/**
 * Two banners and an error, and the split between them is the claims discipline
 * the whole kit runs on.
 *
 * `OFFLINE` is a BANNER over content, not a screen instead of it: the reader has
 * their last synced looks and they are real. `ERROR` is a screen, because a
 * failed read knows nothing and must never be dressed as an empty one — the
 * refusal `ErrorState` exists for.
 *
 * "Your saves are safe" is a claim about the WRITE side and it is one this
 * feature is entitled to make: nothing about a failed list read touches a row.
 */
export const OFFLINE = {
  banner: 'You’re offline. Showing your last synced looks.',
  imageNotSynced: 'Image not synced',
} as const;

export const NO_IMAGE = 'No image saved';

/** OS-06's tile and hero, when the snapshot itself never had an image to keep. */
export const PREVIEW_UNAVAILABLE = 'Preview unavailable';

export const ERROR = {
  title: 'Couldn’t load your looks',
  body: 'Something went wrong on our end. Your saves are safe.',
  retry: 'Try again',
} as const;

// ---------------------------------------------------------------------------
// What VoiceOver hears
// ---------------------------------------------------------------------------

/**
 * THE SAVE BUTTON CARRIES ITS STATE IN THE LABEL, not only in its fill.
 *
 * §9 says so in as many words — "state in label, not just visual" — and the
 * reason is that the two states differ visually by ground colour and border
 * alone. `accessibilityState.selected` is set as well; the label is what makes
 * the control legible to somebody who lands on it cold, without having heard the
 * unselected version first.
 */
export function saveButtonLabel(saved: boolean): string {
  return saved ? 'Saved, in your looks' : SAVE.cta;
}

/**
 * A grid card, as one sentence.
 *
 * Composed rather than left to VoiceOver's default traversal because the card is
 * a title over a quiet provenance line, and swiping through two fragments of
 * that is worse than hearing the fact once.
 *
 * "Unavailable" is PREPENDED — §9's word — so a reader who moves quickly hears
 * the disqualifying fact before the title rather than after the date. A card
 * whose tag arrived last would be a card you had to listen to the end of to know
 * whether it was worth opening.
 */
export function cardAccessibilityLabel({
  title,
  sourceLabel,
  savedAgo,
  availability,
}: {
  title: string | null;
  sourceLabel: string;
  savedAgo: string;
  availability: 'available' | 'unavailable';
}): string {
  const parts = [title?.trim() || 'Untitled look', `saved from ${sourceLabel.trim()}`, savedAgo];
  const sentence = `${parts.filter(Boolean).join(', ')}.`;
  return availability === 'unavailable' ? `${UNAVAILABLE.gridTag}. ${sentence}` : sentence;
}

/**
 * The provenance row, grouped and read-only.
 *
 * All three facts in one label — who, what visibility, when — because the row is
 * not a control and VoiceOver should not offer it as three stops. The middle dot
 * the frame draws is dropped: spoken, it is either silence or the words "middle
 * dot", and neither is what the row means.
 */
export function provenanceAccessibilityLabel({
  sourceLabel,
  visibility,
  when,
}: {
  sourceLabel: string;
  visibility: string;
  when: string;
}): string {
  return `${provenanceFrom(sourceLabel)}. ${visibility.trim()}. ${when.trim()}.`;
}

/** The destructive control names its target, so it can never be a blind tap. */
export function removeAccessibilityLabel(title: string | null): string {
  return `${DETAIL.removeCta} ${title?.trim() || 'this saved look'} from Saved`;
}

/** The filter chip says what it selects and how many, never only its colour. */
export function filterAccessibilityLabel(name: string, n: number): string {
  return `${name.trim()}, ${collectionCountLine(n)}`;
}

// ---------------------------------------------------------------------------

/**
 * A count, defended.
 *
 * Every sentence above is shown to a person, so none of them may have an
 * undefined branch. A query that has not answered yet hands back `undefined`,
 * and `undefined` through a template literal is the word "undefined" printed in
 * a headline.
 */
function count(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
