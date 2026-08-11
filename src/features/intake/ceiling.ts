import { kindOfSlot, type CountedKind, type Tally } from '@/features/closet/outfit-count';

import type { IntakeDraftRow } from './queries';

/**
 * M-07 / M-08 — the ceiling after a large voice intake.
 *
 * Deliberately NOT talking to the database. `commit_intake_session`'s
 * original path (no `p_draft_ids`) already told the caller exactly how many
 * it committed and how many it held (`CommitResult`), which is the ceiling
 * count — that number, not a re-derivation of it, is what these screens use
 * as the "how many stay awake" figure. Everything here operates on the
 * confirmed drafts already loaded by `useDrafts`, which every review screen
 * fetches anyway.
 */

/**
 * A best-effort default selection for M-08's picker: the drafts that would
 * most likely already be active, in spoken order, whole drafts only.
 *
 * This is NOT a byte-for-byte replay of `commit_intake_session`'s own loop —
 * that function walks copy by copy and can, in principle, split a
 * multi-quantity draft across the ceiling (nine slots free, a "three white
 * tees" draft next: one copy commits, two are held). Reproducing that here
 * would make the picker offer a fraction of a card, which is not a choice a
 * person can make. Whole-draft granularity is the simplification, and it is
 * safe precisely because this function only seeds a *default* — the resolve
 * call the user actually confirms is the source of truth, not this guess.
 */
export function defaultKeptDraftIds(
  confirmed: readonly IntakeDraftRow[],
  ceiling: number,
): Set<string> {
  const kept = new Set<string>();
  let used = 0;
  for (const draft of [...confirmed].sort((a, b) => a.ordinal - b.ordinal)) {
    const qty = Math.max(draft.quantity, 1);
    if (used + qty > ceiling) continue;
    used += qty;
    kept.add(draft.id);
  }
  return kept;
}

/** Total garments the confirmed set represents, quantity expanded — the "you
 *  own N pieces" figure in M-07's headline. */
export function totalQuantity(confirmed: readonly IntakeDraftRow[]): number {
  return confirmed.reduce((sum, d) => sum + Math.max(d.quantity, 1), 0);
}

const EMPTY: Tally = { tops: 0, bottoms: 0, dresses: 0, shoes: 0 };

/**
 * The same tally `tallyOf` builds from a real wardrobe, built instead from a
 * hypothetical one — the confirmed drafts a walkthrough produced, before any
 * of them are items. This is what lets M-07 quote a real outfit count
 * ("that's three hundred and eighty outfits") for the FULL spoken closet
 * rather than only the ten that will stay awake, using the one counting
 * routine every other free-tier surface reads (`outfit-count.ts`) rather than
 * a second implementation.
 */
export function tallyOfDrafts(drafts: readonly IntakeDraftRow[]): Tally {
  const out: Record<CountedKind, number> = { ...EMPTY };
  for (const d of drafts) {
    const kind = kindOfSlot(d.slot as Parameters<typeof kindOfSlot>[0]);
    if (kind) out[kind] += Math.max(d.quantity, 1);
  }
  return out;
}
