/**
 * Questions with an answer, answered from the closet rather than about it.
 *
 * ── The problem this exists to end ─────────────────────────────────────────
 *
 * "How many white shirts do I have" was a model call. The closet went up as a
 * digest — "148 pieces: 61 tops, 22 bottoms…" — and a model read that prose and
 * wrote a number back. Three things follow from that and all of them are bad:
 *
 *   THE NUMBER WAS NOT COUNTED. It was inferred from a summary that had already
 *   thrown away the individual pieces. A model asked to count from prose will
 *   produce a plausible number, and a plausible number about somebody's own
 *   wardrobe is indistinguishable from a correct one until they go and look.
 *
 *   IT COST A CALL AND TWENTY SECONDS to answer something the device could
 *   answer in a millisecond, from data already in memory.
 *
 *   AND IT SPENT THE STYLIST ALLOWANCE, which is finite and which people are
 *   supposed to spend on advice.
 *
 * So: a closed router, and a tool per factual question. The model still handles
 * everything open-ended — "what should I wear to my sister's wedding" is not a
 * lookup — but it receives compact facts and candidate outfits rather than a
 * closet to reason about, and it is never asked to do arithmetic that has
 * already been done.
 *
 * ── Why the router is CLOSED ───────────────────────────────────────────────
 *
 * Every intent below has a template whose every number comes from a tool. There
 * is no "probably factual" branch: a question that does not match a pattern
 * goes to the model, unchanged. That direction of failure is the safe one — an
 * open question answered by the model is the status quo, while a vague question
 * force-fitted to a template is a confident wrong answer with a number in it.
 */

import type { Garment } from '@/lib/styling';

// ---------------------------------------------------------------------------
// The closed intent set
// ---------------------------------------------------------------------------

export type FactIntent =
  | 'count'
  | 'colour_distribution'
  | 'most_worn'
  | 'least_worn'
  | 'unworn'
  | 'cost_per_wear'
  | 'last_worn'
  | 'gaps'
  | 'compatible';

export type FactQuery = {
  intent: FactIntent;
  /** A colour family or name the question named, when it named one. */
  colour: string | null;
  /** A slot the question named, when it named one. */
  slot: Garment['slot'] | null;
};

/**
 * Slot words as people say them, longest first so "t shirt" beats "shirt".
 *
 * Shared shape with the intake lexicon on purpose, but not shared code: this
 * maps SPOKEN WORDS TO SLOTS for a question, and `closet-parse.ts` maps them
 * for a garment being filed. They answer different questions about the same
 * vocabulary and would drift for different reasons.
 */
const SLOT_WORDS: [RegExp, Garment['slot']][] = [
  [/\b(t.?shirts?|tees?|tops?|blouses?|shirts?|camisoles?|tanks?)\b/i, 'base_top'],
  [/\b(sweaters?|jumpers?|cardigans?|knits?|hoodies?|sweatshirts?)\b/i, 'mid_layer'],
  [/\b(trousers?|pants?|jeans?|skirts?|shorts?|chinos?|leggings?|bottoms?)\b/i, 'bottom'],
  [/\b(dress(es)?|gowns?|jumpsuits?)\b/i, 'dress'],
  [/\b(coats?|jackets?|blazers?|parkas?|outerwear)\b/i, 'outerwear'],
  [/\b(shoes?|boots?|sneakers?|trainers?|loafers?|heels?|sandals?|flats?)\b/i, 'footwear'],
  [/\b(bags?|totes?|handbags?|backpacks?|clutch(es)?)\b/i, 'bag'],
  [/\b(hats?|caps?|beanies?)\b/i, 'headwear'],
  [/\b(scarves|scarfs?|belts?|gloves?|ties?|accessor(y|ies))\b/i, 'accessory'],
];

const COLOUR_WORDS = [
  'black', 'white', 'grey', 'gray', 'navy', 'blue', 'green', 'olive', 'red',
  'burgundy', 'pink', 'purple', 'brown', 'tan', 'beige', 'cream', 'yellow',
  'orange', 'gold', 'silver',
];

/**
 * Patterns that mean a question has ONE right answer.
 *
 * Ordered most-specific first: "how much have I worn my coat" is cost-per-wear,
 * not a count, and both contain "how much".
 */
const INTENT_RULES: [RegExp, FactIntent][] = [
  [/\bcost per wear|cost.per.wear|per wear|value for money|worth per\b/i, 'cost_per_wear'],
  [/\b(last|most recently) (worn|wore)|when did i (last )?wear|when was .* worn\b/i, 'last_worn'],
  // "haven't I worn" puts a pronoun between the verb and the participle, which
  // a contiguous match misses — and that phrasing is at least as common as the
  // tidy one.
  [/\b(never|not) worn|unworn|haven.?t\b[^.?!]*\bworn|yet to wear\b/i, 'unworn'],
  [/\b(least|less) (worn|often)|barely wear|hardly wear|forget about\b/i, 'least_worn'],
  [/\b(most|often(est)?) (worn|wear)|wear the most|reach for most|favourite piece\b/i, 'most_worn'],
  [/\b(colou?r) (distribution|breakdown|spread|palette)|what colou?rs do i\b/i, 'colour_distribution'],
  // "should I buy" is NOT here, and that is deliberate. A list of empty slots
  // does not answer "what should I buy next season" — that is advice, and
  // force-fitting it to a template would answer a taste question with an
  // inventory. It goes to the model, unchanged.
  [/\b(gaps?|missing|do i need|lacking|short on)\b/i, 'gaps'],
  [/\b(what|which) .*(goes|go|works?|matches?) with|compatible with|pair with|wear with\b/i, 'compatible'],
  [/\bhow many|how much of|count of|number of|do i have any|have i got any\b/i, 'count'],
];

/**
 * Read a question, or refuse to.
 *
 * Null means "this is not a lookup" and is the common answer — which is the
 * design. Everything null reaches the model exactly as it did before.
 */
export function routeFactQuestion(question: string): FactQuery | null {
  const q = question.trim();
  if (!q) return null;

  /**
   * Somebody asking the stylist what IT would wear is asking for taste.
   *
   * The evaluation harness caught this: "what would you wear with a leather
   * jacket in autumn" matched `wear with` and came back as a compatibility
   * lookup — a list of the user's own trousers, in answer to a question about
   * someone else's judgement. That is the expensive failure in this router,
   * because it is invisible: the answer is well formed, every item in it is
   * real, and it is not what was asked.
   *
   * Narrowly second-person on purpose. "What should I wear with my navy
   * blazer" IS a lookup over their closet and stays one; only "would you",
   * "do you think" and their contractions hand the question back to the model.
   */
  if (/\b(would|did|do) you\b|\byou'?d\b/i.test(q)) return null;

  let intent: FactIntent | null = null;
  for (const [re, value] of INTENT_RULES) {
    if (re.test(q)) {
      intent = value;
      break;
    }
  }
  if (!intent) return null;

  let slot: Garment['slot'] | null = null;
  for (const [re, value] of SLOT_WORDS) {
    if (re.test(q)) {
      slot = value;
      break;
    }
  }

  const colour = COLOUR_WORDS.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(q)) ?? null;

  return { intent, colour, slot };
}

// ---------------------------------------------------------------------------
// The tools. Every one of them is pure over the loaded closet.
// ---------------------------------------------------------------------------

/**
 * Both forms, written out.
 *
 * The singular used to be derived by stripping a trailing `s`, which produced
 * "You have 1 dresse.", "1 red accessorie" and "1 coats and jacket". English
 * plurals are not a suffix rule, and a compound label is not a noun with an `s`
 * on the end. Nine entries is cheaper than any amount of cleverness, and it is
 * the sort of sentence a person reads as the whole product being careless —
 * the counts were right every time.
 */
const SLOT_LABEL: Record<Garment['slot'], { one: string; many: string }> = {
  base_top: { one: 'top', many: 'tops' },
  mid_layer: { one: 'knit or sweatshirt', many: 'knits and sweatshirts' },
  bottom: { one: 'bottom', many: 'bottoms' },
  dress: { one: 'dress', many: 'dresses' },
  outerwear: { one: 'coat or jacket', many: 'coats and jackets' },
  footwear: { one: 'pair of shoes', many: 'shoes' },
  bag: { one: 'bag', many: 'bags' },
  headwear: { one: 'hat', many: 'hats' },
  accessory: { one: 'accessory', many: 'accessories' },
};

const nameOf = (g: Garment): string =>
  `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim().replace(/\s+/g, ' ');

/** Colour match on the printed name OR the family, because people use both. */
function matchesColour(g: Garment, colour: string | null): boolean {
  if (!colour) return true;
  const want = colour.toLowerCase();
  const alias = want === 'gray' ? 'grey' : want;
  return g.colors.some(
    (c) =>
      c.name?.toLowerCase().includes(alias) ||
      (c as { family?: string }).family?.toLowerCase() === alias,
  );
}

export function selectGarments(wardrobe: readonly Garment[], q: FactQuery): Garment[] {
  return wardrobe.filter(
    (g) => (q.slot === null || g.slot === q.slot) && matchesColour(g, q.colour),
  );
}

export type FactAnswer = {
  intent: FactIntent;
  /** The sentence the chat shows. Every number in it came from a count. */
  text: string;
  /** Ids behind the answer, so the screen can show the pieces. */
  itemIds: string[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function describeSelection(q: FactQuery, count?: number): string {
  const colour = q.colour ? `${q.colour} ` : '';
  const label = q.slot ? SLOT_LABEL[q.slot] : { one: 'piece', many: 'pieces' };
  return `${colour}${count === 1 ? label.one : label.many}`.trim();
}

/** "12 March 2026" — no relative dates, which go stale in a saved thread. */
function dateLabel(epochMs: number): string {
  const d = new Date(epochMs);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Answer a routed question, or return null.
 *
 * Null here is different from a null route: it means the question WAS a lookup
 * and the closet cannot answer it — no matching pieces, no prices, nothing worn
 * yet. That is said plainly rather than passed to the model, because "you have
 * none" is a real answer and asking a model to say it invites it to say
 * something else.
 */
export function answerFactQuestion(
  wardrobe: readonly Garment[],
  q: FactQuery,
  now: number,
): FactAnswer | null {
  const selected = selectGarments(wardrobe, q);
  const ids = selected.map((g) => g.id);

  switch (q.intent) {
    case 'count': {
      return {
        intent: q.intent,
        text: selected.length
          ? `You have ${selected.length} ${describeSelection(q, selected.length)}.`
          : `You don't have any ${describeSelection(q)} filed.`,
        itemIds: ids,
      };
    }

    case 'colour_distribution': {
      if (!selected.length) return { intent: q.intent, text: 'Your closet is empty.', itemIds: [] };
      const counts = new Map<string, number>();
      for (const g of selected) {
        const family = (g.colors[0] as { family?: string } | undefined)?.family ?? g.colors[0]?.name;
        if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
      }
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return {
        intent: q.intent,
        text: `${ranked.map(([f, n]) => `${f} ${n}`).join(', ')} — ${plural(selected.length, 'piece', 'pieces')} in all.`,
        itemIds: ids,
      };
    }

    case 'most_worn':
    case 'least_worn': {
      const worn = selected.filter((g) => g.wearCount > 0);
      if (!worn.length) {
        return { intent: q.intent, text: `Nothing in that group has been worn yet.`, itemIds: [] };
      }
      const sorted = [...worn].sort((a, b) =>
        q.intent === 'most_worn' ? b.wearCount - a.wearCount : a.wearCount - b.wearCount,
      );
      const top = sorted.slice(0, 3);
      return {
        intent: q.intent,
        text: top
          .map((g) => `${nameOf(g)} (${plural(g.wearCount, 'wear', 'wears')})`)
          .join(', '),
        itemIds: top.map((g) => g.id),
      };
    }

    case 'unworn': {
      const never = selected.filter((g) => g.wearCount === 0);
      return {
        intent: q.intent,
        text: never.length
          ? `${plural(never.length, 'piece has', 'pieces have')} never been worn: ${never
              .slice(0, 5)
              .map(nameOf)
              .join(', ')}${never.length > 5 ? '…' : ''}`
          : 'Everything in that group has been worn at least once.',
        itemIds: never.map((g) => g.id),
      };
    }

    case 'cost_per_wear': {
      // Only over pieces that carry BOTH a price and a wear. A cost-per-wear
      // averaged over unpriced pieces is a number with no meaning, and this is
      // the one answer where a wrong number sounds most authoritative.
      const priced = selected.filter((g) => g.purchasePrice !== null && g.wearCount > 0);
      if (!priced.length) {
        return {
          intent: q.intent,
          text: 'Cost per wear needs a price and at least one wear — none of those pieces has both yet.',
          itemIds: [],
        };
      }
      const totalSpend = priced.reduce((s, g) => s + (g.purchasePrice ?? 0), 0);
      const totalWears = priced.reduce((s, g) => s + g.wearCount, 0);
      const best = [...priced].sort(
        (a, b) => a.purchasePrice! / a.wearCount - b.purchasePrice! / b.wearCount,
      )[0]!;
      return {
        intent: q.intent,
        text:
          `$${(totalSpend / totalWears).toFixed(2)} per wear across ${plural(priced.length, 'priced piece', 'priced pieces')}. ` +
          `Best value is your ${nameOf(best)} at $${(best.purchasePrice! / best.wearCount).toFixed(2)}.`,
        itemIds: priced.map((g) => g.id),
      };
    }

    case 'last_worn': {
      const dated = selected.filter((g) => g.lastWornAt !== null);
      if (!dated.length) {
        return { intent: q.intent, text: 'Nothing in that group has a recorded wear.', itemIds: [] };
      }
      const latest = [...dated].sort((a, b) => (b.lastWornAt ?? 0) - (a.lastWornAt ?? 0))[0]!;
      const days = Math.floor((now - latest.lastWornAt!) / 86_400_000);
      return {
        intent: q.intent,
        text: `${nameOf(latest)}, on ${dateLabel(latest.lastWornAt!)} — ${plural(days, 'day', 'days')} ago.`,
        itemIds: [latest.id],
      };
    }

    case 'gaps': {
      // A gap is an EMPTY slot, counted. Not a taste judgement: "you could use
      // a statement coat" is advice and belongs to the model.
      const bySlot = new Map<Garment['slot'], number>();
      for (const g of wardrobe) bySlot.set(g.slot, (bySlot.get(g.slot) ?? 0) + 1);
      const empty = (Object.keys(SLOT_LABEL) as Garment['slot'][]).filter(
        (slot) => (bySlot.get(slot) ?? 0) === 0,
      );
      return {
        intent: q.intent,
        text: empty.length
          ? `Nothing filed under ${empty.map((s) => SLOT_LABEL[s].many).join(', ')}.`
          : 'Every slot has something in it.',
        itemIds: [],
      };
    }

    case 'compatible': {
      // Deliberately NOT an outfit. Compatibility here is the formality band
      // the scorer already uses; building the outfit is the beam search's job
      // and this must not become a second, worse copy of it.
      if (!selected.length) return null;
      const anchor = selected[0]!;
      const matches = wardrobe.filter(
        (g) =>
          g.id !== anchor.id &&
          g.slot !== anchor.slot &&
          Math.abs(g.formality - anchor.formality) <= 1,
      );
      if (!matches.length) return null;
      return {
        intent: q.intent,
        text: `${matches.length} pieces sit at the same level as your ${nameOf(anchor)}.`,
        itemIds: matches.slice(0, 12).map((g) => g.id),
      };
    }
  }
}

/**
 * The whole path: route, answer, or hand back null for the model.
 *
 * One entry point so a caller cannot accidentally route without answering, or
 * answer a question the router refused.
 */
export function tryFactAnswer(
  wardrobe: readonly Garment[],
  question: string,
  now: number,
): FactAnswer | null {
  const routed = routeFactQuestion(question);
  if (!routed) return null;
  return answerFactQuestion(wardrobe, routed, now);
}

/**
 * A cache key for closet-derived facts.
 *
 * The plan asks for stable facts cached by closet REVISION, and this is the
 * revision: a count plus the newest mutation timestamp the closet carries.
 * Cheap to compute, changes whenever a piece is added, removed or worn, and
 * — unlike a hash of every field — does not walk the whole wardrobe twice on
 * every keystroke.
 */
export function closetRevision(wardrobe: readonly Garment[]): string {
  let newest = 0;
  let wears = 0;
  for (const g of wardrobe) {
    if (g.lastWornAt && g.lastWornAt > newest) newest = g.lastWornAt;
    wears += g.wearCount;
  }
  return `${wardrobe.length}:${wears}:${newest}`;
}
