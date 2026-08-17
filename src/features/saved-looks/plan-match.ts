/**
 * OS-08 — matching a saved look to the reader's OWN closet, and being honest
 * about what is not in it.
 *
 * ── THE PRIVACY RULE THIS FILE IMPLEMENTS ──────────────────────────────────
 *
 * §3: "Turning a save into a plan reads the *owner's own* closet only." What
 * goes INTO a plan is therefore, always and only, `items` rows belonging to
 * `auth.uid()` — `plan_outfit_tx` refuses anything else anyway ("one or more of
 * those items is not yours") — and this matcher can only ever return the
 * reader's own item ids. `matchClosetToLook` takes the closet as a parameter and
 * has no client of its own, so there is no path through it that could reach
 * somebody else's row even by accident.
 *
 * The WANTED list is a different thing and is bounded differently: it is a list
 * of descriptors read live, at plan time, from a surface the reader can already
 * see — their own `outfit_items` for an own outfit, `friend_worn_outfit_items`
 * for a daily look, the event's post items for an event look. None of it is
 * persisted, and none of it is available at all once the save turns
 * `unavailable`, which is exactly why `canPlan` refuses that state rather than
 * this file having to.
 *
 * ── WHY THE MATCH IS DELIBERATELY DUMB ─────────────────────────────────────
 *
 * Category first, then a shared colour, then a shared word in the name. Three
 * signals, in that order, and no embedding, no scorer, no model.
 *
 * The reason is what the screen does with the answer. A wrong match here is not
 * a mediocre suggestion — it is a garment silently put into somebody's plan for
 * Thursday under the words "Matched from your closet", which is a claim. The
 * cheap rules are the ones whose mistakes a person can see and undo; a scored
 * one is right more often and wrong invisibly. `MissingGarmentRow` and its three
 * buttons are what the design offers instead of confidence, and they only make
 * sense if the matcher is willing to say "Nothing similar found" often.
 *
 * ONE CLOSET ITEM MATCHES AT MOST ONE WANTED PIECE. A look with two knits and a
 * closet with one must report one match and one miss, not the same jumper twice
 * — a plan cannot contain the same garment in two places, and `plan_outfit_tx`
 * would reject the duplicate anyway.
 *
 * No React, no react-native, no supabase. `tests/saved-looks-plan-match.test.ts`
 * exercises the real function.
 */

/**
 * One piece of the saved look, as a descriptor.
 *
 * Deliberately not an `Item`. The wanted list can come from a friend's look,
 * where the only fields readable are the ones `friend_items` already exposes,
 * and typing this as the reader's own closet row would invite a caller to hand
 * it one.
 */
export interface WantedPiece {
  /** Stable within one match run; the source row's id. Never persisted. */
  id: string;
  /** `items.category` — 'top', 'bottom', 'shoes'… The primary key of the match. */
  category: string;
  /** What it was called on the surface it was read from. May be absent. */
  name: string | null;
  /** Colour names as the tagger produced them. Never hexes; see `sharesColour`. */
  colours: readonly string[];
  /**
   * Whether the look works without it. Accessories and outerwear are optional;
   * a top is not. OS-08 draws the difference as "Optional · skip for now"
   * against "Nothing similar found", which is the only place a reader is told
   * that skipping is safe.
   */
  optional: boolean;
}

/**
 * A closet item, as much of one as the match needs.
 *
 * Structural rather than importing `Item`: the four fields below are the whole
 * of what is read, and a wider type would let a future edit reach for
 * `purchasePrice` in a matcher.
 */
export interface ClosetPiece {
  id: string;
  category: string;
  name: string | null;
  colours: readonly string[];
}

/** A wanted piece the closet can supply, and the item that supplies it. */
export interface MatchedPiece {
  wanted: WantedPiece;
  closetItemId: string;
  closetItemName: string | null;
}

/** A wanted piece the closet cannot supply. */
export interface MissingPiece {
  wanted: WantedPiece;
}

export interface LookMatch {
  matched: MatchedPiece[];
  missing: MissingPiece[];
}

/**
 * Words that carry no distinguishing information in a garment name.
 *
 * Short and closed on purpose. A long stop list is a place for a bug to hide,
 * and the name signal is the weakest of the three anyway — it only ever breaks
 * ties within a category that already matched.
 */
const NOISE = new Set(['the', 'a', 'an', 'and', 'my', 'with', 'in', 'of']);

function words(value: string | null): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !NOISE.has(word)),
  );
}

function normalise(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

/**
 * Colour names, never hexes.
 *
 * `items.colors` carries an optional hex and a required name, and the hex is
 * absent on every freshly tagged row — `tag-item` writes names only. Matching on
 * hex would therefore silently never fire for the majority of a real closet
 * while looking, in a fixture, like it worked.
 */
function sharesColour(a: readonly string[], b: readonly string[]): boolean {
  const left = normalise(a);
  for (const colour of normalise(b)) {
    if (left.has(colour)) return true;
  }
  return false;
}

/**
 * A shared word in the two names, NOT counting words the colour signal already
 * covered.
 *
 * The exclusion is the whole of this function and it was found by a test rather
 * than reasoned to. Garment names routinely lead with their colour — "Cream
 * ribbed knit", "Cream silk blouse" — so without it, two candidates that share
 * only the colour word score identically to one that shares the actual
 * distinguishing term ("ribbed knit"), and the tie-break falls through to
 * arrival order. The colour is worth exactly one point, and it is already
 * counted; letting it earn a second through the name makes the name signal a
 * duplicate of the colour signal rather than an independent one.
 */
function sharesWord(a: string | null, b: string | null, ignore: ReadonlySet<string>): boolean {
  const left = words(a);
  for (const word of words(b)) {
    if (ignore.has(word)) continue;
    if (left.has(word)) return true;
  }
  return false;
}

/**
 * How well one closet item answers one wanted piece.
 *
 * Zero means "not this category", and it is the only score that refuses. The
 * ladder above it is the tie-break order, not a confidence: 3 is category and
 * colour and a shared word, 1 is category alone. A category-only match is still
 * a match, because "you have a pair of shoes" is a true and useful thing to say
 * about a look that wants shoes.
 *
 * The three signals are independent by construction — see `sharesWord` — so a
 * score of 3 means three different things agreed, not one thing counted twice.
 */
function affinity(wanted: WantedPiece, piece: ClosetPiece): number {
  if (wanted.category !== piece.category) return 0;
  let score = 1;
  if (sharesColour(wanted.colours, piece.colours)) score += 1;
  if (sharesWord(wanted.name, piece.name, normalise(wanted.colours))) score += 1;
  return score;
}

/**
 * The matcher.
 *
 * GREEDY, IN WANTED ORDER, and that is a decision rather than the easy
 * implementation. The alternative — a global assignment that maximises total
 * affinity — can move a match the reader has already looked at when an unrelated
 * piece further down the list changes, which on a screen you scroll through
 * twice is worse than a slightly poorer pairing. Wanted order is the order the
 * source look listed its pieces, so the result is stable and re-runs identically.
 *
 * Ties inside one wanted piece break on the closet's own order, which
 * `useCloset` returns newest-first. Given two equally good jumpers, the one
 * added most recently wins — the one the reader is most likely to be thinking of.
 */
export function matchClosetToLook(
  wanted: readonly WantedPiece[],
  closet: readonly ClosetPiece[],
): LookMatch {
  const taken = new Set<string>();
  const matched: MatchedPiece[] = [];
  const missing: MissingPiece[] = [];

  for (const want of wanted) {
    let best: ClosetPiece | null = null;
    let bestScore = 0;

    for (const piece of closet) {
      if (taken.has(piece.id)) continue;
      const score = affinity(want, piece);
      // Strictly greater: the first item at a given score wins, which is what
      // makes the closet's own order the tie-break.
      if (score > bestScore) {
        best = piece;
        bestScore = score;
      }
    }

    if (best) {
      taken.add(best.id);
      matched.push({ wanted: want, closetItemId: best.id, closetItemName: best.name });
    } else {
      missing.push({ wanted: want });
    }
  }

  return { matched, missing };
}

/**
 * The item ids a plan would be created from.
 *
 * Matched pieces only. A missing piece resolved by "Add manually" becomes a real
 * closet item first and arrives here on the next match run — there is no path
 * that puts a placeholder into a plan, because `plan_outfit_tx` takes item ids
 * and a placeholder has none.
 */
export function planItemIds(match: LookMatch): string[] {
  return match.matched.map((m) => m.closetItemId);
}

/**
 * May the plan be created?
 *
 * At least one matched piece. A plan of nothing is not a plan, and
 * `plan_outfit_tx` refuses it anyway ("an outfit needs at least one item") — so
 * offering the button would be offering a refusal. OS-08's bar reads "Create
 * plan with N pieces", and there is no honest way to print that sentence at
 * zero.
 *
 * Note what this does NOT require: that nothing is missing. Planning a look you
 * only half own is the ordinary case the whole screen is built around, and
 * "You can add the missing pieces anytime" is the sentence underneath.
 */
export function canCreatePlan(match: LookMatch): boolean {
  return match.matched.length > 0;
}

/**
 * Is a missing piece one the reader can safely leave out?
 *
 * A pure restatement of `WantedPiece.optional`, and it exists so the screen asks
 * a question rather than reading a flag: OS-08 offers "Skip" only on optional
 * rows, and a component that tested the boolean inline would be a component that
 * one day tests it inconsistently between the button and the label above it.
 */
export function canSkip(piece: MissingPiece): boolean {
  return piece.wanted.optional;
}
