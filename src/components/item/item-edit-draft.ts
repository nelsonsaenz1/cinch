import type { ItemCategory } from '@/schemas/item';

/** What the edit sheet edits. The sheet's own props re-export this. */
export type ItemEditDraft = {
  /** The specific word for the garment — writes to `subcategory`. */
  name: string;
  /** Raw text, parsed by the caller. Empty string clears the price. */
  price: string;
  /** The shelf the piece is filed under. */
  category: ItemCategory;
};

/**
 * The edit sheet's draft, and the rule for when the row may overwrite it.
 *
 * ── Why this is a state machine and not two lines of render-phase state ───
 *
 * The sheet used to re-seed from the row like this:
 *
 *     const [wasVisible, setWasVisible] = useState(visible);
 *     if (visible !== wasVisible) { setWasVisible(visible); if (visible) setDraft(initial); }
 *
 * `visible` was chosen over `initial` on purpose — `initial` is a fresh object
 * literal on every render of the item page, so keying on it would reset the
 * field under the user's cursor. That reasoning was right and is kept below.
 *
 * What it could not express is the OTHER half of the promise: once a person has
 * touched a field, the row is no longer allowed to speak. A transition is not
 * the same claim as "this draft is still the row's" — it cannot tell an open
 * from a re-creation, and it cannot tell a first render from a re-render whose
 * `initial` arrived from a background refetch. Both of those put the stored
 * category back over a tapped one while the chip the reader is looking at says
 * otherwise, and Save then writes the value they thought they had replaced.
 *
 * So the seed is keyed on the draft's own provenance instead: `seededFrom` is
 * the row this draft came from, and it is dropped the moment the reader edits
 * anything. A seed happens when the sheet is open, the draft is untouched, and
 * the row it would seed from is not the one it already holds. Closing forgets
 * both, because the next open is a fresh document.
 */
export type DraftState = {
  draft: ItemEditDraft;
  /** The row this draft was last seeded from. Null when it was never seeded. */
  seededFrom: ItemEditDraft | null;
  /**
   * Whether the reader has changed anything since the sheet opened. This is
   * what makes the draft theirs rather than the row's: while it is true, no
   * `initial` may overwrite the draft, and the value Save sends is the one the
   * chips and fields are showing.
   */
  touched: boolean;
};

function same(a: ItemEditDraft | null, b: ItemEditDraft | null): boolean {
  if (a === null || b === null) return a === b;
  return a.name === b.name && a.price === b.price && a.category === b.category;
}

/** The state a freshly mounted sheet holds. */
export function initialDraftState(initial: ItemEditDraft, visible: boolean): DraftState {
  return { draft: initial, seededFrom: visible ? initial : null, touched: false };
}

/**
 * The draft this render should hold, given the row and whether the sheet is
 * open. Returns the SAME object when nothing changes — this runs during render,
 * and an identity that churned would be a render loop.
 */
export function syncDraftState(
  state: DraftState,
  { visible, initial }: { visible: boolean; initial: ItemEditDraft },
): DraftState {
  if (!visible) {
    // Closed. The draft is kept (a failed save leaves it on screen), but its
    // provenance is forgotten so the next open re-seeds from the row even when
    // the row has not changed.
    if (state.seededFrom === null && !state.touched) return state;
    return { draft: state.draft, seededFrom: null, touched: false };
  }

  // Touched by the reader, or already holding this exact row. Either way the
  // row has nothing to add, and saying it again would discard a selection.
  if (state.touched || same(state.seededFrom, initial)) return state;

  return { draft: initial, seededFrom: initial, touched: false };
}

/**
 * One field, changed by the reader. This is what takes the draft away from the
 * row: after it, no `initial` may overwrite the draft until the sheet closes.
 */
export function editDraft(state: DraftState, change: Partial<ItemEditDraft>): DraftState {
  return { draft: { ...state.draft, ...change }, seededFrom: state.seededFrom, touched: true };
}
