/**
 * Candidate generation.
 *
 * A 150-item closet contains on the order of a million valid combinations once
 * layers and shoes are counted. Scoring all of them is wasteful, and handing
 * any meaningful fraction to a language model is impossible. So generation is a
 * staged beam search: build the core of the outfit, keep the best partial
 * looks, extend them, keep the best again.
 *
 * The pruning is safe because the rules that decide most of an outfit's quality
 * — palette, proportion, pattern — are already computable from the core two or
 * three pieces. A top-and-bottom pairing that clashes will not be rescued by
 * its shoes, so discarding it early costs nothing.
 *
 * Everything here runs on-device in a few milliseconds. That is what lets
 * outfit generation work offline and stay free, with the model reserved for
 * re-ranking the shortlist and writing the reasoning.
 */

import {
  ACCESSORY_KIND_ORDER,
  MAX_ACCESSORIES_PER_OUTFIT,
  accessoryKind,
  type AccessoryKind,
} from './accessory';
import { targetWarmth } from './features';
import {
  DEFAULT_WEIGHTS,
  EMPTY_AFFINITIES,
  scoreOutfit,
  type Affinities,
  type StyleWeights,
} from './score';
import type { Garment, OutfitCandidate, Slot, StyleContext } from './types';

const BEAM_CORE = 48;
const BEAM_SHOD = 64;
const BEAM_FINAL = 40;

export type GenerateOptions = {
  weights?: StyleWeights;
  affinities?: Affinities;
  /** How many outfits to return. */
  count?: number;
  /** Items to keep out — already planned for this week, in the wash, etc. */
  excludeItemIds?: Set<string>;
  /** Force an item in. Powers "build me something around these boots". */
  pinnedItemIds?: Set<string>;
  /** 0 = maximum variety, 1 = pure score. */
  diversity?: number;
  includeAccessories?: boolean;
};

const bucket = (wardrobe: Garment[]): Record<Slot, Garment[]> => {
  const out: Record<Slot, Garment[]> = {
    base_top: [], mid_layer: [], bottom: [], dress: [],
    outerwear: [], footwear: [], bag: [], headwear: [], accessory: [],
  };
  for (const g of wardrobe) out[g.slot].push(g);
  return out;
};

/** Cheap partial score for pruning — only the rules that need no full outfit. */
function coreScore(items: Garment[], ctx: StyleContext, weights: StyleWeights): number {
  const c = scoreOutfit(items, { ...ctx, weather: null, events: [] }, weights);
  return c.features.palette * 0.45 + c.features.proportion * 0.25 + c.features.pattern * 0.2 + c.features.formality * 0.1;
}

const topBy = <T,>(arr: T[], n: number, key: (t: T) => number): T[] =>
  [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);

export function generateOutfits(
  wardrobe: Garment[],
  ctx: StyleContext,
  opts: GenerateOptions = {},
): OutfitCandidate[] {
  const {
    weights = DEFAULT_WEIGHTS,
    affinities = EMPTY_AFFINITIES,
    count = 3,
    excludeItemIds,
    pinnedItemIds,
    diversity = 0.35,
    includeAccessories = true,
  } = opts;

  const usable = wardrobe.filter((g) => !excludeItemIds?.has(g.id));
  const slots = bucket(usable);
  const pinned = pinnedItemIds ? usable.filter((g) => pinnedItemIds.has(g.id)) : [];
  const pinnedSlots = new Set(pinned.map((g) => g.slot));

  // Layering policy from the forecast. Deciding this once, up front, is what
  // keeps a coat out of a 28-degree afternoon without paying to score it.
  const target = ctx.weather ? targetWarmth(ctx.weather.feelsLikeC, ctx.weather.windKph) : 8;
  const wantsOuterwear = target >= 9;
  const allowsOuterwear = target >= 6.5;
  const wantsMidLayer = target >= 8.5;
  const allowsMidLayer = target >= 6;

  // --- Stage A: cores ------------------------------------------------------
  const cores: Garment[][] = [];

  const tops = pinnedSlots.has('base_top')
    ? pinned.filter((g) => g.slot === 'base_top')
    : slots.base_top;
  const bottoms = pinnedSlots.has('bottom')
    ? pinned.filter((g) => g.slot === 'bottom')
    : slots.bottom;

  /**
   * A knit worn on its own is an outfit.
   *
   * `mid_layer` is inferred from the subcategory — sweater, jumper, cardigan,
   * hoodie, fleece, knit, turtleneck (garment.ts) — so it is not a niche slot
   * holding cardigans worn over shirts. It is where most knitwear lands, and
   * for the half of the year people wear knitwear it is what they put on
   * first. Building cores only from `base_top` meant a jumper and trousers was
   * not an outfit this engine could produce: a wardrobe of five jumpers and
   * two pairs of trousers generated NOTHING, and the free tier's canonical ten
   * — whose second top is a mohair jumper — reached ten outfits where the
   * design promises fourteen.
   *
   * Gated on `allowsMidLayer` rather than offered unconditionally, because a
   * core cannot be dropped later the way an added layer can, and mohair in a
   * heatwave is a worse failure than a hot day showing fewer options. The
   * counting function stays weather-independent by counting cores
   * arithmetically (docs/design/free-tier-contract.md) — this gate narrows
   * what is offered today, never what the closet is said to make.
   */
  const midsAsTops = pinnedSlots.has('mid_layer')
    ? pinned.filter((g) => g.slot === 'mid_layer')
    : slots.mid_layer;

  // Only when the caller has pinned no top of either kind. A pinned shirt means
  // "build around this shirt", and letting knits anchor their own cores would
  // produce looks the pinned garment is absent from; a pinned knit means "layer
  // this over something", which is Stage C's job, not a core.
  //
  // …AND ALWAYS WHEN THERE IS NOTHING ELSE. A closet whose every top is a
  // knit — five jumpers and three pairs of trousers, ten pieces, thirty
  // counted outfits — generated NOTHING above 24.6 °C, and the screen's
  // fallback then told its owner to add shoes she already had. A hot day
  // offering a jumper is a worse outfit; a hot day offering no outfit from a
  // closet the app just counted is a lie. So the weather gate narrows knit
  // cores only while shirts exist to anchor cores instead.
  const knitsMayAnchor =
    (allowsMidLayer || tops.length === 0) &&
    !pinnedSlots.has('base_top') &&
    !pinnedSlots.has('mid_layer');
  const coreTops = knitsMayAnchor ? [...tops, ...midsAsTops] : tops;

  /**
   * WHICH CORE SHAPES CAN EVER HOLD WHAT WAS PINNED.
   *
   * Narrowing each slot's candidate list — what every `pinnedSlots.has(…)`
   * above does — only constrains cores that HAVE that slot. A dress core is
   * `[dress]`: it has no top and no bottom, so pinning a pair of trousers left
   * every dress core untouched and "build me something around these trousers"
   * came back with a dress. That was the defect the skipped test in
   * `styling-generate.test.ts` described, and it is a shape mismatch rather
   * than a narrowing bug — no candidate list can express "this core cannot
   * exist".
   *
   * A dress core can still gain footwear, outerwear and accessories later, so
   * pinning those is compatible with it. It can never gain a `base_top` or a
   * `bottom`, and Stage C's `canLayerMid` refuses a mid-layer over a dress —
   * so a pinned mid-layer rules dress cores out too.
   */
  const dressExcludedBy = (['base_top', 'bottom', 'mid_layer'] as const).filter((s) =>
    pinnedSlots.has(s),
  );
  const twoPieceExcluded = pinnedSlots.has('dress');

  if (!twoPieceExcluded) {
    for (const top of coreTops) {
      for (const bottom of bottoms) cores.push([top, bottom]);
    }
  }

  if (dressExcludedBy.length === 0) {
    const dresses = pinnedSlots.has('dress')
      ? pinned.filter((g) => g.slot === 'dress')
      : slots.dress;
    for (const dress of dresses) cores.push([dress]);
  }

  // Contradictory pins — a dress AND trousers — leave nothing, which is the
  // honest answer rather than quietly dropping one of them.
  if (!cores.length) return [];

  const rankedCores = topBy(cores, BEAM_CORE, (c) => coreScore(c, ctx, weights));

  // --- Stage B: footwear ---------------------------------------------------
  const shoes = pinnedSlots.has('footwear')
    ? pinned.filter((g) => g.slot === 'footwear')
    : slots.footwear;

  const shod: Garment[][] = shoes.length
    ? rankedCores.flatMap((core) => shoes.map((s) => [...core, s]))
    : rankedCores;

  const rankedShod = topBy(shod, BEAM_SHOD, (c) => coreScore(c, ctx, weights));

  // --- Stage C: layers -----------------------------------------------------
  const mids = midsAsTops;
  const outers = pinnedSlots.has('outerwear')
    ? pinned.filter((g) => g.slot === 'outerwear')
    : slots.outerwear;

  // A pinned layer must be in every variant that leaves this stage. Otherwise
  // the unlayered and mid-only branches below emit outfits without the coat
  // somebody asked to build around, and the guarantee at the end of the
  // function then has to throw them away — turning "here are three looks with
  // your coat" into "no looks at all" on a mild day.
  const mustLayerMid = pinnedSlots.has('mid_layer');
  const mustLayerOuter = pinnedSlots.has('outerwear');

  const layered: Garment[][] = [];
  for (const base of rankedShod) {
    const hasDress = base.some((g) => g.slot === 'dress');
    // A core anchored by a knit already occupies the mid-layer slot. Adding
    // another would put two jumpers in one outfit and break the one-per-slot
    // invariant the generator tests assert.
    const hasMid = base.some((g) => g.slot === 'mid_layer');
    const canLayerMid = !hasDress && !hasMid;
    // A pinned knit that is already anchoring this core is satisfied by it.
    const midSatisfied = !mustLayerMid || hasMid;

    // Unlayered is only a valid option when the forecast permits it — and when
    // nothing that has to be worn is still in hand.
    if (!wantsOuterwear && !mustLayerOuter && midSatisfied) layered.push(base);

    if (allowsMidLayer && canLayerMid && !mustLayerOuter) {
      for (const mid of mids) layered.push([...base, mid]);
    }
    if (allowsOuterwear) {
      for (const outer of outers) {
        if (midSatisfied) layered.push([...base, outer]);
        if ((wantsMidLayer || mustLayerMid) && canLayerMid) {
          for (const mid of mids) layered.push([...base, mid, outer]);
        }
      }
    }
  }

  const pool = layered.length ? layered : rankedShod;

  // --- Full scoring --------------------------------------------------------
  let scored = pool.map((items) => scoreOutfit(items, ctx, weights, affinities));
  scored = topBy(scored, BEAM_FINAL, (c) => c.score);

  /**
   * THE BUILT-PIECE GUARANTEE, part one.
   *
   * Everything above narrows what gets BUILT. This checks what came out, and it
   * exists because narrowing is the wrong tool for "must contain": every stage
   * has to remember to respect the pins, and the dress-core defect was one
   * stage forgetting. A shape mismatch, a new layer branch, a future slot — all
   * of them fail the same way, and all of them are caught here.
   *
   * It is a filter and not an assertion because the honest answer to "build
   * something around this dress and these trousers" is nothing at all. Callers
   * already handle an empty list; `pinnedItemIds` is a request, not a promise
   * that a wardrobe can satisfy it.
   *
   * Attach-stage slots are excluded HERE and verified after the attach below:
   * a pinned bag is not on any candidate yet, and filtering for it at this
   * point would empty the list every time.
   */
  const ATTACH_SLOTS: readonly Slot[] = ['bag', 'headwear', 'accessory'];
  if (pinned.length) {
    const required = pinned.filter((g) => !ATTACH_SLOTS.includes(g.slot)).map((g) => g.id);
    scored = scored.filter((c) => {
      const has = new Set(c.items.map((g) => g.id));
      return required.every((id) => has.has(id));
    });
  }

  let chosen = selectDiverse(scored, count, diversity);

  /**
   * Accessories attach to the CHOSEN outfits, not the whole beam.
   *
   * They used to attach to all BEAM_FINAL candidates before the diverse pick,
   * which cost a full `scoreOutfit` per accessory per candidate — on a
   * 190-piece closet that was most of the generation pass, and seven of those
   * passes are what froze the Plan tab (2026-08-20). An accessory changes an
   * outfit's score by hundredths, so ranking and diversity are decided by the
   * garments that decide them, and the attach runs `count` times instead of
   * forty. Ordering is unchanged for the pieces that matter; the whole pass
   * runs at roughly the pre-accessory cost.
   */
  if (includeAccessories) {
    chosen = chosen.map((c) => addAccessories(c, slots, ctx, weights, affinities, pinned));
  }

  /**
   * THE GUARANTEE, part two — every pin, attach-stage ones included, on what
   * is actually returned. `attachPinned` makes a miss impossible today; this
   * filter is what catches the future edit that makes it possible again.
   */
  if (pinned.length) {
    const required = pinned.map((g) => g.id);
    chosen = chosen.filter((c) => {
      const has = new Set(c.items.map((g) => g.id));
      return required.every((id) => has.has(id));
    });
  }

  return chosen;
}

/**
 * Greedily attach accessories, but only when they improve the score.
 * Enumerating accessories multiplies the search space for very little
 * signal, and an accessory that hurts the outfit is worse than none.
 *
 * Three families, each with its own rivalry rule:
 *
 *   bag       — one, ever. Nobody carries two.
 *   headwear  — one, ever, and gated harder than the rest (the bar below is
 *               doubled): a hat redraws the whole silhouette, so it has to
 *               EARN its place rather than sneak in on a rounding error.
 *   accessory — one per KIND (a watch and sunglasses coexist; two belts do
 *               not), at most MAX_ACCESSORIES_PER_OUTFIT in total, in
 *               ACCESSORY_KIND_ORDER. See `./accessory.ts` for why the slot
 *               is too coarse a line to draw the rivalry along.
 */
function addAccessories(
  candidate: OutfitCandidate,
  slots: Record<Slot, Garment[]>,
  ctx: StyleContext,
  weights: StyleWeights,
  affinities: Affinities,
  pinned: Garment[] = [],
): OutfitCandidate {
  let best = candidate;

  /** The improvement a suggested extra must clear. */
  const BAR = 0.004;

  // A pinned accessory goes on whether or not it flatters the outfit. The
  // score gate is the right rule for a suggestion and the wrong one for an
  // instruction: somebody who pinned a bag is not asking whether it works.
  const attachPinned = (slot: 'bag' | 'headwear' | 'accessory'): boolean => {
    const required = pinned.filter((g) => g.slot === slot);
    for (const extra of required) {
      if (best.items.some((g) => g.id === extra.id)) continue;
      best = scoreOutfit([...best.items, extra], ctx, weights, affinities);
    }
    return required.length > 0;
  };

  for (const slot of ['bag', 'headwear'] as const) {
    if (attachPinned(slot)) continue;
    const bar = slot === 'headwear' ? BAR * 2 : BAR;
    for (const extra of slots[slot]) {
      const next = scoreOutfit([...best.items, extra], ctx, weights, affinities);
      if (next.score > best.score + bar) best = next;
    }
  }

  if (attachPinned('accessory')) return best;

  // One winner per kind, then the capped attach. Grouping FIRST is what makes
  // "a watch and a necklace" reachable — the old single loop kept whichever
  // one accessory scored best and the runner-up never got a second question.
  const byKind = new Map<AccessoryKind, Garment[]>();
  for (const extra of slots.accessory) {
    const kind = accessoryKind(extra);
    byKind.set(kind, [...(byKind.get(kind) ?? []), extra]);
  }

  let attached = 0;
  for (const kind of ACCESSORY_KIND_ORDER) {
    if (attached >= MAX_ACCESSORIES_PER_OUTFIT) break;
    let bestOfKind: OutfitCandidate | null = null;
    for (const extra of byKind.get(kind) ?? []) {
      const next = scoreOutfit([...best.items, extra], ctx, weights, affinities);
      if (next.score > best.score + BAR && next.score > (bestOfKind?.score ?? -Infinity)) {
        bestOfKind = next;
      }
    }
    if (bestOfKind) {
      best = bestOfKind;
      attached += 1;
    }
  }

  return best;
}

/** Shared items plus shared colour families — how alike two outfits look. */
function similarity(a: OutfitCandidate, b: OutfitCandidate): number {
  const idsA = new Set(a.items.map((g) => g.id));
  const shared = b.items.filter((g) => idsA.has(g.id)).length;
  const union = new Set([...a.items, ...b.items].map((g) => g.id)).size;
  const jaccard = union > 0 ? shared / union : 0;

  const famA = new Set(a.items.map((g) => g.colors[0]?.family).filter(Boolean));
  const famB = new Set(b.items.map((g) => g.colors[0]?.family).filter(Boolean));
  const famShared = [...famA].filter((f) => famB.has(f)).length;
  const famUnion = new Set([...famA, ...famB]).size;
  const paletteSim = famUnion > 0 ? famShared / famUnion : 0;

  return jaccard * 0.7 + paletteSim * 0.3;
}

/**
 * Maximal marginal relevance.
 *
 * Pure top-N returns three near-identical outfits — the same jeans and shoes
 * with the shirt swapped — because the scorer has no notion of what it already
 * picked. Trading a little score for visible difference is what makes three
 * suggestions feel like three choices.
 */
export function selectDiverse(
  candidates: OutfitCandidate[],
  count: number,
  diversity: number,
): OutfitCandidate[] {
  if (candidates.length <= count) return [...candidates].sort((a, b) => b.score - a.score);

  const lambda = 1 - diversity;
  const remaining = [...candidates].sort((a, b) => b.score - a.score);
  const chosen: OutfitCandidate[] = [remaining.shift()!];

  while (chosen.length < count && remaining.length) {
    let bestIdx = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i]!;
      const maxSim = Math.max(...chosen.map((s) => similarity(c, s)));
      const value = lambda * c.score - (1 - lambda) * maxSim;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    chosen.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return chosen;
}

/**
 * Turn the scored notes into a sentence.
 *
 * Used verbatim when the model is unavailable, and passed to the model as
 * grounded facts when it is — so the AI elaborates on something true rather
 * than inventing a rationale for an outfit it cannot see.
 */
export function explain(candidate: OutfitCandidate): string {
  // `occasion` joined the order with the lifestyle profile (2026-08-20): its
  // notes are the visible proof the profile is heard, and a note the explain
  // line never prints is a fact the scorer kept to itself.
  const order: (keyof OutfitCandidate['notes'])[] = [
    'weather', 'formality', 'occasion', 'palette', 'proportion', 'pattern', 'freshness', 'affinity',
  ];
  const parts = order
    .map((k) => candidate.notes[k])
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);

  if (!parts.length) return 'A solid, wearable combination from your closet.';

  const [first, ...rest] = parts;
  const sentence = first!.charAt(0).toUpperCase() + first!.slice(1);
  return rest.length ? `${sentence} — ${rest.join(', ')}.` : `${sentence}.`;
}
