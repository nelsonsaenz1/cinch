import type { Garment, StyleContext } from '@/lib/styling';

/**
 * Reading the question well enough to generate the right outfits for it.
 *
 * The beam search needs a target formality, an occasion and a season before it
 * can rank anything. Those come from what the person typed, so they have to be
 * recovered here — on-device, before any network call.
 *
 * Deliberately keyword-based rather than a model call. Asking a model to parse
 * the question first would double the latency and the cost of every message,
 * and would still need a second pass to actually answer. Keywords get the
 * common cases right, and when they miss, the raw question is passed through
 * verbatim so the model can correct course from the shortlist it is given.
 */

const FORMALITY_RULES: [RegExp, number][] = [
  [/\b(black.?tie|gala|wedding|funeral|formal|tuxedo|ceremony)\b/i, 5],
  [/\b(interview|client|board|court|presentation|pitch|graduation|investor)\b/i, 4],
  [/\b(dinner|date|theatre|theater|opera|smart|dressy|nice restaurant|cocktail)\b/i, 4],
  [/\b(work|office|meeting|business|conference|smart.?casual)\b/i, 3],
  [/\b(brunch|lunch|coffee|errands|shopping|casual|weekend|drinks|bar|party|pub)\b/i, 2],
  [/\b(gym|workout|run|running|yoga|hike|hiking|lounge|home|comfy)\b/i, 1],
];

const OCCASION_RULES: [RegExp, string][] = [
  [/\b(gym|workout|run|yoga|training)\b/i, 'gym'],
  [/\b(office|work|meeting|business)\b/i, 'office'],
  [/\b(date|dinner|romantic)\b/i, 'date'],
  [/\b(wedding|gala|formal|black.?tie)\b/i, 'formal'],
  [/\b(party|event|launch|reception)\b/i, 'event'],
  [/\b(hike|hiking|outdoor|camping|walk)\b/i, 'outdoor'],
  [/\b(street|streetwear|sneaker)\b/i, 'streetwear'],
  [/\b(casual|weekend|errands|brunch)\b/i, 'casual'],
];

const SEASON_RULES: [RegExp, string][] = [
  [/\b(summer|hot|heat|beach|humid)\b/i, 'summer'],
  [/\b(winter|freezing|snow|cold snap)\b/i, 'winter'],
  [/\b(spring)\b/i, 'spring'],
  [/\b(fall|autumn)\b/i, 'fall'],
];

export type Intent = {
  targetFormality: number | null;
  targetOccasion: string | null;
  season: string | null;
  /** True when the question is about packing rather than dressing today. */
  packing: boolean;
  /** True when the question implies more than one setting in a day. */
  multiEvent: boolean;
};

export function parseIntent(question: string): Intent {
  const q = question.toLowerCase();

  let targetFormality: number | null = null;
  for (const [re, score] of FORMALITY_RULES) {
    if (re.test(q)) {
      targetFormality = score;
      break;
    }
  }

  let targetOccasion: string | null = null;
  for (const [re, occasion] of OCCASION_RULES) {
    if (re.test(q)) {
      targetOccasion = occasion;
      break;
    }
  }

  let season: string | null = null;
  for (const [re, s] of SEASON_RULES) {
    if (re.test(q)) {
      season = s;
      break;
    }
  }

  return {
    targetFormality,
    targetOccasion,
    season,
    packing: /\b(pack|packing|trip|travel|suitcase|holiday|vacation|away for)\b/i.test(q),
    // "then", "after" and "before" are what actually signal a day with more
    // than one register — the case the whole engine is built around.
    multiEvent:
      /\b(then|after|afterwards|later|before|straight to|and then)\b/i.test(q) &&
      /\b(dinner|drinks|meeting|party|work|bar|lunch|gym|date)\b/i.test(q),
  };
}

/**
 * Fold the parsed intent into a context the beam search can rank against.
 *
 * `known` is what the questionnaire already established by tap. It wins over
 * the keyword pass, and not as a tie-break: the composed sentence is generated
 * from those very answers, so re-deriving them from it is a lossy round trip
 * that can only disagree with the truth. A tapped "Black tie" must rank as a 5
 * even if the sentence it produced happens to say "evening".
 */
export function contextForQuestion(
  base: StyleContext,
  question: string,
  known?: { targetFormality: number | null; targetOccasion: string | null },
): StyleContext {
  const intent = parseIntent(question);
  return {
    ...base,
    note: question,
    targetFormality: known?.targetFormality ?? intent.targetFormality,
    targetOccasion: known?.targetOccasion ?? intent.targetOccasion,
    season: intent.season ?? base.season,
    // A question about a trip or another season should not be scored against
    // today's forecast — that is how "what do I pack for Rome in July" comes
    // back wearing a wool overcoat.
    weather: intent.packing || intent.season ? null : base.weather,
  };
}

/**
 * A compact description of the wardrobe for the model.
 *
 * This exists so the stylist can answer questions that are not requests for an
 * outfit — "how many white shirts do I have", "what am I missing" — without
 * ever being handed the closet itself. Kept to a few hundred tokens: the point
 * is shape and proportion, not an inventory.
 */
export function closetDigest(wardrobe: Garment[]): string {
  if (!wardrobe.length) return 'Their closet is empty.';

  const bySlot = new Map<string, number>();
  const byFamily = new Map<string, number>();
  const formality = [0, 0, 0, 0, 0];

  for (const g of wardrobe) {
    bySlot.set(g.slot, (bySlot.get(g.slot) ?? 0) + 1);
    const family = g.colors[0]?.family;
    if (family) byFamily.set(family, (byFamily.get(family) ?? 0) + 1);
    formality[Math.min(4, Math.max(0, Math.round(g.formality) - 1))]!++;
  }

  const label: Record<string, string> = {
    base_top: 'tops', mid_layer: 'knits and sweatshirts', bottom: 'bottoms',
    dress: 'dresses', outerwear: 'jackets and coats', footwear: 'shoes',
    bag: 'bags', headwear: 'hats', accessory: 'accessories',
  };

  const counts = [...bySlot.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slot, n]) => `${n} ${label[slot] ?? slot}`)
    .join(', ');

  const colours = [...byFamily.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([family, n]) => `${family} (${n})`)
    .join(', ');

  const mostWorn = [...wardrobe]
    .filter((g) => g.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount)
    .slice(0, 3)
    .map((g) => `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim());

  const neverWorn = wardrobe.filter((g) => g.wearCount === 0).length;

  const dressiest = Math.max(...wardrobe.map((g) => g.formality));

  const lines = [
    `${wardrobe.length} pieces: ${counts}.`,
    `Dominant colours: ${colours}.`,
    `Formality spread (1 casual to 5 formal): ${formality.join('/')}. Dressiest piece is a ${dressiest}.`,
  ];

  if (mostWorn.length) lines.push(`Reaches for most: ${mostWorn.join(', ')}.`);
  if (neverWorn > 0) lines.push(`${neverWorn} pieces never worn.`);

  return lines.join('\n');
}
