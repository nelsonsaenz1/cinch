import { PLANS } from '@/features/billing/plans';
import { articleFor, numberWord, ordinalWord } from '@/features/onboarding/reveal-copy';

/**
 * TD-00's capacity note — "Paywall dismissed — Today, free closet intact".
 *
 * The atlas draws this as the last thing on the page after the paywall has been
 * closed, and annotates exactly what it is allowed to be: "The capacity note is
 * a fact in tray, not an upgrade prompt — no price and no tier name one screen
 * after a dismissed paywall." So there is no action, no tier, no figure that is
 * not already true of the closet on screen, and nothing here is locked by the
 * dismissal.
 *
 * WHY THIS IS A `.ts` AND NOT PART OF THE COMPONENT. `scripts/run-tests.mjs`
 * bundles with esbuild, which cannot parse React Native's Flow source, so
 * nothing importable by a test may reach a `.tsx`. Same split, same reason, as
 * `closet-floor-copy.ts` next to `closet-floor.tsx`.
 *
 * ── Every number is derived ────────────────────────────────────────────────
 *
 * "ten" is `numberWord` of the ACTIVE closet actually loaded on Today
 * (`useWardrobe` filters `is_archived = false`, so `items.length` IS the active
 * count — not a second network count that could disagree with the grid the
 * reader is looking at).
 *
 * "an eleventh" is the ordinal of that count plus one, with its own article, so
 * the sentence moves with `PLANS.free.items` rather than quoting a number typed
 * into prose. Both come from the hallway's own register (`reveal-copy.ts`),
 * which is what The Ten, the Reveal and the tour already speak in.
 */

/**
 * Whether the note may be printed at all.
 *
 * Three conditions, and each one exists because the sentence becomes false
 * without it:
 *
 *   * FREE ONLY. "Add an eleventh whenever you want a bigger closet" is a
 *     statement that a bigger closet exists to move to. On Pro there is nothing
 *     above, and on Standard the ordinal of 151 has no word in the hallway's
 *     table — `ordinalWord` would hand back "151th". The note is the free
 *     ceiling's note; it does not generalise, and pretending it does would
 *     print either a lie or a typo.
 *
 *   * EXACTLY AT THE CEILING. Not "at or above". A free account that came down
 *     from a paid tier keeps its whole closet (dependency ledger D-3: "nothing
 *     deleted on downgrade; the over-ceiling closet stays whole"), and adding is
 *     refused until it is back under the line — so telling a forty-seven-piece
 *     free closet to "add a forty-eighth" would name an action the database
 *     will refuse. At exactly ten, adding an eleventh is precisely what a
 *     bigger closet buys.
 *
 *   * A COUNT THAT HAS ACTUALLY LOADED. Zero pieces is not a closet at its
 *     ceiling; it is a closet that has not been read yet, and Today draws the
 *     empty state for it (TR-04) rather than this.
 *
 * `plan` is nullable for a fourth reason that is the same refusal one level up:
 * `usePlan()` answers `free` while its query is still in flight and again when
 * the read has FAILED, so a Standard closet of exactly ten would flash a
 * sentence that is false for it. The caller passes null until the tier is
 * genuinely known, and an unknown tier prints nothing rather than a guess.
 */
export function capacityNoteApplies(plan: string | null, activePieces: number): boolean {
  return plan === 'free' && activePieces === PLANS.free.items;
}

/** "Your closet holds ten active pieces" — the fact, in the label cut. */
export function capacityNoteHeading(activePieces: number): string {
  const pieces = activePieces === 1 ? 'piece' : 'pieces';
  return `Your closet holds ${numberWord(activePieces)} active ${pieces}`;
}

/**
 * "That is what these outfits are built from. Add an eleventh whenever you
 * want a bigger closet." — the prose half.
 *
 * The first sentence is the reason the count matters: the looks above were
 * composed out of exactly these pieces. The second names the only thing that
 * changes, without naming a tier or a price.
 */
export function capacityNoteBody(activePieces: number): string {
  const next = ordinalWord(activePieces + 1);
  return `That is what these outfits are built from. Add ${articleFor(next)} ${next} whenever you want a bigger closet.`;
}
