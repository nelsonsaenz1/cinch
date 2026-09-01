/**
 * The one ceiling on a garment title, and the one way to reach it.
 *
 * WHY THIS IS ITS OWN FILE
 *
 * The rule is a round trip, not a length: every title this function EMITS —
 * on a search tile, on a family card — comes back moments later as the `title`
 * of an import, because that is exactly what the client posts. So the number
 * the validator enforces and the number the producers cut at have to be the
 * same number, and the only way to guarantee that is for there to be one.
 *
 * `page-meta.ts` had the rule written down and honoured it against a copy of
 * the constant. The two catalogue producers did not: `catalog-provider.ts` cut
 * at 200 and `families.ts` did not cut at all, so a merchant with a long
 * product name produced a card the user could see, tap, and never import —
 * "imports[0].title is too long (170 characters, limit 120)" — with nothing
 * they could do about it, because the title was never theirs. The copies are
 * now imports of this file, so the drift that caused it cannot recur.
 *
 * WHY THE CUT IS AT A WORD
 *
 * A hard slice produces "…Reinforced Shoul", which reads as a bug on the card.
 * Cutting back to the last space costs a few characters and produces a name a
 * person accepts as shortened rather than broken. The one case where that is
 * not possible — a single unbroken word longer than the bound — falls back to
 * the hard cut, because an empty title is worse than a clipped one.
 */

/** Mirrors nothing: this IS the bound. `bounds.ts` imports it. */
export const MAX_TITLE_CHARS = 120;

/** Punctuation a cut can orphan. Same set `displayTitle` cleans up after. */
const TRAILING_PUNCTUATION = /[\s\-–—|,/(]+$/;

/**
 * A title trimmed to something the import endpoint will accept back.
 *
 * Deterministic and idempotent: the same input always yields the same output,
 * and re-bounding an already-bounded title changes nothing — so a value that
 * makes the round trip twice does not lose a word each time.
 */
export function boundTitle(value: string, max: number = MAX_TITLE_CHARS): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;

  const window = trimmed.slice(0, max);
  // When the character the cut displaced is itself a space, the window already
  // ends on a whole word and there is nothing to give back.
  const atBoundary = /\s/.test(trimmed[max] ?? '');
  const lastSpace = atBoundary ? -1 : window.search(/\s\S*$/);
  const cut = lastSpace > 0 ? window.slice(0, lastSpace) : window;

  // A cut that lands just after a comma or dash leaves the punctuation dangling
  // with nothing behind it. If cleaning empties the string — a title that is
  // one long word of punctuation — the raw window is still a better answer
  // than nothing.
  return cut.replace(TRAILING_PUNCTUATION, '').trim() || window.trim();
}
