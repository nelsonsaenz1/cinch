/**
 * How many outfits a closet makes.
 *
 * The single counting routine the five free-tier surfaces read. The Ten states
 * the rule and the other four inherit it: "Every number on these screens — 14,
 * 16, 18, 12 — comes from the same routine that Directives 2, 3, 4 and 5 read.
 * If it cannot be computed for this user, it does not appear."
 *
 * Four screens quoting four different totals is the fastest way to lose the
 * honesty the whole product rests on, so there is exactly one implementation and
 * no screen is permitted a second opinion. See docs/design/free-tier-contract.md
 * for the full derivation.
 *
 * ── What is counted ────────────────────────────────────────────────────────
 *
 * Distinct outfit CORES: a top with a bottom, or a dress — shod when the
 * closet has shoes, honest without them (founder decision, 2026-09-01).
 *
 *     outfits = (tops × bottoms + dresses) × max(shoes, 1)
 *
 * Shoes MULTIPLY; they no longer GATE. This is exactly the generator's own
 * shape — `generate.ts` Stage B multiplies every core by every shoe when
 * shoes exist and passes cores through unshod when none do — so the change
 * RESTORES the divergence rule below rather than bending it: before it, a
 * shoeless closet was told "0" by this file while the engine happily built
 * plates (both real Reveal zeros of 2026-08-31: 108 pieces and 10 pieces,
 * no shoes, told zero). For a closet with any shoes the number is unchanged:
 * (t×b + d) × s is algebraically the old t×b×s + d×s.
 *
 * Coats, bags and accessories are deliberately absent. The Gap Feed states it:
 * "Layers and bags dress an outfit; they don't create one. Never ranked as a
 * gain." A closet that gains a second coat honestly gains nothing, and the wall
 * says so rather than borrowing a better number from a different garment.
 *
 * ── Why not just count what the generator returns ──────────────────────────
 *
 * `generateOutfits` is pure and on-device, so counting a hypothetical closet by
 * running it would be affordable. It is still wrong, three ways:
 *
 *   1. It would double-count layers. Stage C pushes a look both with and
 *      without its coat, so one coat would manufacture outfits.
 *   2. It would make the number move with the weather. `wantsOuterwear` and
 *      `allowsMidLayer` come from the forecast, so a closet that "makes
 *      fourteen outfits" would quietly make some other number on a cold day.
 *      This figure is printed as a durable fact about a wardrobe; it cannot
 *      depend on today. Counting cores sidesteps it, because weather only ever
 *      affects layers.
 *   3. It truncates. BEAM_CORE 48 / BEAM_SHOD 64 / BEAM_FINAL 40, and
 *      `selectDiverse` returns at most `count`. The generator shortlists; it
 *      does not enumerate.
 *
 * ── "Suggestible outfits" ──────────────────────────────────────────────────
 *
 * The Reveal requires that combinations the engine would refuse are not counted
 * — the number shown and the number of plates actually reachable must never
 * diverge. There is no refusal predicate in the codebase: `score.ts` ranks
 * candidates and never rejects one. So the clause holds by construction today,
 * every core being reachable. IF a score floor is ever introduced, THIS FILE is
 * the one place that must learn about it. Do not scatter that knowledge.
 */

import type { Garment, Slot } from '@/lib/styling';

/** The four garment kinds that create outfits. Order is the ranking tiebreak. */
export const COUNTED_KINDS = ['shoes', 'bottoms', 'tops', 'dresses'] as const;

export type CountedKind = (typeof COUNTED_KINDS)[number];

/**
 * A closet reduced to the only four numbers that affect the count.
 *
 * Coats and bags are not here, and their absence is the point — a Tally cannot
 * express "one more coat" because one more coat is not a countable change.
 */
export type Tally = Readonly<Record<CountedKind, number>>;

export const EMPTY_TALLY: Tally = { tops: 0, bottoms: 0, dresses: 0, shoes: 0 };

/**
 * Which counted kind a styling slot belongs to, or null when it does not count.
 *
 * `mid_layer` counts as a top. Most knitwear lands there — jumper, sweater,
 * cardigan, fleece, knit, turtleneck — and a jumper worn with trousers is an
 * outfit. The generator agrees: knits may anchor a core (see the
 * `knitsMayAnchor` note in lib/styling/generate.ts). Counting them as tops here
 * and refusing them as cores there is precisely the divergence the Reveal
 * forbids, so the two must change together.
 */
export function kindOfSlot(slot: Slot): CountedKind | null {
  switch (slot) {
    case 'base_top':
    case 'mid_layer':
      return 'tops';
    case 'bottom':
      return 'bottoms';
    case 'dress':
      return 'dresses';
    case 'footwear':
      return 'shoes';
    case 'outerwear':
    case 'bag':
    case 'headwear':
    case 'accessory':
      return null;
  }
}

/**
 * Bucket a real wardrobe into the four counted kinds.
 *
 * Typed on `slot` alone rather than on the whole `Garment`, because that is
 * genuinely all it reads — which lets the starter-readiness fixtures and the
 * dev routes hand it a list of classified slots without fabricating twenty
 * fields of garment metadata nobody counts.
 */
export function tallyOf(wardrobe: readonly Pick<Garment, 'slot'>[]): Tally {
  const out = { ...EMPTY_TALLY };
  for (const g of wardrobe) {
    const kind = kindOfSlot(g.slot);
    if (kind) out[kind] += 1;
  }
  return out;
}

/** The headline number. See the header: shoes multiply, never gate. */
export function countOutfits(t: Tally): number {
  return (t.tops * t.bottoms + t.dresses) * Math.max(t.shoes, 1);
}

/** The same tally with one more piece of `kind` in it. */
export function withOne(t: Tally, kind: CountedKind): Tally {
  return { ...t, [kind]: t[kind] + 1 };
}

export type Gain = {
  kind: CountedKind;
  /** The count this closet would make with one more piece of `kind`. */
  total: number;
  /** How many of those are new. Never negative. */
  gain: number;
};

/** What one more piece of `kind` would produce. */
export function gainFrom(t: Tally, kind: CountedKind): Gain {
  const total = countOutfits(withOne(t, kind));
  return { kind, total, gain: total - countOutfits(t) };
}

/**
 * Every kind ranked by gain, descending.
 *
 * Ranked by computed gain and never reshuffled for conversion — the Gap Feed is
 * explicit that a paying user sees this identical ranking, and that the free
 * tier withholds the ability to act rather than the quality of the advice. Ties
 * break on COUNTED_KINDS order, which puts shoes first among equals. Since the
 * 2026-09-01 change the FIRST shoe honestly gains zero (an outfit stands
 * without it; ×max(shoes,1) makes one shoe a no-op on the count) — the second
 * shoe is where multiplication starts, and the ranking now says so instead of
 * over-recommending footwear to a shoeless closet.
 */
export function rankGaps(t: Tally): Gain[] {
  return COUNTED_KINDS.map((kind) => gainFrom(t, kind)).sort((a, b) => b.gain - a.gain);
}

/**
 * What is missing before ANY outfit can be built.
 *
 * Powers the Reveal's honest-failure state (R-05), where ten photographed tops
 * make zero outfits. The screen names exactly what is absent and offers the
 * smallest real fix, rather than manufacturing a poor look to have something to
 * show. Empty when the closet already makes something.
 */
export function missingForFirstOutfit(t: Tally): CountedKind[] {
  if (countOutfits(t) > 0) return [];

  // Shoes never appear here any more: since 2026-09-01 an outfit stands
  // without them, so the only reachable zero is a closet with no dress and a
  // missing half of the separates pair.
  const missing: CountedKind[] = [];
  if (t.tops === 0) missing.push('tops');
  if (t.bottoms === 0) missing.push('bottoms');
  return missing;
}
